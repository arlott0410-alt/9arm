import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth } from '@/lib/api-helpers';
import type { Db } from '@/db';
import { users, holidayEntries, lateArrivals, settings } from '@/db/schema';
import { eq, and, like } from 'drizzle-orm';
import { holidayEntrySchema } from '@/lib/validations';

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

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireAuth(user);
    if (err) return err;

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    if (!year || !month) {
      return NextResponse.json(
        { error: 'ต้องระบุ year และ month' },
        { status: 400 }
      );
    }
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
      return NextResponse.json(
        { error: 'year หรือ month ไม่ถูกต้อง' },
        { status: 400 }
      );
    }
    const prefix = `${y}-${String(m).padStart(2, '0')}-`;

    const [employeeList, entriesRows, lateRows, headUserId] = await Promise.all([
      db
        .select({ id: users.id, username: users.username, role: users.role })
        .from(users)
        .where(and(eq(users.isActive, true), eq(users.role, 'ADMIN')))
        .orderBy(users.username),
      db
        .select({ userId: holidayEntries.userId, holidayDate: holidayEntries.holidayDate })
        .from(holidayEntries)
        .where(like(holidayEntries.holidayDate, `${prefix}%`)),
      db
        .select({ userId: lateArrivals.userId, lateDate: lateArrivals.lateDate, minutesLate: lateArrivals.minutesLate })
        .from(lateArrivals)
        .where(like(lateArrivals.lateDate, `${prefix}%`)),
      getHolidayHeadUserId(db),
    ]);

    const entries = entriesRows.map((r) => ({ userId: r.userId, date: r.holidayDate }));
    const lateArrivalsList = lateRows.map((r) => ({ userId: r.userId, date: r.lateDate, minutes: r.minutesLate }));

    return NextResponse.json({
      employees: employeeList,
      entries,
      lateArrivals: lateArrivalsList,
      holidayHeadUserId: headUserId,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
        { error: 'เฉพาะหัวหน้าวันหยุดเท่านั้นที่ลงวันหยุดได้' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = holidayEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const targetUser = await db
      .select()
      .from(users)
      .where(and(eq(users.id, parsed.data.userId), eq(users.isActive, true)))
      .limit(1);
    if (targetUser.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบพนักงานที่เลือก' },
        { status: 400 }
      );
    }

    const existing = await db
      .select()
      .from(holidayEntries)
      .where(
        and(
          eq(holidayEntries.userId, parsed.data.userId),
          eq(holidayEntries.holidayDate, parsed.data.date)
        )
      )
      .limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ ok: true });
    }

    const now = new Date();
    await db.insert(holidayEntries).values({
      userId: parsed.data.userId,
      holidayDate: parsed.data.date,
      createdBy: user!.id,
      createdAt: now,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const authErr = requireAuth(user);
    if (authErr) return authErr;

    const headUserId = await getHolidayHeadUserId(db);
    if (headUserId === null || user!.id !== headUserId) {
      return NextResponse.json(
        { error: 'เฉพาะหัวหน้าวันหยุดเท่านั้นที่ลบวันหยุดได้' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = holidayEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    await db
      .delete(holidayEntries)
      .where(
        and(
          eq(holidayEntries.userId, parsed.data.userId),
          eq(holidayEntries.holidayDate, parsed.data.date)
        )
      );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
