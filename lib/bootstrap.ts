import type { Db } from '@/db';
import { settings } from '@/db/schema';

const DEFAULT_DISPLAY_CURRENCY = 'THB';
const DEFAULT_RATES: Record<string, number> = {
  LAK_THB: 0.0025,
  LAK_USD: 0.00007,
  THB_LAK: 400,
  THB_USD: 0.028,
  USD_LAK: 14000,
  USD_THB: 35.5,
};

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
}
