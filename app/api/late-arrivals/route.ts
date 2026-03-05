import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth } from '@/lib/api-helpers';
import type { Db } from '@/db';
import { lateArrivals, users, holidayEntries } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSettingValueCached } from '@/lib/get-setting-cached';

const HOLIDAY_HEAD_KEY = 'HOLIDAY_HEAD_USER_ID';

async function getHolidayHeadUserId(db: Db): Promise<number | null> {
  const v = await getSettingValueCached(db, HOLIDAY_HEAD_KEY);
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    return isNaN(n) ? null : n;
  }
  return null;
}

/** POST: ลง/แก้ไข/ลบ มาสาย (นาที). เฉพาะหัวหน้าวันหยุด */
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

    const body = (await request.json()) as { userId?: unknown; date?: string; minutes?: unknown };
    const userId = typeof body.userId === 'number' ? body.userId : null;
    const date =
      typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;
    const rawMinutes = body.minutes;
    const minutes =
      typeof rawMinutes === 'number' && rawMinutes >= 0
        ? Math.round(rawMinutes)
        : typeof rawMinutes === 'string'
          ? (() => {
              const n = parseInt(rawMinutes, 10);
              return isNaN(n) || n < 0 ? null : n;
            })()
          : null;

    if (userId === null || date === null || minutes === null) {
      return NextResponse.json(
        { error: 'ต้องส่ง userId, date (YYYY-MM-DD), minutes (จำนวนนาที)' },
        { status: 400 }
      );
    }

    const target = await db.select({ id: users.id }).from(users).where(and(eq(users.id, userId), eq(users.role, 'ADMIN'))).limit(1);
    if (target.length === 0) {
      return NextResponse.json({ error: 'ไม่พบพนักงานที่เลือก' }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(lateArrivals)
      .where(and(eq(lateArrivals.userId, userId), eq(lateArrivals.lateDate, date)))
      .limit(1);

    const now = new Date();

    // วันหนึ่งลงได้อย่างใดอย่างหนึ่ง: ถ้าลงมาสาย ให้ลบวันหยุดของวันนั้น
    await db
      .delete(holidayEntries)
      .where(
        and(
          eq(holidayEntries.userId, userId),
          eq(holidayEntries.holidayDate, date)
        )
      );

    if (minutes === 0) {
      await db
        .delete(lateArrivals)
        .where(and(eq(lateArrivals.userId, userId), eq(lateArrivals.lateDate, date)));
      return NextResponse.json({ userId, date, minutes: 0, deleted: true });
    }

    if (existing.length > 0) {
      await db
        .update(lateArrivals)
        .set({ secondsLate: 0, minutesLate: minutes })
        .where(and(eq(lateArrivals.userId, userId), eq(lateArrivals.lateDate, date)));
      return NextResponse.json({ userId, date, minutes });
    }

    await db.insert(lateArrivals).values({
      userId,
      lateDate: date,
      secondsLate: 0,
      minutesLate: minutes,
      createdBy: user!.id,
      createdAt: now,
    });

    return NextResponse.json({ userId, date, minutes });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    if (/no such column|no such table/.test(msg)) {
      return NextResponse.json(
        {
          error:
            'ตารางมาสายยังไม่อัปเดต — กรุณารัน migration 0011_late_arrivals_minutes.sql ใน D1 Console (Workers & Pages → D1 → เลือก DB → Console)',
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
