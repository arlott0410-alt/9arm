import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth } from '@/lib/api-helpers';
import { transfers, wallets, users } from '@/db/schema';
import { eq, gte, lte, and, isNull, inArray } from 'drizzle-orm';

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

    const list = await db
      .select()
      .from(transfers)
      .where(and(...conditions))
      .orderBy(transfers.txnDate, transfers.id);

    // Batch fetch wallet names and usernames instead of N+1
    const walletIds = [...new Set([
      ...list.map((t) => t.fromWalletId).filter((id): id is number => id != null),
      ...list.map((t) => t.toWalletId).filter((id): id is number => id != null),
    ])];
    const userIds = [...new Set(list.map((t) => t.createdBy).filter((id): id is number => id != null))];

    const [walletRows, userRows] = await Promise.all([
      walletIds.length > 0 ? db.select({ id: wallets.id, name: wallets.name }).from(wallets).where(inArray(wallets.id, walletIds)) : [],
      userIds.length > 0 ? db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, userIds)) : [],
    ]);

    const walletNameMap = new Map<number, string>();
    for (const w of walletRows) walletNameMap.set(w.id, w.name ?? '');
    const usernameMap = new Map<number, string>();
    for (const u of userRows) usernameMap.set(u.id, u.username ?? '');

    const withNames = list.map((t) => ({
      ...t,
      fromWalletName: t.fromWalletId ? walletNameMap.get(t.fromWalletId) ?? '' : '',
      toWalletName: t.toWalletId ? walletNameMap.get(t.toWalletId) ?? '' : '',
      createdByUsername: usernameMap.get(t.createdBy) ?? '',
    }));

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
