import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth, requireWallets } from '@/lib/api-helpers';
import { wallets, transactions, transfers } from '@/db/schema';
import { eq, and, or, sql } from 'drizzle-orm';

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

    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.id, idNum))
      .limit(1);
    if (!wallet) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const depositSum = await db
      .select({
        sum: sql<number>`coalesce(sum(${transactions.amountMinor}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.walletId, idNum),
          eq(transactions.type, 'DEPOSIT')
        )
      );
    const withdrawSum = await db
      .select({
        sum: sql<number>`coalesce(sum(${transactions.amountMinor}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.walletId, idNum),
          eq(transactions.type, 'WITHDRAW')
        )
      );
    const fromSum = await db
      .select({
        sum: sql<number>`coalesce(sum(${transfers.fromWalletAmountMinor}), 0)`,
      })
      .from(transfers)
      .where(eq(transfers.fromWalletId, idNum));
    const toSum = await db
      .select({
        sum: sql<number>`coalesce(sum(${transfers.toWalletAmountMinor}), 0)`,
      })
      .from(transfers)
      .where(eq(transfers.toWalletId, idNum));

    const depositTotal = Number((depositSum[0] as { sum: number })?.sum ?? 0);
    const withdrawTotal = Number((withdrawSum[0] as { sum: number })?.sum ?? 0);
    const fromTotal = Number((fromSum[0] as { sum: number })?.sum ?? 0);
    const toTotal = Number((toSum[0] as { sum: number })?.sum ?? 0);

    const balance =
      wallet.openingBalanceMinor +
      depositTotal -
      withdrawTotal -
      fromTotal +
      toTotal;

    return NextResponse.json({ ...wallet, balance });
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
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
