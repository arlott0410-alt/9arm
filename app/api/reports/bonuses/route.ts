import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth } from '@/lib/api-helpers';
import { bonuses, bonusCategories, settings } from '@/db/schema';
import { eq, gte, lte, and, isNull } from 'drizzle-orm';
import { todayStrThailand } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db } = result;
    const err = requireAuth(result.user);
    if (err) return err;

    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'daily';
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
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate().toString().padStart(2, '0');
      dateTo = `${year}-${month.padStart(2, '0')}-${lastDay}`;
    } else if (period === 'yearly' && year) {
      dateFrom = `${year}-01-01`;
      dateTo = `${year}-12-31`;
    } else {
      dateFrom = today;
      dateTo = today;
    }

    const [dcRow] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'DISPLAY_CURRENCY'))
      .limit(1);
    const displayCurrency: string =
      (dcRow?.value && typeof dcRow.value === 'string' && JSON.parse(dcRow.value)) || 'THB';

    const rows = await db
      .select({
        categoryId: bonuses.categoryId,
        categoryName: bonusCategories.name,
        amountMinor: bonuses.amountMinor,
        displayCurrency: bonuses.displayCurrency,
      })
      .from(bonuses)
      .innerJoin(bonusCategories, eq(bonuses.categoryId, bonusCategories.id))
      .where(
        and(
          gte(bonuses.bonusTime, dateFrom + 'T00:00'),
          lte(bonuses.bonusTime, dateTo + 'T23:59:59'),
          isNull(bonuses.deletedAt)
        )
      );

    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      byCategory[r.categoryName ?? 'อื่นๆ'] = (byCategory[r.categoryName ?? 'อื่นๆ'] ?? 0) + r.amountMinor;
      total += r.amountMinor;
    }

    return NextResponse.json({
      displayCurrency,
      period,
      dateFrom,
      dateTo,
      byCategory,
      total: Math.round(total),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
