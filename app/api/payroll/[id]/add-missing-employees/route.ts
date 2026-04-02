import { NextResponse } from 'next/server';
import { getDbAndUser, requireSettings } from '@/lib/api-helpers';
import { users, payrollRuns, payrollItems } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import {
  getDaysInMonth,
  getHolidayCountByUser,
  getBaseSalariesForUsersWithLatestFallback,
  getSalaryPolicySettings,
  getLateMinutesByUser,
  getLatePenaltyPerMinute,
  computeSalaryAfterHoliday,
  computeBonusPortion,
  computeNetAmount,
  recalcBonusPortions,
  type PayrollAllowance,
  type PayrollDeduction,
} from '@/lib/payroll';

/** POST: เพิ่มพนักงานที่ยังไม่มีในรอบ (DRAFT เท่านั้น). SUPER_ADMIN เท่านั้น */
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
        { error: 'เพิ่มพนักงานได้เฉพาะรอบแบบร่าง (DRAFT)' },
        { status: 400 }
      );
    }

    const yearMonth = run.yearMonth;
    const [y, m] = yearMonth.split('-').map(Number);
    const totalDays = getDaysInMonth(y, m);

    const [adminList, existingItems, holidayByUser, policy, lateByUser, latePenalty] =
      await Promise.all([
        db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.role, 'ADMIN')),
        db
          .select({ userId: payrollItems.userId })
          .from(payrollItems)
          .where(eq(payrollItems.payrollRunId, id)),
        getHolidayCountByUser(db, yearMonth),
        getSalaryPolicySettings(db),
        getLateMinutesByUser(db, yearMonth),
        getLatePenaltyPerMinute(db),
      ]);

    const existingUserIds = new Set(existingItems.map((r) => r.userId));
    const missingAdmins = adminList.filter((u) => !existingUserIds.has(u.id));
    if (missingAdmins.length === 0) {
      return NextResponse.json({ added: 0, message: 'มีพนักงานครบแล้ว' });
    }

    const salaryMapFilled = await getBaseSalariesForUsersWithLatestFallback(
      db,
      missingAdmins.map((u) => u.id),
      yearMonth
    );

    const bonusPoolMinor = run.bonusPoolMinor ?? 0;

    const existingItemsData = await db
      .select({
        workingDays: payrollItems.workingDays,
        excludeFromBonus: payrollItems.excludeFromBonus,
      })
      .from(payrollItems)
      .where(eq(payrollItems.payrollRunId, id));
    const existingWorkingDaysForBonus = existingItemsData.reduce(
      (s, i) => s + (i.excludeFromBonus ? 0 : i.workingDays),
      0
    );
    const newWorkingDaysForBonus = missingAdmins.reduce((s, u) => {
      const holidayDays = holidayByUser.get(u.id) ?? 0;
      return s + (totalDays - holidayDays);
    }, 0);
    const totalWorkingDaysAll = existingWorkingDaysForBonus + newWorkingDaysForBonus;

    const newItems: {
      userId: number;
      baseSalaryMinor: number;
      totalDays: number;
      holidayDays: number;
      workingDays: number;
      salaryAfterHolidayMinor: number;
      bonusPortionMinor: number;
      allowances: PayrollAllowance[];
      totalAllowancesMinor: number;
      deductions: PayrollDeduction[];
      totalDeductionsMinor: number;
      lateMinutes: number;
      lateDeductionMinor: number;
      netAmountMinor: number;
    }[] = [];

    for (const u of missingAdmins) {
      const sal = salaryMapFilled.get(u.id);
      const baseSalaryMinor = sal?.baseSalaryMinor ?? 0;
      const holidayDays = holidayByUser.get(u.id) ?? 0;
      const workingDays = totalDays - holidayDays;
      const salaryAfterHolidayMinor = computeSalaryAfterHoliday(
        baseSalaryMinor,
        totalDays,
        holidayDays,
        policy.freeHolidayDays,
        policy.deductMultiplierPerDay
      );
      const lateMin = lateByUser.get(u.id) ?? 0;
      const lateDeductionMinor = lateMin * latePenalty;
      const bonusPortionMinor = computeBonusPortion(
        workingDays,
        totalWorkingDaysAll,
        bonusPoolMinor
      );
      const { totalAllowancesMinor, totalDeductionsMinor, netAmountMinor } = computeNetAmount(
        salaryAfterHolidayMinor,
        bonusPortionMinor,
        [],
        []
      );
      newItems.push({
        userId: u.id,
        baseSalaryMinor,
        totalDays,
        holidayDays,
        workingDays,
        salaryAfterHolidayMinor,
        bonusPortionMinor,
        allowances: [],
        totalAllowancesMinor,
        deductions: [],
        totalDeductionsMinor,
        lateMinutes: lateMin,
        lateDeductionMinor,
        netAmountMinor: Math.max(0, netAmountMinor - lateDeductionMinor),
      });
    }

    const now = new Date();
    const insertStatements = newItems.map((d) =>
      db.insert(payrollItems).values({
        payrollRunId: id,
        userId: d.userId,
        baseSalaryMinor: d.baseSalaryMinor,
        totalDays: d.totalDays,
        holidayDays: d.holidayDays,
        workingDays: d.workingDays,
        salaryAfterHolidayMinor: d.salaryAfterHolidayMinor,
        bonusPortionMinor: d.bonusPortionMinor,
        allowances: d.allowances,
        totalAllowancesMinor: d.totalAllowancesMinor,
        deductions: d.deductions,
        totalDeductionsMinor: d.totalDeductionsMinor,
        lateMinutes: d.lateMinutes,
        lateDeductionMinor: d.lateDeductionMinor,
        netAmountMinor: d.netAmountMinor,
        createdAt: now,
      })
    );
    if (insertStatements.length > 0) {
      await db.batch(insertStatements as unknown as Parameters<import('@/db').Db['batch']>[0]);
    }

    if (bonusPoolMinor > 0) {
      const allItemsAfter = await db
        .select()
        .from(payrollItems)
        .where(eq(payrollItems.payrollRunId, id));
      const itemsForRecalc = allItemsAfter.map((i) => ({
        userId: i.userId,
        workingDays: i.workingDays,
        excludeFromBonus: !!i.excludeFromBonus,
        salaryAfterHolidayMinor: i.salaryAfterHolidayMinor,
        allowances: (Array.isArray(i.allowances) ? i.allowances : []) as PayrollAllowance[],
        deductions: (Array.isArray(i.deductions) ? i.deductions : []) as PayrollDeduction[],
        lateDeductionMinor: i.lateDeductionMinor ?? 0,
      }));
      const recalc = recalcBonusPortions(itemsForRecalc, bonusPoolMinor);
      const recalcStatements = recalc.map((r) =>
        db
          .update(payrollItems)
          .set({
            bonusPortionMinor: r.bonusPortionMinor,
            netAmountMinor: r.netAmountMinor,
          })
          .where(and(eq(payrollItems.payrollRunId, id), eq(payrollItems.userId, r.userId)))
      );
      if (recalcStatements.length > 0) {
        await db.batch(recalcStatements as unknown as Parameters<import('@/db').Db['batch']>[0]);
      }
    }

    return NextResponse.json({ added: newItems.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
