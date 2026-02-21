import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth } from '@/lib/api-helpers';
import { transactions, transfers, settings, wallets } from '@/db/schema';
import { eq, sql, gte, lte, and } from 'drizzle-orm';
import { convertToDisplay, type Currency, type RateSnapshot } from '@/lib/rates';
import { todayStrThailand } from '@/lib/utils';

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

    const today = todayStrThailand();

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

    const [dcRow, ratesRow, depRows, withRows] = await Promise.all([
      db.select().from(settings).where(eq(settings.key, 'DISPLAY_CURRENCY')).limit(1),
      db.select().from(settings).where(eq(settings.key, 'EXCHANGE_RATES')).limit(1),
      db
        .select({
          amountMinor: transactions.amountMinor,
          walletId: transactions.walletId,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.type, 'DEPOSIT'),
            gte(transactions.txnDate, dateFrom),
            lte(transactions.txnDate, dateTo)
          )
        ),
      db
        .select({
          amountMinor: transactions.amountMinor,
          walletId: transactions.walletId,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.type, 'WITHDRAW'),
            gte(transactions.txnDate, dateFrom),
            lte(transactions.txnDate, dateTo)
          )
        ),
    ]);

    const displayCurrency: Currency =
      (dcRow[0]?.value && typeof dcRow[0].value === 'string' && JSON.parse(dcRow[0].value)) || 'THB';
    const rates: RateSnapshot =
      ratesRow[0]?.value && typeof ratesRow[0].value === 'string'
        ? JSON.parse(ratesRow[0].value)
        : {};

    let depositsTotal = 0;
    for (const r of depRows) {
      const [w] = await db
        .select({ currency: wallets.currency })
        .from(wallets)
        .where(eq(wallets.id, r.walletId))
        .limit(1);
      const walletCurrency = (w?.currency ?? 'THB') as Currency;
      depositsTotal += convertToDisplay(
        r.amountMinor,
        walletCurrency,
        displayCurrency,
        rates
      );
    }
    let withdrawsTotal = 0;
    for (const r of withRows) {
      const [w] = await db
        .select({ currency: wallets.currency })
        .from(wallets)
        .where(eq(wallets.id, r.walletId))
        .limit(1);
      const walletCurrency = (w?.currency ?? 'THB') as Currency;
      withdrawsTotal += convertToDisplay(
        r.amountMinor,
        walletCurrency,
        displayCurrency,
        rates
      );
    }
    depositsTotal = Math.round(depositsTotal);
    withdrawsTotal = Math.round(withdrawsTotal);
    const netTransactions = depositsTotal - withdrawsTotal;

    const intRows = await db
      .select({
        amount: transfers.fromWalletAmountMinor,
        currency: wallets.currency,
      })
      .from(transfers)
      .innerJoin(wallets, eq(transfers.fromWalletId, wallets.id))
      .where(
        and(
          eq(transfers.type, 'INTERNAL'),
          gte(transfers.txnDate, dateFrom),
          lte(transfers.txnDate, dateTo)
        )
      );
    const extInRows = await db
      .select({
        amount: transfers.toWalletAmountMinor,
        currency: wallets.currency,
      })
      .from(transfers)
      .innerJoin(wallets, eq(transfers.toWalletId, wallets.id))
      .where(
        and(
          eq(transfers.type, 'EXTERNAL_IN'),
          gte(transfers.txnDate, dateFrom),
          lte(transfers.txnDate, dateTo)
        )
      );
    const extOutRows = await db
      .select({
        amount: transfers.fromWalletAmountMinor,
        currency: wallets.currency,
      })
      .from(transfers)
      .innerJoin(wallets, eq(transfers.fromWalletId, wallets.id))
      .where(
        and(
          eq(transfers.type, 'EXTERNAL_OUT'),
          gte(transfers.txnDate, dateFrom),
          lte(transfers.txnDate, dateTo)
        )
      );

    const externalInByCurrency: Record<string, number> = {};
    for (const r of extInRows) {
      const cur = r.currency ?? 'THB';
      externalInByCurrency[cur] = (externalInByCurrency[cur] ?? 0) + Number(r.amount ?? 0);
    }
    const externalOutByCurrency: Record<string, number> = {};
    for (const r of extOutRows) {
      const cur = r.currency ?? 'THB';
      externalOutByCurrency[cur] = (externalOutByCurrency[cur] ?? 0) + Number(r.amount ?? 0);
    }

    const internalByCurrency: Record<string, number> = {};
    for (const r of intRows) {
      const cur = r.currency ?? 'THB';
      internalByCurrency[cur] = (internalByCurrency[cur] ?? 0) + Number(r.amount ?? 0);
    }

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
        internalByCurrency,
        externalInByCurrency,
        externalOutByCurrency,
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
