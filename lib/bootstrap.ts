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
}
