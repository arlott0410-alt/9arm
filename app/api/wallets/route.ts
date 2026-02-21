import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth, requireWallets } from '@/lib/api-helpers';
import { wallets, transactions, transfers } from '@/db/schema';
import { walletSchema } from '@/lib/validations';
import { eq, and, sql } from 'drizzle-orm';

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

    const withBalances = await Promise.all(
      list.map(async (w) => {
        const [depRow] = await db
          .select({
            sum: sql<number>`coalesce(sum(${transactions.amountMinor}), 0)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.walletId, w.id),
              eq(transactions.type, 'DEPOSIT')
            )
          );
        const [withRow] = await db
          .select({
            sum: sql<number>`coalesce(sum(${transactions.amountMinor}), 0)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.walletId, w.id),
              eq(transactions.type, 'WITHDRAW')
            )
          );
        const [fromRow] = await db
          .select({
            sum: sql<number>`coalesce(sum(${transfers.fromWalletAmountMinor}), 0)`,
          })
          .from(transfers)
          .where(eq(transfers.fromWalletId, w.id));
        const [toRow] = await db
          .select({
            sum: sql<number>`coalesce(sum(${transfers.toWalletAmountMinor}), 0)`,
          })
          .from(transfers)
          .where(eq(transfers.toWalletId, w.id));
        const dep = Number((depRow as { sum: number })?.sum ?? 0);
        const wth = Number((withRow as { sum: number })?.sum ?? 0);
        const from = Number((fromRow as { sum: number })?.sum ?? 0);
        const to = Number((toRow as { sum: number })?.sum ?? 0);
        const balance =
          w.openingBalanceMinor + dep - wth - from + to;
        return { ...w, balance };
      })
    );
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
