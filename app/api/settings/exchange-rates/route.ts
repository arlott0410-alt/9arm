export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth, requireSettings } from '@/lib/api-helpers';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { exchangeRatesSchema } from '@/lib/validations';
import { getAllRateKeys } from '@/lib/rates';

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireAuth(user);
    if (err) return err;

    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'EXCHANGE_RATES'))
      .limit(1);
    const rates =
      row?.value && typeof row.value === 'string'
        ? JSON.parse(row.value)
        : {};
    return NextResponse.json({ rates });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireSettings(user);
    if (err) return err;

    const body = await request.json();
    const parsed = exchangeRatesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const keys = getAllRateKeys();
    const rates: Record<string, number> = {};
    for (const k of keys) {
      const v = parsed.data.rates[k];
      if (typeof v === 'number' && v > 0) rates[k] = v;
    }

    await db
      .update(settings)
      .set({ value: JSON.stringify(rates) })
      .where(eq(settings.key, 'EXCHANGE_RATES'));
    return NextResponse.json({ rates });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
