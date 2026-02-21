import { NextResponse } from 'next/server';
import { getDbAndUser, requireMutate } from '@/lib/api-helpers';
import { transfers } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export async function DELETE(
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

    const body = (await request.json()) as { deleteReason?: string };
    const deleteReason = typeof body?.deleteReason === 'string' ? body.deleteReason.trim() : '';
    if (!deleteReason) {
      return NextResponse.json(
        { error: 'ต้องระบุเหตุผลในการลบ' },
        { status: 400 }
      );
    }

    const [t] = await db
      .select({ id: transfers.id })
      .from(transfers)
      .where(and(eq(transfers.id, idNum), isNull(transfers.deletedAt)))
      .limit(1);

    if (!t) {
      return NextResponse.json({ error: 'Not found or already deleted' }, { status: 404 });
    }

    const now = new Date();
    await db
      .update(transfers)
      .set({
        deletedAt: now,
        deletedBy: user!.id,
        deleteReason,
      })
      .where(eq(transfers.id, idNum));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
