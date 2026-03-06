import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth } from '@/lib/api-helpers';
import { transactions, transfers, wallets } from '@/db/schema';
import { eq, sql, gte, lte, and, isNull } from 'drizzle-orm';
import { convertToDisplay, type Currency, type RateSnapshot } from '@/lib/rates';
import { todayStrThailand } from '@/lib/utils';
import { getSettingValueCached } from '@/lib/get-setting-cached';
import { dedupeRequest } from '@/lib/request-dedup';
import { reportsResponseCache, getDataCacheVersion, unwrapDataCacheValue } from '@/lib/d1-cache';

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user, env } = result;
    const err = requireAuth(user);
    if (err) return err;

    const url = new URL(request.url);
    const dedupeKey = `reports:${url.searchParams.toString()}`;
    const currentVer = env.KV ? await getDataCacheVersion(env) : 0;
    const raw = reportsResponseCache.get(dedupeKey);
    const cached = unwrapDataCacheValue<unknown>(raw, currentVer);
    if (cached !== undefined) return NextResponse.json(cached);
    if (raw !== undefined && currentVer > 0) reportsResponseCache.invalidate(dedupeKey);

    const payload = await dedupeRequest(dedupeKey, async () => {
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
          currency: wallets.currency,
          sumMinor: sql<number>`coalesce(sum(${transactions.amountMinor}), 0)`,
        })
        .from(transactions)
        .leftJoin(wallets, eq(transactions.walletId, wallets.id))
        .where(and(...txnConditionsDep))
        .groupBy(wallets.currency),
      db
        .select({
          currency: wallets.currency,
          sumMinor: sql<number>`coalesce(sum(${transactions.amountMinor} + coalesce(${transactions.withdrawFeeMinor}, 0)), 0)`,
        })
        .from(transactions)
        .leftJoin(wallets, eq(transactions.walletId, wallets.id))
        .where(and(...txnConditionsWith))
        .groupBy(wallets.currency),
    ]);

    // D1 returns one row per currency (GROUP BY); null currency treated as THB
    let depositsTotal = 0;
    for (const r of depRows) {
      const currency = (r.currency ?? 'THB') as Currency;
      depositsTotal += convertToDisplay(Number(r.sumMinor ?? 0), currency, displayCurrency, rates);
    }
    let withdrawsTotal = 0;
    for (const r of withRows) {
      const currency = (r.currency ?? 'THB') as Currency;
      withdrawsTotal += convertToDisplay(Number(r.sumMinor ?? 0), currency, displayCurrency, rates);
    }
    depositsTotal = Math.round(depositsTotal);
    withdrawsTotal = Math.round(withdrawsTotal);
    const netTransactions = depositsTotal - withdrawsTotal;

    const transferConditions: Parameters<typeof and>[0][] = [
      gte(transfers.txnDate, dateFrom),
      lte(transfers.txnDate, dateTo),
      isNull(transfers.deletedAt),
    ];

    const [intRows, extInRows, extOutRows, feeRows] = await Promise.all([
      db
        .select({
          currency: wallets.currency,
          sumMinor: sql<number>`coalesce(sum(${transfers.fromWalletAmountMinor}), 0)`,
        })
        .from(transfers)
        .innerJoin(wallets, eq(transfers.fromWalletId, wallets.id))
        .where(and(eq(transfers.type, 'INTERNAL'), ...transferConditions))
        .groupBy(wallets.currency),
      db
        .select({
          currency: wallets.currency,
          sumMinor: sql<number>`coalesce(sum(${transfers.toWalletAmountMinor}), 0)`,
        })
        .from(transfers)
        .innerJoin(wallets, eq(transfers.toWalletId, wallets.id))
        .where(and(eq(transfers.type, 'EXTERNAL_IN'), ...transferConditions))
        .groupBy(wallets.currency),
      db
        .select({
          currency: wallets.currency,
          sumMinor: sql<number>`coalesce(sum(${transfers.fromWalletAmountMinor}), 0)`,
        })
        .from(transfers)
        .innerJoin(wallets, eq(transfers.fromWalletId, wallets.id))
        .where(and(eq(transfers.type, 'EXTERNAL_OUT'), ...transferConditions))
        .groupBy(wallets.currency),
      db
        .select({
          currency: wallets.currency,
          sumMinor: sql<number>`coalesce(sum(${transactions.withdrawFeeMinor}), 0)`,
        })
        .from(transactions)
        .innerJoin(wallets, eq(transactions.walletId, wallets.id))
        .where(and(eq(transactions.type, 'WITHDRAW'), ...txnConditionsWith))
        .groupBy(wallets.currency),
    ]);

    const internalByCurrency: Record<string, number> = {};
    for (const r of intRows) {
      const cur = r.currency ?? 'THB';
      const v = Number(r.sumMinor ?? 0);
      if (v !== 0) internalByCurrency[cur] = (internalByCurrency[cur] ?? 0) + v;
    }
    const externalInByCurrency: Record<string, number> = {};
    for (const r of extInRows) {
      const cur = r.currency ?? 'THB';
      const v = Number(r.sumMinor ?? 0);
      if (v !== 0) externalInByCurrency[cur] = (externalInByCurrency[cur] ?? 0) + v;
    }
    const externalOutByCurrency: Record<string, number> = {};
    for (const r of extOutRows) {
      const cur = r.currency ?? 'THB';
      const v = Number(r.sumMinor ?? 0);
      if (v !== 0) externalOutByCurrency[cur] = (externalOutByCurrency[cur] ?? 0) + v;
    }
    const withdrawFeesByCurrency: Record<string, number> = {};
    for (const r of feeRows) {
      const cur = r.currency ?? 'THB';
      const fee = Number(r.sumMinor ?? 0);
      if (fee > 0) withdrawFeesByCurrency[cur] = (withdrawFeesByCurrency[cur] ?? 0) + fee;
    }

    const data = {
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
    };
    if (env.KV) {
      const ver = await getDataCacheVersion(env);
      reportsResponseCache.set(dedupeKey, { _v: ver, data });
    } else {
      reportsResponseCache.set(dedupeKey, data);
    }
    return data;
    });

    return NextResponse.json(payload);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
