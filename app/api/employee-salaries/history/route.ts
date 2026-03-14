import { NextResponse } from 'next/server';
import { getDbAndUser, requireSettings } from '@/lib/api-helpers';
import { employeeSalaries, users } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';

/** GET: ประวัติเงินเดือนฐานของพนักงาน (ADMIN). SUPER_ADMIN เท่านั้น. */
export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireSettings(user);
    if (err) return err;

    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('userId');
    const userId = userIdParam ? parseInt(userIdParam, 10) : NaN;
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'ต้องส่ง userId' }, { status: 400 });
    }

    const userRow = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.role, 'ADMIN')))
      .limit(1);
    if (userRow.length === 0) {
      return NextResponse.json({ error: 'ไม่พบพนักงาน' }, { status: 404 });
    }

    const rows = await db
      .select({
        id: employeeSalaries.id,
        effectiveFrom: employeeSalaries.effectiveFrom,
        effectiveTo: employeeSalaries.effectiveTo,
        baseSalaryMinor: employeeSalaries.baseSalaryMinor,
        currency: employeeSalaries.currency,
      })
      .from(employeeSalaries)
      .where(eq(employeeSalaries.userId, userId))
      .orderBy(asc(employeeSalaries.effectiveFrom));

    return NextResponse.json({
      userId,
      username: userRow[0].username,
      history: rows.map((r) => ({
        id: r.id,
        effectiveFrom: r.effectiveFrom,
        effectiveTo: r.effectiveTo ?? null,
        baseSalaryMinor: r.baseSalaryMinor,
        currency: r.currency,
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
