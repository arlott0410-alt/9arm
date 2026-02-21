import type { Db } from '@/db';
import { wallets, transactions, transfers } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function getWalletBalance(db: Db, walletId: number): Promise<number> {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.id, walletId))
    .limit(1);
  if (!wallet) return 0;
  const [depositRow] = await db
    .select({
      sum: sql<number>`coalesce(sum(${transactions.amountMinor}), 0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.walletId, walletId), eq(transactions.type, 'DEPOSIT')));
  const [withdrawRow] = await db
    .select({
      sum: sql<number>`coalesce(sum(${transactions.amountMinor}), 0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.walletId, walletId), eq(transactions.type, 'WITHDRAW')));
  const [fromRow] = await db
    .select({
      sum: sql<number>`coalesce(sum(${transfers.fromWalletAmountMinor}), 0)`,
    })
    .from(transfers)
    .where(eq(transfers.fromWalletId, walletId));
  const [toRow] = await db
    .select({
      sum: sql<number>`coalesce(sum(${transfers.toWalletAmountMinor}), 0)`,
    })
    .from(transfers)
    .where(eq(transfers.toWalletId, walletId));
  const depTotal = Number((depositRow as { sum: number })?.sum ?? 0);
  const wthTotal = Number((withdrawRow as { sum: number })?.sum ?? 0);
  const fromTotal = Number((fromRow as { sum: number })?.sum ?? 0);
  const toTotal = Number((toRow as { sum: number })?.sum ?? 0);
  return wallet.openingBalanceMinor + depTotal - wthTotal - fromTotal + toTotal;
}
