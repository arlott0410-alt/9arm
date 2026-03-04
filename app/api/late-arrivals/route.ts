import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth } from '@/lib/api-helpers';
import type { Db } from '@/db';
import { lateArrivals, settings, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const HOLIDAY_HEAD_KEY = 'HOLIDAY_HEAD_USER_ID';

async function getHolidayHeadUserId(db: Db): Promise<number | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, HOLIDAY_HEAD_KEY)).limit(1);
  if (rows.length === 0) return null;
  const v = rows[0].value;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    return isNaN(n) ? null : n;
  }
  return null;
}

/** POST: ลง/แก้ไข/ลบ มาสาย (วินาที). เฉพาะหัวหน้าวันหยุด */
export async function POST(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const authErr = requireAuth(user);
    if (authErr) return authErr;

    const headUserId = await getHolidayHeadUserId(db);
    if (headUserId === null || user!.id !== headUserId) {
      return NextResponse.json(
        { error: 'เฉพาะหัวหน้าวันหยุดเท่านั้นที่ลงมาสายได้' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as { userId?: number; date?: string; seconds?: number };
    const userId = typeof body.userId === 'number' ? body.userId : null;
    const date =
      typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;
    const seconds = typeof body.seconds === 'number' && body.seconds >= 0 ? Math.round(body.seconds) : null;

    if (userId === null || date === null || seconds === null) {
      return NextResponse.json(
        { error: 'ต้องส่ง userId, date (YYYY-MM-DD), seconds (จำนวนวินาที)' },
        { status: 400 }
      );
    }

    const target = await db.select().from(users).where(and(eq(users.id, userId), eq(users.role, 'ADMIN'))).limit(1);
    if (target.length === 0) {
      return NextResponse.json({ error: 'ไม่พบพนักงานที่เลือก' }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(lateArrivals)
      .where(and(eq(lateArrivals.userId, userId), eq(lateArrivals.lateDate, date)))
      .limit(1);

    const now = new Date();

    if (seconds === 0) {
      await db
        .delete(lateArrivals)
        .where(and(eq(lateArrivals.userId, userId), eq(lateArrivals.lateDate, date)));
      return NextResponse.json({ userId, date, seconds: 0, deleted: true });
    }

    if (existing.length > 0) {
      await db
        .update(lateArrivals)
        .set({ secondsLate: seconds })
        .where(and(eq(lateArrivals.userId, userId), eq(lateArrivals.lateDate, date)));
      return NextResponse.json({ userId, date, seconds });
    }

    await db.insert(lateArrivals).values({
      userId,
      lateDate: date,
      secondsLate: seconds,
      createdBy: user!.id,
      createdAt: now,
    });

    return NextResponse.json({ userId, date, seconds });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
