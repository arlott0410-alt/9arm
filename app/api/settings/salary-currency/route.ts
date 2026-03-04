import { NextResponse } from 'next/server';
import { getDbAndUser, requireSettings } from '@/lib/api-helpers';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { salaryCurrencySchema } from '@/lib/validations';

const KEY = 'SALARY_CURRENCY';

export async function PUT(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireSettings(user);
    if (err) return err;

    const body = await request.json();
    const parsed = salaryCurrencySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const value = JSON.stringify(parsed.data.salaryCurrency);
    const existing = await db.select().from(settings).where(eq(settings.key, KEY)).limit(1);
    if (existing.length > 0) {
      await db.update(settings).set({ value }).where(eq(settings.key, KEY));
    } else {
      await db.insert(settings).values({ key: KEY, value });
    }

    return NextResponse.json({ salaryCurrency: parsed.data.salaryCurrency });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
