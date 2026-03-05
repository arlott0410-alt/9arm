import { NextResponse } from 'next/server';
import { getDbAndUser, requireSettings } from '@/lib/api-helpers';
import { users, employeeSalaries } from '@/db/schema';
import { eq, and, lte, desc } from 'drizzle-orm';
import type { Db } from '@/db';
import { getBaseSalariesForUsers } from '@/lib/payroll';

/** เงินเดือนใช้กีบ (LAK) เป็นค่าเดียว ไม่มีตั้งค่าสกุลเงินเดือน */
const SALARY_CURRENCY_LAK = 'LAK';

/** GET: รายการเงินเดือนฐานของพนักงาน (ADMIN) ณ เดือนที่กำหนด. SUPER_ADMIN เท่านั้น. สกุลเงินเดือนเป็นกีบ (LAK) เท่านั้น. ใช้ batch query แทน N+1 */
export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireSettings(user);
    if (err) return err;

    const { searchParams } = new URL(request.url);
    const yearMonth = searchParams.get('yearMonth') ?? getCurrentYearMonth();

    const adminList = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.role, 'ADMIN'))
      .orderBy(users.username);

    const userIds = adminList.map((u) => u.id);
    const salaryMap = await getBaseSalariesForUsers(db, userIds, yearMonth);

    const items = adminList.map((u) => {
      const sal = salaryMap.get(u.id);
      return {
        userId: u.id,
        username: u.username,
        baseSalaryMinor: sal?.baseSalaryMinor ?? null,
        currency: sal?.currency ?? SALARY_CURRENCY_LAK,
        effectiveFrom: sal?.effectiveFrom ?? null,
      };
    });

    return NextResponse.json({ yearMonth, items });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getCurrentYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

const salaryPayloadSchema = {
  userId: (v: unknown) => typeof v === 'number' && Number.isInteger(v),
  effectiveFrom: (v: unknown) =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v),
  baseSalaryMinor: (v: unknown) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0,
};

/** PUT: ตั้งค่าเงินเดือนฐานของพนักงานหนึ่งคน. SUPER_ADMIN เท่านั้น */
export async function PUT(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireSettings(user);
    if (err) return err;

    const body = (await request.json()) as {
      userId?: unknown;
      effectiveFrom?: unknown;
      baseSalaryMinor?: unknown;
    };
    if (
      !salaryPayloadSchema.userId(body.userId) ||
      !salaryPayloadSchema.effectiveFrom(body.effectiveFrom) ||
      !salaryPayloadSchema.baseSalaryMinor(body.baseSalaryMinor)
    ) {
      return NextResponse.json(
        { error: 'ต้องส่ง userId, effectiveFrom (YYYY-MM-DD), baseSalaryMinor' },
        { status: 400 }
      );
    }

    const userId = body.userId as number;
    const effectiveFrom = body.effectiveFrom as string;
    const baseSalaryMinor = body.baseSalaryMinor as number;
    const currency = SALARY_CURRENCY_LAK;

    const now = Date.now();
    const existing = await db
      .select()
      .from(employeeSalaries)
      .where(
        and(
          eq(employeeSalaries.userId, userId),
          eq(employeeSalaries.effectiveFrom, effectiveFrom)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(employeeSalaries)
        .set({
          baseSalaryMinor,
          currency,
        })
        .where(
          and(
            eq(employeeSalaries.userId, userId),
            eq(employeeSalaries.effectiveFrom, effectiveFrom)
          )
        );
    } else {
      await db.insert(employeeSalaries).values({
        userId,
        effectiveFrom,
        baseSalaryMinor,
        currency,
        createdAt: new Date(now),
        createdBy: user!.id,
      });
    }

    return NextResponse.json({
      userId,
      effectiveFrom,
      baseSalaryMinor,
      currency: SALARY_CURRENCY_LAK,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
