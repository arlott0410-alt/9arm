import { NextResponse } from 'next/server';
import { getDbAndUser, requireSettings } from '@/lib/api-helpers';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSettingValueCached } from '@/lib/get-setting-cached';
import { setNoStore } from '@/lib/cache-headers';

const HOLIDAY_HEAD_KEY = 'HOLIDAY_HEAD_USER_ID';

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireSettings(user);
    if (err) return err;

    const [list, headVal] = await Promise.all([
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
      getSettingValueCached(db, HOLIDAY_HEAD_KEY),
    ]);

    let holidayHeadUserId: number | null = null;
    if (typeof headVal === 'number') holidayHeadUserId = headVal;
    else if (typeof headVal === 'string') {
      const n = parseInt(headVal, 10);
      if (!isNaN(n)) holidayHeadUserId = n;
    }

    const res = NextResponse.json({
      employees: list,
      holidayHeadUserId,
    });
    setNoStore(res);
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
