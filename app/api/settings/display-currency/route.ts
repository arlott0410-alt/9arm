export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getDbAndUser, requireSettings } from '@/lib/api-helpers';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { displayCurrencySchema } from '@/lib/validations';

export async function PUT(request: Request) {
  try {
    const { db, user } = await getDbAndUser(request);
    const err = requireSettings(user);
    if (err) return err;

    const body = await request.json();
    const parsed = displayCurrencySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const value = JSON.stringify(parsed.data.displayCurrency);
    await db
      .update(settings)
      .set({ value })
      .where(eq(settings.key, 'DISPLAY_CURRENCY'));
    return NextResponse.json({ displayCurrency: parsed.data.displayCurrency });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
