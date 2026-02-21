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
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { formatMinorToDisplay } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireAuth(user);
    if (err) return err;

    const url = new URL(request.url);
    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo = url.searchParams.get('dateTo') || '';
    const websiteId = url.searchParams.get('websiteId');
    const userFull = url.searchParams.get('userFull');
    const createdBy = url.searchParams.get('createdBy');
    const type = url.searchParams.get('type');
    const editedOnly = url.searchParams.get('editedOnly') === 'true';

    const conditions: Parameters<typeof and>[0][] = [];
    if (dateFrom) conditions.push(gte(transactions.txnDate, dateFrom));
    if (dateTo) conditions.push(lte(transactions.txnDate, dateTo));
    if (websiteId) conditions.push(eq(transactions.websiteId, parseInt(websiteId)));
    if (userFull) conditions.push(eq(transactions.userFull, userFull));
    if (createdBy) conditions.push(eq(transactions.createdBy, parseInt(createdBy)));
    if (type) conditions.push(eq(transactions.type, type as 'DEPOSIT' | 'WITHDRAW'));

    const baseQuery = db
      .select({
        id: transactions.id,
        txnDate: transactions.txnDate,
        type: transactions.type,
        websiteId: transactions.websiteId,
        userIdInput: transactions.userIdInput,
        userFull: transactions.userFull,
        walletId: transactions.walletId,
        displayCurrency: transactions.displayCurrency,
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
      .leftJoin(users, eq(transactions.createdBy, users.id));

    let list =
      conditions.length > 0
        ? await baseQuery.where(and(...conditions))
        : await baseQuery;

    if (editedOnly) {
      const editedIds = await db
        .selectDistinct({ transactionId: transactionEdits.transactionId })
        .from(transactionEdits);
      const idSet = new Set(editedIds.map((r) => r.transactionId));
      list = list.filter((r) => idSet.has(r.id));
    }

    const editMap = new Map<number, { lastEditedAt: Date; lastEditedBy: string; lastEditReason: string }>();
    for (const t of list) {
      const [lastEdit] = await db
        .select({
          editedAt: transactionEdits.editedAt,
          editedBy: transactionEdits.editedBy,
          editReason: transactionEdits.editReason,
        })
        .from(transactionEdits)
        .where(eq(transactionEdits.transactionId, t.id))
        .orderBy(desc(transactionEdits.editedAt))
        .limit(1);
      if (lastEdit) {
        const [u] = await db
          .select({ username: users.username })
          .from(users)
          .where(eq(users.id, lastEdit.editedBy))
          .limit(1);
        editMap.set(t.id, {
          lastEditedAt: lastEdit.editedAt as Date,
          lastEditedBy: u?.username ?? '?',
          lastEditReason: lastEdit.editReason,
        });
      }
    }

    const countMap = new Map<number, number>();
    for (const t of list) {
      const [c] = await db
        .select({ count: transactionEdits.id })
        .from(transactionEdits)
        .where(eq(transactionEdits.transactionId, t.id));
      const fullCount = await db
        .select()
        .from(transactionEdits)
        .where(eq(transactionEdits.transactionId, t.id));
      countMap.set(t.id, fullCount.length);
    }

    const rows = list.map((r) => {
      const inputAmount =
        r.type === 'DEPOSIT'
          ? r.amountMinor
          : (r.withdrawInputAmountMinor ?? r.amountMinor);
      const walletAmount = r.amountMinor;
      const edit = editMap.get(r.id);
      const editCount = countMap.get(r.id) ?? 0;
      return [
        r.id,
        r.type,
        r.txnDate,
        r.websiteName ?? '',
        r.websitePrefix ?? '',
        r.userIdInput,
        r.userFull,
        r.displayCurrency,
        formatMinorToDisplay(inputAmount, r.displayCurrency ?? 'THB'),
        r.walletName ?? '',
        r.walletCurrency ?? '',
        formatMinorToDisplay(walletAmount, r.walletCurrency ?? 'THB'),
        r.depositSlipTime ?? '',
        r.depositSystemTime ?? '',
        r.withdrawSystemTime ?? '',
        r.withdrawSlipTime ?? '',
        r.createdByUsername ?? '',
        r.createdAt,
        r.updatedAt,
        editCount,
        edit?.lastEditedAt ?? '',
        edit?.lastEditedBy ?? '',
        edit?.lastEditReason ?? '',
      ];
    });

    const header = [
      'id',
      'type',
      'txnDate',
      'websiteName',
      'websitePrefix',
      'userIdInput',
      'userFull',
      'displayCurrency',
      'inputAmount',
      'walletName',
      'walletCurrency',
      'walletAmount',
      'depositSlipTime',
      'depositSystemTime',
      'withdrawSystemTime',
      'withdrawSlipTime',
      'createdByUsername',
      'createdAt',
      'updatedAt',
      'editCount',
      'lastEditedAt',
      'lastEditedBy',
      'lastEditReason',
    ];

    const csv = [header.join(','), ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
