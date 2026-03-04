import type { Db } from '@/db';
import { settings } from '@/db/schema';

const DEFAULT_DISPLAY_CURRENCY = 'THB';
import { expandRatesFromBase } from '@/lib/rates';

const DEFAULT_BASE = { THB_LAK: 700, USD_THB: 32, USD_LAK: 22000 };
const DEFAULT_RATES = expandRatesFromBase(DEFAULT_BASE);

export async function bootstrapSettings(db: Db): Promise<void> {
  const rows = await db.select().from(settings);
  const keys = new Set(rows.map((r) => r.key));

  if (!keys.has('DISPLAY_CURRENCY')) {
    await db.insert(settings).values({
      key: 'DISPLAY_CURRENCY',
      value: JSON.stringify(DEFAULT_DISPLAY_CURRENCY),
    });
  }

  if (!keys.has('EXCHANGE_RATES')) {
    await db.insert(settings).values({
      key: 'EXCHANGE_RATES',
      value: JSON.stringify(DEFAULT_RATES),
    });
  }

  if (!keys.has('SALARY_CURRENCY')) {
    await db.insert(settings).values({
      key: 'SALARY_CURRENCY',
      value: JSON.stringify('THB'),
    });
  }

  if (!keys.has('SALARY_FREE_HOLIDAY_DAYS')) {
    await db.insert(settings).values({
      key: 'SALARY_FREE_HOLIDAY_DAYS',
      value: JSON.stringify(4),
    });
  }

  if (!keys.has('SALARY_DEDUCT_MULTIPLIER_PER_DAY')) {
    await db.insert(settings).values({
      key: 'SALARY_DEDUCT_MULTIPLIER_PER_DAY',
      value: JSON.stringify(2),
    });
  }

  if (!keys.has('SALARY_LATE_PENALTY_PER_MINUTE')) {
    await db.insert(settings).values({
      key: 'SALARY_LATE_PENALTY_PER_MINUTE',
      value: JSON.stringify(1000),
    });
  }
}
