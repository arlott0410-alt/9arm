import { NextResponse } from 'next/server';
import { getDbAndUser, requireSettings } from '@/lib/api-helpers';
import { settings, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { holidayHeadSchema } from '@/lib/validations';

const HOLIDAY_HEAD_KEY = 'HOLIDAY_HEAD_USER_ID';

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireSettings(user);
    if (err) return err;

    const rows = await db.select().from(settings).where(eq(settings.key, HOLIDAY_HEAD_KEY)).limit(1);
    let userId: number | null = null;
    if (rows.length > 0) {
      const v = rows[0].value;
      if (typeof v === 'number') userId = v;
      else if (typeof v === 'string') {
        const n = parseInt(v, 10);
        if (!isNaN(n)) userId = n;
      }
    }

    return NextResponse.json({ userId });
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
    const parsed = holidayHeadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    if (parsed.data.userId === null) {
      await db.delete(settings).where(eq(settings.key, HOLIDAY_HEAD_KEY));
      return NextResponse.json({ userId: null });
    }

    const target = await db
      .select()
      .from(users)
      .where(and(eq(users.id, parsed.data.userId), eq(users.isActive, true)))
      .limit(1);
    if (target.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบผู้ใช้ที่เลือก' },
        { status: 400 }
      );
    }
    if (target[0].role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'หัวหน้าวันหยุดต้องเป็น ADMIN เท่านั้น' },
        { status: 400 }
      );
    }

    const value = JSON.stringify(parsed.data.userId);
    const existing = await db.select().from(settings).where(eq(settings.key, HOLIDAY_HEAD_KEY)).limit(1);
    if (existing.length > 0) {
      await db.update(settings).set({ value }).where(eq(settings.key, HOLIDAY_HEAD_KEY));
    } else {
      await db.insert(settings).values({ key: HOLIDAY_HEAD_KEY, value });
    }

    return NextResponse.json({ userId: parsed.data.userId });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
