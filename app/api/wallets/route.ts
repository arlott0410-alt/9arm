import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth, requireWallets } from '@/lib/api-helpers';
import { wallets, transactions, transfers } from '@/db/schema';
import { walletSchema } from '@/lib/validations';
import { eq, and, sql, isNull } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireAuth(user);
    if (err) return err;

    const url = new URL(request.url);
    const withBalance = url.searchParams.get('withBalance') === '1';

    const list = await db.select().from(wallets).orderBy(wallets.name);

    if (!withBalance) {
      return NextResponse.json(list);
    }

    // Grouped aggregations: 4 queries total instead of 4 per wallet
    const [depRows, withRows, fromRows, toRows] = await Promise.all([
      db
        .select({
          walletId: transactions.walletId,
          sum: sql<number>`coalesce(sum(${transactions.amountMinor}), 0)`,
        })
        .from(transactions)
        .where(and(eq(transactions.type, 'DEPOSIT'), isNull(transactions.deletedAt)))
        .groupBy(transactions.walletId),
      db
        .select({
          walletId: transactions.walletId,
          sum: sql<number>`coalesce(sum(${transactions.amountMinor} + coalesce(${transactions.withdrawFeeMinor}, 0)), 0)`,
        })
        .from(transactions)
        .where(and(eq(transactions.type, 'WITHDRAW'), isNull(transactions.deletedAt)))
        .groupBy(transactions.walletId),
      db
        .select({
          walletId: transfers.fromWalletId,
          sum: sql<number>`coalesce(sum(${transfers.fromWalletAmountMinor}), 0)`,
        })
        .from(transfers)
        .where(isNull(transfers.deletedAt))
        .groupBy(transfers.fromWalletId),
      db
        .select({
          walletId: transfers.toWalletId,
          sum: sql<number>`coalesce(sum(${transfers.toWalletAmountMinor}), 0)`,
        })
        .from(transfers)
        .where(isNull(transfers.deletedAt))
        .groupBy(transfers.toWalletId),
    ]);

    const depByWallet = new Map<number, number>();
    for (const r of depRows) {
      if (r.walletId != null) depByWallet.set(r.walletId, Number(r.sum ?? 0));
    }
    const withByWallet = new Map<number, number>();
    for (const r of withRows) {
      if (r.walletId != null) withByWallet.set(r.walletId, Number(r.sum ?? 0));
    }
    const fromByWallet = new Map<number, number>();
    for (const r of fromRows) {
      if (r.walletId != null) fromByWallet.set(r.walletId, Number(r.sum ?? 0));
    }
    const toByWallet = new Map<number, number>();
    for (const r of toRows) {
      if (r.walletId != null) toByWallet.set(r.walletId, Number(r.sum ?? 0));
    }

    const withBalances = list.map((w) => {
      const dep = depByWallet.get(w.id) ?? 0;
      const wth = withByWallet.get(w.id) ?? 0;
      const from = fromByWallet.get(w.id) ?? 0;
      const to = toByWallet.get(w.id) ?? 0;
      const balance = w.openingBalanceMinor + dep - wth - from + to;
      return { ...w, balance };
    });
    return NextResponse.json(withBalances);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireWallets(user);
    if (err) return err;

    const body = await request.json();
    const parsed = walletSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const now = new Date();
    const [inserted] = await db
      .insert(wallets)
      .values({
        name: parsed.data.name,
        currency: parsed.data.currency,
        openingBalanceMinor: parsed.data.openingBalanceMinor,
        createdAt: now,
      })
      .returning();
    return NextResponse.json(inserted);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
