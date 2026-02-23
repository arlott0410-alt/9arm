import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth } from '@/lib/api-helpers';
import { transfers, wallets, users } from '@/db/schema';
import { eq, gte, lte, and, isNull, alias } from 'drizzle-orm';

const fromWallet = alias(wallets, 'from_wallet');
const toWallet = alias(wallets, 'to_wallet');

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

    const conditions: Parameters<typeof and>[0][] = [];
    if (dateFrom) conditions.push(gte(transfers.txnDate, dateFrom));
    if (dateTo) conditions.push(lte(transfers.txnDate, dateTo));
    conditions.push(isNull(transfers.deletedAt));

    // Single query with joins instead of N+1 per-row lookups
    const withNames = await db
      .select({
        id: transfers.id,
        txnDate: transfers.txnDate,
        txnTime: transfers.txnTime,
        type: transfers.type,
        fromWalletId: transfers.fromWalletId,
        fromWalletName: fromWallet.name,
        toWalletId: transfers.toWalletId,
        toWalletName: toWallet.name,
        displayCurrency: transfers.displayCurrency,
        inputAmountMinor: transfers.inputAmountMinor,
        fromWalletAmountMinor: transfers.fromWalletAmountMinor,
        toWalletAmountMinor: transfers.toWalletAmountMinor,
        note: transfers.note,
        createdByUsername: users.username,
        createdAt: transfers.createdAt,
      })
      .from(transfers)
      .leftJoin(fromWallet, eq(transfers.fromWalletId, fromWallet.id))
      .leftJoin(toWallet, eq(transfers.toWalletId, toWallet.id))
      .leftJoin(users, eq(transfers.createdBy, users.id))
      .where(and(...conditions))
      .orderBy(transfers.txnDate, transfers.id);

    const header = [
      'id',
      'txnDate',
      'txnTime',
      'type',
      'fromWalletId',
      'fromWalletName',
      'toWalletId',
      'toWalletName',
      'displayCurrency',
      'inputAmountMinor',
      'fromWalletAmountMinor',
      'toWalletAmountMinor',
      'note',
      'createdByUsername',
      'createdAt',
    ];

    const rows = withNames.map((r) => [
      r.id,
      r.txnDate,
      r.txnTime ?? '',
      r.type,
      r.fromWalletId ?? '',
      r.fromWalletName ?? '',
      r.toWalletId ?? '',
      r.toWalletName ?? '',
      r.displayCurrency,
      r.inputAmountMinor,
      r.fromWalletAmountMinor ?? '',
      r.toWalletAmountMinor ?? '',
      r.note ?? '',
      r.createdByUsername ?? '',
      r.createdAt,
    ]);

    const csv = [
      header.join(','),
      ...rows.map((row) =>
        row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="transfers-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store, private',
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
