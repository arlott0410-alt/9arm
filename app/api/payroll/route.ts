import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth, requireSettings } from '@/lib/api-helpers';
import { users, payrollRuns, payrollItems } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import {
  getDaysInMonth,
  getHolidayCountByUser,
  getBaseSalaryForUser,
  getSalaryPolicySettings,
  computeSalaryAfterHoliday,
  computeBonusPortion,
  computeNetAmount,
  type PayrollDeduction,
} from '@/lib/payroll';

/** GET: รายการรอบเงินเดือน. SUPER_ADMIN เห็นทุกรอบ, ADMIN เห็นเฉพาะ CONFIRMED */
export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const authErr = requireAuth(user);
    if (authErr) return authErr;

    const role = user!.role as string;
    const rows = await db
      .select({
        id: payrollRuns.id,
        yearMonth: payrollRuns.yearMonth,
        status: payrollRuns.status,
        bonusPoolMinor: payrollRuns.bonusPoolMinor,
        createdAt: payrollRuns.createdAt,
        createdBy: payrollRuns.createdBy,
      })
      .from(payrollRuns)
      .orderBy(desc(payrollRuns.yearMonth));

    const list =
      role === 'SUPER_ADMIN'
        ? rows
        : rows.filter((r) => r.status === 'CONFIRMED');

    return NextResponse.json({ runs: list });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/** POST: สร้างรอบเงินเดือน (DRAFT). SUPER_ADMIN เท่านั้น */
export async function POST(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireSettings(user);
    if (err) return err;

    const body = (await request.json()) as {
      yearMonth?: string;
      bonusPoolMinor?: number;
    };
    const yearMonth =
      typeof body.yearMonth === 'string' && /^\d{4}-\d{2}$/.test(body.yearMonth)
        ? body.yearMonth
        : null;
    if (!yearMonth) {
      return NextResponse.json(
        { error: 'ต้องส่ง yearMonth (YYYY-MM)' },
        { status: 400 }
      );
    }

    const [y, m] = yearMonth.split('-').map(Number);
    const totalDays = getDaysInMonth(y, m);

    const existingRun = await db
      .select()
      .from(payrollRuns)
      .where(eq(payrollRuns.yearMonth, yearMonth))
      .limit(1);
    if (existingRun.length > 0) {
      return NextResponse.json(
        { error: 'มีรอบเงินเดือนของเดือนนี้แล้ว' },
        { status: 400 }
      );
    }

    const bonusPoolMinor =
      typeof body.bonusPoolMinor === 'number' && body.bonusPoolMinor >= 0
        ? Math.round(body.bonusPoolMinor)
        : 0;

    const [holidayByUser, policy, adminList] = await Promise.all([
      getHolidayCountByUser(db, yearMonth),
      getSalaryPolicySettings(db),
      db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, 'ADMIN')),
    ]);

    const itemsData: {
      userId: number;
      baseSalaryMinor: number;
      totalDays: number;
      holidayDays: number;
      workingDays: number;
      salaryAfterHolidayMinor: number;
      bonusPortionMinor: number;
      deductions: PayrollDeduction[];
      totalDeductionsMinor: number;
      netAmountMinor: number;
    }[] = [];
    let totalWorkingDaysAll = 0;

    for (const u of adminList) {
      const sal = await getBaseSalaryForUser(db, u.id, yearMonth);
      if (!sal) continue;
      const holidayDays = holidayByUser.get(u.id) ?? 0;
      const workingDays = totalDays - holidayDays;
      const salaryAfterHolidayMinor = computeSalaryAfterHoliday(
        sal.baseSalaryMinor,
        totalDays,
        holidayDays,
        policy.freeHolidayDays,
        policy.deductMultiplierPerDay
      );
      itemsData.push({
        userId: u.id,
        baseSalaryMinor: sal.baseSalaryMinor,
        totalDays,
        holidayDays,
        workingDays,
        salaryAfterHolidayMinor,
        bonusPortionMinor: 0,
        deductions: [],
        totalDeductionsMinor: 0,
        netAmountMinor: salaryAfterHolidayMinor,
      });
      totalWorkingDaysAll += workingDays;
    }

    const bonusPool = bonusPoolMinor;
    for (let i = 0; i < itemsData.length; i++) {
      const d = itemsData[i];
      d.bonusPortionMinor = computeBonusPortion(
        d.workingDays,
        totalWorkingDaysAll,
        bonusPool
      );
      const { totalDeductionsMinor, netAmountMinor } = computeNetAmount(
        d.salaryAfterHolidayMinor,
        d.bonusPortionMinor,
        d.deductions
      );
      d.totalDeductionsMinor = totalDeductionsMinor;
      d.netAmountMinor = netAmountMinor;
    }

    const now = new Date();
    const [run] = await db
      .insert(payrollRuns)
      .values({
        yearMonth,
        status: 'DRAFT',
        bonusPoolMinor: bonusPool || null,
        createdAt: now,
        createdBy: user!.id,
      })
      .returning({ id: payrollRuns.id });

    if (!run) {
      return NextResponse.json(
        { error: 'สร้างรอบไม่สำเร็จ' },
        { status: 500 }
      );
    }

    for (const d of itemsData) {
      await db.insert(payrollItems).values({
        payrollRunId: run.id,
        userId: d.userId,
        baseSalaryMinor: d.baseSalaryMinor,
        totalDays: d.totalDays,
        holidayDays: d.holidayDays,
        workingDays: d.workingDays,
        salaryAfterHolidayMinor: d.salaryAfterHolidayMinor,
        bonusPortionMinor: d.bonusPortionMinor,
        deductions: d.deductions,
        totalDeductionsMinor: d.totalDeductionsMinor,
        netAmountMinor: d.netAmountMinor,
        createdAt: now,
      });
    }

    return NextResponse.json({
      run: {
        id: run.id,
        yearMonth,
        status: 'DRAFT',
        bonusPoolMinor: bonusPool || null,
      },
      itemsCount: itemsData.length,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
