import { NextResponse } from 'next/server';
import { getDbAndUser, requireMutate } from '@/lib/api-helpers';
import { bonuses, bonusEdits } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { editBonusSchema } from '@/lib/validations';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireMutate(user);
    if (err) return err;

    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = editBonusSchema.safeParse(body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const msg =
        flat.formErrors?.[0] ??
        Object.values(flat.fieldErrors ?? {}).flat()[0] ??
        'ข้อมูลไม่ถูกต้อง';
      return NextResponse.json(
        { error: typeof msg === 'string' ? msg : 'ข้อมูลไม่ถูกต้อง' },
        { status: 400 }
      );
    }
    if (!parsed.data.editReason || parsed.data.editReason.trim() === '') {
      return NextResponse.json(
        { error: 'ต้องระบุเหตุผลในการแก้ไข' },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(bonuses)
      .where(eq(bonuses.id, idNum))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (existing.deletedAt) {
      return NextResponse.json(
        { error: 'ไม่สามารถแก้ไขรายการที่ลบแล้วได้' },
        { status: 400 }
      );
    }

    const beforeSnapshot = {
      websiteId: existing.websiteId,
      userIdInput: existing.userIdInput,
      userFull: existing.userFull,
      categoryId: existing.categoryId,
      amountMinor: existing.amountMinor,
      bonusTime: existing.bonusTime,
    };

    const afterSnapshot = {
      websiteId: parsed.data.websiteId ?? existing.websiteId,
      userIdInput: parsed.data.userIdInput ?? existing.userIdInput,
      userFull: parsed.data.userFull ?? existing.userFull,
      categoryId: parsed.data.categoryId ?? existing.categoryId,
      amountMinor: parsed.data.amountMinor ?? existing.amountMinor,
      bonusTime: parsed.data.bonusTime ?? existing.bonusTime,
    };

    const now = new Date();
    await db
      .update(bonuses)
      .set({
        websiteId: afterSnapshot.websiteId,
        userIdInput: afterSnapshot.userIdInput,
        userFull: afterSnapshot.userFull,
        categoryId: afterSnapshot.categoryId,
        amountMinor: afterSnapshot.amountMinor,
        bonusTime: afterSnapshot.bonusTime,
      })
      .where(eq(bonuses.id, idNum));

    await db.insert(bonusEdits).values({
      bonusId: idNum,
      editedBy: user!.id,
      editReason: parsed.data.editReason.trim(),
      beforeSnapshot: JSON.stringify(beforeSnapshot),
      afterSnapshot: JSON.stringify(afterSnapshot),
      editedAt: now,
    });

    const [updated] = await db
      .select()
      .from(bonuses)
      .where(eq(bonuses.id, idNum))
      .limit(1);
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
