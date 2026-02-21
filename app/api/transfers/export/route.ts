export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth } from '@/lib/api-helpers';
import { transfers, wallets, users } from '@/db/schema';
import { eq, gte, lte, and } from 'drizzle-orm';
import { formatMinorToDisplay } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const { db, user } = await getDbAndUser(request);
    const err = requireAuth(user);
    if (err) return err;

    const url = new URL(request.url);
    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo = url.searchParams.get('dateTo') || '';

    const conditions: Parameters<typeof and>[0][] = [];
    if (dateFrom) conditions.push(gte(transfers.txnDate, dateFrom));
    if (dateTo) conditions.push(lte(transfers.txnDate, dateTo));

    const baseQuery = db
      .select()
      .from(transfers)
      .orderBy(transfers.txnDate, transfers.id);

    const list =
      conditions.length > 0
        ? await baseQuery.where(and(...conditions))
        : await baseQuery;

    const withNames = await Promise.all(
      list.map(async (t) => {
        let fromName = '';
        let toName = '';
        let createdByUsername = '';
        if (t.fromWalletId) {
          const [w] = await db
            .select({ name: wallets.name })
            .from(wallets)
            .where(eq(wallets.id, t.fromWalletId))
            .limit(1);
          fromName = w?.name ?? '';
        }
        if (t.toWalletId) {
          const [w] = await db
            .select({ name: wallets.name })
            .from(wallets)
            .where(eq(wallets.id, t.toWalletId))
            .limit(1);
          toName = w?.name ?? '';
        }
        const [u] = await db
          .select({ username: users.username })
          .from(users)
          .where(eq(users.id, t.createdBy))
          .limit(1);
        createdByUsername = u?.username ?? '';
        return { ...t, fromWalletName: fromName, toWalletName: toName, createdByUsername };
      })
    );

    const header = [
      'id',
      'txnDate',
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
      r.createdByUsername,
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
