import { NextResponse } from 'next/server';
import { getDbAndUser, requireSettings } from '@/lib/api-helpers';
import { users, settings } from '@/db/schema';
import { eq } from 'drizzle-orm';

const HOLIDAY_HEAD_KEY = 'HOLIDAY_HEAD_USER_ID';

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireSettings(user);
    if (err) return err;

    const [list, headRows] = await Promise.all([
      db
        .select({
          id: users.id,
          username: users.username,
          isActive: users.isActive,
          createdAt: users.createdAt,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users)
        .where(eq(users.role, 'ADMIN'))
        .orderBy(users.username),
      db.select().from(settings).where(eq(settings.key, HOLIDAY_HEAD_KEY)).limit(1),
    ]);

    let holidayHeadUserId: number | null = null;
    if (headRows.length > 0) {
      const v = headRows[0].value;
      if (typeof v === 'number') holidayHeadUserId = v;
      else if (typeof v === 'string') {
        const n = parseInt(v, 10);
        if (!isNaN(n)) holidayHeadUserId = n;
      }
    }

    return NextResponse.json({
      employees: list,
      holidayHeadUserId,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
