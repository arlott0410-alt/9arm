import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth } from '@/lib/api-helpers';
import { transactions, transfers, settings } from '@/db/schema';
import { eq, sql, gte, lte, and } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireAuth(user);
    if (err) return err;

    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'daily'; // daily | monthly | yearly | custom
    const year = url.searchParams.get('year');
    const month = url.searchParams.get('month');
    const dateFromParam = url.searchParams.get('dateFrom');
    const dateToParam = url.searchParams.get('dateTo');

    const today = new Date().toISOString().slice(0, 10);

    let dateFrom = '';
    let dateTo = today;

    if (dateFromParam && dateToParam && /^\d{4}-\d{2}-\d{2}$/.test(dateFromParam) && /^\d{4}-\d{2}-\d{2}$/.test(dateToParam) && dateFromParam <= dateToParam) {
      dateFrom = dateFromParam;
      dateTo = dateToParam;
    } else if (period === 'daily' && dateFromParam && /^\d{4}-\d{2}-\d{2}$/.test(dateFromParam)) {
      dateFrom = dateFromParam;
      dateTo = dateFromParam;
    } else if (period === 'daily') {
      dateFrom = today;
      dateTo = today;
    } else if (period === 'monthly' && year && month) {
      dateFrom = `${year}-${month.padStart(2, '0')}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0)
        .getDate()
        .toString()
        .padStart(2, '0');
      dateTo = `${year}-${month.padStart(2, '0')}-${lastDay}`;
    } else if (period === 'yearly' && year) {
      dateFrom = `${year}-01-01`;
      dateTo = `${year}-12-31`;
    } else {
      dateFrom = today;
      dateTo = today;
    }

    const depResult = await db
      .select({
        sum: sql<number>`coalesce(sum(${transactions.amountMinor}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, 'DEPOSIT'),
          gte(transactions.txnDate, dateFrom),
          lte(transactions.txnDate, dateTo)
        )
      );
    const withResult = await db
      .select({
        sum: sql<number>`coalesce(sum(${transactions.amountMinor}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, 'WITHDRAW'),
          gte(transactions.txnDate, dateFrom),
          lte(transactions.txnDate, dateTo)
        )
      );

    const depositsTotal = Number(depResult[0]?.sum ?? 0);
    const withdrawsTotal = Number(withResult[0]?.sum ?? 0);
    const netTransactions = depositsTotal - withdrawsTotal;

    const intResult = await db
      .select({
        sum: sql<number>`coalesce(sum(${transfers.inputAmountMinor}), 0)`,
      })
      .from(transfers)
      .where(
        and(
          eq(transfers.type, 'INTERNAL'),
          gte(transfers.txnDate, dateFrom),
          lte(transfers.txnDate, dateTo)
        )
      );
    const extInResult = await db
      .select({
        sum: sql<number>`coalesce(sum(${transfers.toWalletAmountMinor}), 0)`,
      })
      .from(transfers)
      .where(
        and(
          eq(transfers.type, 'EXTERNAL_IN'),
          gte(transfers.txnDate, dateFrom),
          lte(transfers.txnDate, dateTo)
        )
      );
    const extOutResult = await db
      .select({
        sum: sql<number>`coalesce(sum(${transfers.fromWalletAmountMinor}), 0)`,
      })
      .from(transfers)
      .where(
        and(
          eq(transfers.type, 'EXTERNAL_OUT'),
          gte(transfers.txnDate, dateFrom),
          lte(transfers.txnDate, dateTo)
        )
      );

    const internalTotal = Number(intResult[0]?.sum ?? 0);
    const externalInTotal = Number(extInResult[0]?.sum ?? 0);
    const externalOutTotal = Number(extOutResult[0]?.sum ?? 0);
    const netExternal = externalInTotal - externalOutTotal;

    const [dcRow] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'DISPLAY_CURRENCY'))
      .limit(1);
    const displayCurrency =
      dcRow?.value && typeof dcRow.value === 'string'
        ? JSON.parse(dcRow.value)
        : 'THB';

    return NextResponse.json({
      displayCurrency,
      period,
      dateFrom,
      dateTo,
      transactions: {
        deposits: depositsTotal,
        withdraws: withdrawsTotal,
        net: netTransactions,
      },
      transfers: {
        internalTotal,
        externalInTotal,
        externalOutTotal,
        netExternal,
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
