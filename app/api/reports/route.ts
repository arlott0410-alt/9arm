import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth } from '@/lib/api-helpers';
import { transactions, transfers, wallets } from '@/db/schema';
import { eq, sql, gte, lte, and, isNull } from 'drizzle-orm';
import { convertToDisplay, type Currency, type RateSnapshot } from '@/lib/rates';
import { todayStrThailand } from '@/lib/utils';
import { getSettingValueCached } from '@/lib/get-setting-cached';

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireAuth(user);
    if (err) return err;

    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'daily'; // daily | monthly | yearly | custom
    const websiteId = url.searchParams.get('websiteId');
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

    const txnConditionsDep: Parameters<typeof and>[0][] = [
      eq(transactions.type, 'DEPOSIT'),
      gte(transactions.txnDate, dateFrom),
      lte(transactions.txnDate, dateTo),
      isNull(transactions.deletedAt),
    ];
    const txnConditionsWith: Parameters<typeof and>[0][] = [
      eq(transactions.type, 'WITHDRAW'),
      gte(transactions.txnDate, dateFrom),
      lte(transactions.txnDate, dateTo),
      isNull(transactions.deletedAt),
    ];
    if (websiteId) {
      txnConditionsDep.push(eq(transactions.websiteId, parseInt(websiteId)));
      txnConditionsWith.push(eq(transactions.websiteId, parseInt(websiteId)));
    }

    const [displayCurrency, rates, depRows, withRows] = await Promise.all([
      getSettingValueCached(db, 'DISPLAY_CURRENCY').then(
        (v) => (typeof v === 'string' ? v : 'THB') as Currency
      ),
      getSettingValueCached(db, 'EXCHANGE_RATES').then(
        (v) => (v && typeof v === 'object' ? (v as RateSnapshot) : {})
      ),
      db
        .select({
          amountMinor: transactions.amountMinor,
          walletCurrency: wallets.currency,
        })
        .from(transactions)
        .leftJoin(wallets, eq(transactions.walletId, wallets.id))
        .where(and(...txnConditionsDep)),
      db
        .select({
          amountMinor: transactions.amountMinor,
          walletCurrency: wallets.currency,
        })
        .from(transactions)
        .leftJoin(wallets, eq(transactions.walletId, wallets.id))
        .where(and(...txnConditionsWith)),
    ]);


    let depositsTotal = 0;
    for (const r of depRows) {
      const walletCurrency = (r.walletCurrency ?? 'THB') as Currency;
      depositsTotal += convertToDisplay(
        r.amountMinor,
        walletCurrency,
        displayCurrency,
        rates
      );
    }
    let withdrawsTotal = 0;
    for (const r of withRows) {
      const walletCurrency = (r.walletCurrency ?? 'THB') as Currency;
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

    const transferConditions: Parameters<typeof and>[0][] = [
      gte(transfers.txnDate, dateFrom),
      lte(transfers.txnDate, dateTo),
      isNull(transfers.deletedAt),
    ];

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
          ...transferConditions
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
          ...transferConditions
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
          ...transferConditions
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

    const feeRows = await db
      .select({
        fee: transactions.withdrawFeeMinor,
        currency: wallets.currency,
      })
      .from(transactions)
      .innerJoin(wallets, eq(transactions.walletId, wallets.id))
      .where(and(
        eq(transactions.type, 'WITHDRAW'),
        ...txnConditionsWith
      ));
    const withdrawFeesByCurrency: Record<string, number> = {};
    for (const r of feeRows) {
      const cur = r.currency ?? 'THB';
      const fee = Number(r.fee ?? 0);
      if (fee > 0) {
        withdrawFeesByCurrency[cur] = (withdrawFeesByCurrency[cur] ?? 0) + fee;
      }
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
      withdrawFeesByCurrency,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
