import { NextResponse } from 'next/server';
import { getDbAndUser, requireSettings } from '@/lib/api-helpers';
import { bonuses, bonusCategories } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { bonusCategorySchema } from '@/lib/validations';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireSettings(user);
    if (err) return err;

    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = bonusCategorySchema.safeParse(body);
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

    await db
      .update(bonusCategories)
      .set({ name: parsed.data.name })
      .where(eq(bonusCategories.id, idNum));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireSettings(user);
    if (err) return err;

    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const [hasBonuses] = await db
      .select({ id: bonuses.id })
      .from(bonuses)
      .where(eq(bonuses.categoryId, idNum))
      .limit(1);

    if (hasBonuses) {
      return NextResponse.json(
        { error: 'มีรายการโบนัสใช้หมวดหมู่นี้อยู่ ไม่สามารถลบได้' },
        { status: 400 }
      );
    }

    await db.delete(bonusCategories).where(eq(bonusCategories.id, idNum));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
