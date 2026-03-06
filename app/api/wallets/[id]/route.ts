import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth, requireWallets } from '@/lib/api-helpers';
import { wallets, transactions, transfers } from '@/db/schema';
import { eq, and, or, sql, isNull } from 'drizzle-orm';
import { invalidateDataCaches, invalidateWalletDetails, walletDetailCache, walletDetailCacheKey } from '@/lib/d1-cache';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireAuth(user);
    if (err) return err;

    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const cacheKey = walletDetailCacheKey(idNum);
    const cached = walletDetailCache.get(cacheKey);
    if (cached !== undefined) return NextResponse.json(cached);

    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.id, idNum))
      .limit(1);
    if (!wallet) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Single query for transaction sums (2 aggregates) + single query for transfer sums (2 aggregates) — 3 D1 round-trips total to reduce CPU
    const [txnSums, xferSums] = await Promise.all([
      db
        .select({
          dep: sql<number>`coalesce(sum(case when ${transactions.type} = 'DEPOSIT' then ${transactions.amountMinor} else 0 end), 0)`,
          withdraw: sql<number>`coalesce(sum(case when ${transactions.type} = 'WITHDRAW' then ${transactions.amountMinor} + coalesce(${transactions.withdrawFeeMinor}, 0) else 0 end), 0)`,
        })
        .from(transactions)
        .where(and(eq(transactions.walletId, idNum), isNull(transactions.deletedAt))),
      db
        .select({
          fromSum: sql<number>`coalesce(sum(case when ${transfers.fromWalletId} = ${idNum} then ${transfers.fromWalletAmountMinor} else 0 end), 0)`,
          toSum: sql<number>`coalesce(sum(case when ${transfers.toWalletId} = ${idNum} then ${transfers.toWalletAmountMinor} else 0 end), 0)`,
        })
        .from(transfers)
        .where(and(or(eq(transfers.fromWalletId, idNum), eq(transfers.toWalletId, idNum)), isNull(transfers.deletedAt))),
    ]);

    const depositTotal = Number((txnSums[0] as { dep: number; withdraw: number })?.dep ?? 0);
    const withdrawTotal = Number((txnSums[0] as { dep: number; withdraw: number })?.withdraw ?? 0);
    const fromTotal = Number((xferSums[0] as { fromSum: number; toSum: number })?.fromSum ?? 0);
    const toTotal = Number((xferSums[0] as { fromSum: number; toSum: number })?.toSum ?? 0);

    const balance =
      wallet.openingBalanceMinor +
      depositTotal -
      withdrawTotal -
      fromTotal +
      toTotal;

    const response = { ...wallet, balance };
    walletDetailCache.set(cacheKey, response);
    return NextResponse.json(response);
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
    const err = requireWallets(user);
    if (err) return err;

    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.id, idNum))
      .limit(1);
    if (!wallet) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const isSuperAdmin = user!.role === 'SUPER_ADMIN';

    if (!isSuperAdmin) {
      const [txnCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(transactions)
        .where(eq(transactions.walletId, idNum));
      const [fromCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(transfers)
        .where(eq(transfers.fromWalletId, idNum));
      const [toCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(transfers)
        .where(eq(transfers.toWalletId, idNum));

      const hasRefs =
        Number(txnCount?.count ?? 0) > 0 ||
        Number(fromCount?.count ?? 0) > 0 ||
        Number(toCount?.count ?? 0) > 0;

      if (hasRefs) {
        return NextResponse.json(
          { error: 'Cannot delete wallet with transactions or transfers' },
          { status: 400 }
        );
      }
    } else {
      await db.delete(transactions).where(eq(transactions.walletId, idNum));
      await db
        .delete(transfers)
        .where(
          or(
            eq(transfers.fromWalletId, idNum),
            eq(transfers.toWalletId, idNum)
          )
        );
    }

    await db.delete(wallets).where(eq(wallets.id, idNum));
    invalidateDataCaches(result.env);
    invalidateWalletDetails([idNum]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
