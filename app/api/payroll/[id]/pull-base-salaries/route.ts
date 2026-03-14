import { NextResponse } from 'next/server';
import { getDbAndUser, requireSettings } from '@/lib/api-helpers';
import { payrollRuns, payrollItems } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import {
  getDaysInMonth,
  getBaseSalariesForUsersWithLatestFallback,
  getSalaryPolicySettings,
  computeSalaryAfterHoliday,
  recalcBonusPortions,
  type PayrollAllowance,
  type PayrollDeduction,
} from '@/lib/payroll';

/** POST: ดึงฐานเงินเดือนล่าสุดจาก employee_salaries มาใส่ในรายการ (DRAFT เท่านั้น). SUPER_ADMIN เท่านั้น */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireSettings(user);
    if (err) return err;
    if ((user!.role as string) !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 });
    }

    const id = parseInt((await params).id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid run id' }, { status: 400 });
    }

    const runRows = await db
      .select()
      .from(payrollRuns)
      .where(and(eq(payrollRuns.id, id), isNull(payrollRuns.deletedAt)))
      .limit(1);
    if (runRows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรอบเงินเดือน' }, { status: 404 });
    }
    const run = runRows[0];
    if (run.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'ดึงฐานเงินเดือนได้เฉพาะรอบแบบร่าง (DRAFT)' },
        { status: 400 }
      );
    }

    const yearMonth = run.yearMonth;
    const [y, m] = yearMonth.split('-').map(Number);
    const totalDays = getDaysInMonth(y, m);
    const bonusPoolMinor = run.bonusPoolMinor ?? 0;

    const allItems = await db
      .select()
      .from(payrollItems)
      .where(eq(payrollItems.payrollRunId, id));
    if (allItems.length === 0) {
      return NextResponse.json({ updated: 0, message: 'ไม่มีรายการพนักงาน' });
    }

    const userIds = allItems.map((i) => i.userId);
    const salaryMap = await getBaseSalariesForUsersWithLatestFallback(
      db,
      userIds,
      yearMonth
    );
    const policy = await getSalaryPolicySettings(db);

    let updatedCount = 0;
    for (const item of allItems) {
      const sal = salaryMap.get(item.userId);
      const newBase = sal?.baseSalaryMinor ?? item.baseSalaryMinor;
      if (newBase === item.baseSalaryMinor) continue;

      const salaryAfterHolidayMinor = computeSalaryAfterHoliday(
        newBase,
        item.totalDays,
        item.holidayDays,
        policy.freeHolidayDays,
        policy.deductMultiplierPerDay
      );

      await db
        .update(payrollItems)
        .set({
          baseSalaryMinor: newBase,
          salaryAfterHolidayMinor,
          overrideBaseSalaryMinor: null,
        })
        .where(
          and(
            eq(payrollItems.payrollRunId, id),
            eq(payrollItems.userId, item.userId)
          )
        );
      updatedCount++;
    }

    const itemsForRecalc = await db
      .select()
      .from(payrollItems)
      .where(eq(payrollItems.payrollRunId, id));
    const recalcInput = itemsForRecalc.map((i) => ({
      userId: i.userId,
      workingDays: i.workingDays,
      excludeFromBonus: !!i.excludeFromBonus,
      salaryAfterHolidayMinor: i.salaryAfterHolidayMinor,
      allowances: (Array.isArray(i.allowances) ? i.allowances : []) as PayrollAllowance[],
      deductions: (Array.isArray(i.deductions) ? i.deductions : []) as PayrollDeduction[],
      lateDeductionMinor: i.lateDeductionMinor ?? 0,
    }));
    const recalc = recalcBonusPortions(recalcInput, bonusPoolMinor);
    for (const r of recalc) {
      await db
        .update(payrollItems)
        .set({
          bonusPortionMinor: r.bonusPortionMinor,
          netAmountMinor: r.netAmountMinor,
        })
        .where(and(eq(payrollItems.payrollRunId, id), eq(payrollItems.userId, r.userId)));
    }

    return NextResponse.json({ updated: updatedCount });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
