import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth, requireMutate } from '@/lib/api-helpers';
import {
  bonuses,
  bonusCategories,
  websites,
  users,
  bonusEdits,
} from '@/db/schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { editBonusSchema } from '@/lib/validations';

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

    const [bonus] = await db
      .select({
        id: bonuses.id,
        websiteId: bonuses.websiteId,
        userIdInput: bonuses.userIdInput,
        userFull: bonuses.userFull,
        categoryId: bonuses.categoryId,
        displayCurrency: bonuses.displayCurrency,
        amountMinor: bonuses.amountMinor,
        bonusTime: bonuses.bonusTime,
        createdBy: bonuses.createdBy,
        createdAt: bonuses.createdAt,
        deletedAt: bonuses.deletedAt,
        deletedBy: bonuses.deletedBy,
        deleteReason: bonuses.deleteReason,
        websiteName: websites.name,
        websitePrefix: websites.prefix,
        categoryName: bonusCategories.name,
        createdByUsername: users.username,
      })
      .from(bonuses)
      .leftJoin(websites, eq(bonuses.websiteId, websites.id))
      .leftJoin(bonusCategories, eq(bonuses.categoryId, bonusCategories.id))
      .leftJoin(users, eq(bonuses.createdBy, users.id))
      .where(eq(bonuses.id, idNum))
      .limit(1);

    if (!bonus) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const edits = await db
      .select({
        id: bonusEdits.id,
        editedBy: bonusEdits.editedBy,
        editReason: bonusEdits.editReason,
        beforeSnapshot: bonusEdits.beforeSnapshot,
        afterSnapshot: bonusEdits.afterSnapshot,
        editedAt: bonusEdits.editedAt,
      })
      .from(bonusEdits)
      .where(eq(bonusEdits.bonusId, idNum))
      .orderBy(bonusEdits.editedAt);

    const editUserIds = [...new Set(edits.map((e) => e.editedBy))];
    const needDeletedBy = bonus.deletedBy != null && !editUserIds.includes(bonus.deletedBy);
    const userIdsToFetch = needDeletedBy
      ? [...editUserIds, bonus.deletedBy!]
      : editUserIds;

    const userRows = userIdsToFetch.length > 0
      ? await db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, userIdsToFetch))
      : [];
    const userMap = new Map(userRows.map((u) => [u.id, u.username]));

    const editWithUsers = edits.map((e) => ({
      ...e,
      editedByUsername: userMap.get(e.editedBy) ?? '?',
    }));

    const deletedByUsername = bonus.deletedBy ? (userMap.get(bonus.deletedBy) ?? '?') : null;

    return NextResponse.json({
      ...bonus,
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

    const [b] = await db
      .select({ id: bonuses.id })
      .from(bonuses)
      .where(and(eq(bonuses.id, idNum), isNull(bonuses.deletedAt)))
      .limit(1);

    if (!b) {
      return NextResponse.json({ error: 'Not found or already deleted' }, { status: 404 });
    }

    const now = new Date();
    await db
      .update(bonuses)
      .set({
        deletedAt: now,
        deletedBy: user!.id,
        deleteReason,
      })
      .where(eq(bonuses.id, idNum));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
