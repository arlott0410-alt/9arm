import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth, requireMutate } from '@/lib/api-helpers';
import { creditCuts, websites, users, creditCutEdits } from '@/db/schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db } = result;
    const err = requireAuth(result.user);
    if (err) return err;

    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const [cut] = await db
      .select({
        id: creditCuts.id,
        websiteId: creditCuts.websiteId,
        userIdInput: creditCuts.userIdInput,
        userFull: creditCuts.userFull,
        displayCurrency: creditCuts.displayCurrency,
        amountMinor: creditCuts.amountMinor,
        cutReason: creditCuts.cutReason,
        createdBy: creditCuts.createdBy,
        createdAt: creditCuts.createdAt,
        deletedAt: creditCuts.deletedAt,
        deletedBy: creditCuts.deletedBy,
        deleteReason: creditCuts.deleteReason,
        websiteName: websites.name,
        websitePrefix: websites.prefix,
        createdByUsername: users.username,
      })
      .from(creditCuts)
      .leftJoin(websites, eq(creditCuts.websiteId, websites.id))
      .leftJoin(users, eq(creditCuts.createdBy, users.id))
      .where(eq(creditCuts.id, idNum))
      .limit(1);

    if (!cut) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const edits = await db
      .select({
        id: creditCutEdits.id,
        editedBy: creditCutEdits.editedBy,
        editReason: creditCutEdits.editReason,
        beforeSnapshot: creditCutEdits.beforeSnapshot,
        afterSnapshot: creditCutEdits.afterSnapshot,
        editedAt: creditCutEdits.editedAt,
      })
      .from(creditCutEdits)
      .where(eq(creditCutEdits.creditCutId, idNum))
      .orderBy(creditCutEdits.editedAt);

    const editUserIds = [...new Set(edits.map((e) => e.editedBy))];
    const needDeletedBy = cut.deletedBy != null && !editUserIds.includes(cut.deletedBy);
    const userIdsToFetch = needDeletedBy
      ? [...editUserIds, cut.deletedBy!]
      : editUserIds;

    const userRows = userIdsToFetch.length > 0
      ? await db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, userIdsToFetch))
      : [];
    const userMap = new Map(userRows.map((u) => [u.id, u.username]));

    const editWithUsers = edits.map((e) => ({
      ...e,
      editedByUsername: userMap.get(e.editedBy) ?? '?',
    }));

    const deletedByUsername = cut.deletedBy ? (userMap.get(cut.deletedBy) ?? '?') : null;

    return NextResponse.json({
      ...cut,
      deletedByUsername,
      edits: editWithUsers,
    });
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
    const err = requireMutate(user);
    if (err) return err;

    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = (await request.json()) as { deleteReason?: string } | null;
    const deleteReason = typeof body?.deleteReason === 'string' ? body.deleteReason.trim() : '';
    if (!deleteReason) {
      return NextResponse.json(
        { error: 'ต้องระบุเหตุผลในการลบ' },
        { status: 400 }
      );
    }

    const [c] = await db
      .select({ id: creditCuts.id })
      .from(creditCuts)
      .where(and(eq(creditCuts.id, idNum), isNull(creditCuts.deletedAt)))
      .limit(1);

    if (!c) {
      return NextResponse.json({ error: 'Not found or already deleted' }, { status: 404 });
    }

    const now = new Date();
    await db
      .update(creditCuts)
      .set({
        deletedAt: now,
        deletedBy: user!.id,
        deleteReason,
      })
      .where(eq(creditCuts.id, idNum));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
