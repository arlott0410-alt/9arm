import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth } from '@/lib/api-helpers';
import { creditCuts } from '@/db/schema';
import { eq, gte, lte, and, isNull } from 'drizzle-orm';
import { todayStrThailand } from '@/lib/utils';
import { getSettingValueCached } from '@/lib/get-setting-cached';
import { dedupeRequest } from '@/lib/request-dedup';

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db } = result;
    const err = requireAuth(result.user);
    if (err) return err;

    const url = new URL(request.url);
    const dedupeKey = `reports-credit-cuts:${url.searchParams.toString()}`;
    const payload = await dedupeRequest(dedupeKey, async () => {
    const period = url.searchParams.get('period') || 'daily';
    const year = url.searchParams.get('year');
    const month = url.searchParams.get('month');
    const dateFromParam = url.searchParams.get('dateFrom');
    const dateToParam = url.searchParams.get('dateTo');
    const websiteId = url.searchParams.get('websiteId');

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
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate().toString().padStart(2, '0');
      dateTo = `${year}-${month.padStart(2, '0')}-${lastDay}`;
    } else if (period === 'yearly' && year) {
      dateFrom = `${year}-01-01`;
      dateTo = `${year}-12-31`;
    } else {
      dateFrom = today;
      dateTo = today;
    }

    const conditions: Parameters<typeof and>[0][] = [
      gte(creditCuts.cutTime, dateFrom + 'T00:00'),
      lte(creditCuts.cutTime, dateTo + 'T23:59'),
      isNull(creditCuts.deletedAt),
    ];
    if (websiteId) conditions.push(eq(creditCuts.websiteId, parseInt(websiteId)));

    const displayCurrencyRaw = await getSettingValueCached(db, 'DISPLAY_CURRENCY');
    const displayCurrency: string =
      typeof displayCurrencyRaw === 'string' ? displayCurrencyRaw : 'THB';

    const rows = await db
      .select({ amountMinor: creditCuts.amountMinor })
      .from(creditCuts)
      .where(and(...conditions));

    let total = 0;
    for (const r of rows) {
      total += r.amountMinor;
    }

    return {
      displayCurrency,
      period,
      dateFrom,
      dateTo,
      total: Math.round(total),
    };
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
