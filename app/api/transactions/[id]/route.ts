export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth } from '@/lib/api-helpers';
import {
  transactions,
  websites,
  wallets,
  users,
  transactionEdits,
} from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user } = await getDbAndUser(request);
    const err = requireAuth(user);
    if (err) return err;

    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const [txn] = await db
      .select({
        id: transactions.id,
        txnDate: transactions.txnDate,
        type: transactions.type,
        websiteId: transactions.websiteId,
        userIdInput: transactions.userIdInput,
        userFull: transactions.userFull,
        walletId: transactions.walletId,
        displayCurrency: transactions.displayCurrency,
        rateSnapshot: transactions.rateSnapshot,
        amountMinor: transactions.amountMinor,
        depositSlipTime: transactions.depositSlipTime,
        depositSystemTime: transactions.depositSystemTime,
        withdrawInputAmountMinor: transactions.withdrawInputAmountMinor,
        withdrawSystemTime: transactions.withdrawSystemTime,
        withdrawSlipTime: transactions.withdrawSlipTime,
        createdAt: transactions.createdAt,
        updatedAt: transactions.updatedAt,
        createdBy: transactions.createdBy,
        websiteName: websites.name,
        websitePrefix: websites.prefix,
        walletName: wallets.name,
        walletCurrency: wallets.currency,
        createdByUsername: users.username,
      })
      .from(transactions)
      .leftJoin(websites, eq(transactions.websiteId, websites.id))
      .leftJoin(wallets, eq(transactions.walletId, wallets.id))
      .leftJoin(users, eq(transactions.createdBy, users.id))
      .where(eq(transactions.id, idNum))
      .limit(1);

    if (!txn) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const edits = await db
      .select({
        id: transactionEdits.id,
        editedBy: transactionEdits.editedBy,
        editReason: transactionEdits.editReason,
        beforeSnapshot: transactionEdits.beforeSnapshot,
        afterSnapshot: transactionEdits.afterSnapshot,
        editedAt: transactionEdits.editedAt,
      })
      .from(transactionEdits)
      .where(eq(transactionEdits.transactionId, idNum))
      .orderBy(transactionEdits.editedAt);

    const editWithUsers = await Promise.all(
      edits.map(async (e) => {
        const [u] = await db
          .select({ username: users.username })
          .from(users)
          .where(eq(users.id, e.editedBy))
          .limit(1);
        return { ...e, editedByUsername: u?.username ?? '?' };
      })
    );

    return NextResponse.json({
      ...txn,
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
