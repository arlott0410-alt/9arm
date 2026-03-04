import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth } from '@/lib/api-helpers';
import { payrollRuns, payrollItems } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { PayrollDeduction } from '@/lib/payroll';

/** GET: เงินเดือนของฉัน (พนักงานเห็นเฉพาะของตัวเอง, รอบ CONFIRMED เท่านั้น) */
export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const authErr = requireAuth(user);
    if (authErr) return authErr;

    const userId = user!.id;

    const runs = await db
      .select({
        id: payrollRuns.id,
        yearMonth: payrollRuns.yearMonth,
        status: payrollRuns.status,
        bonusPoolMinor: payrollRuns.bonusPoolMinor,
        createdAt: payrollRuns.createdAt,
      })
      .from(payrollRuns)
      .where(eq(payrollRuns.status, 'CONFIRMED'))
      .orderBy(desc(payrollRuns.yearMonth));

    const items: {
      runId: number;
      yearMonth: string;
      status: string;
      bonusPoolMinor: number | null;
      createdAt: Date;
      item: {
        baseSalaryMinor: number;
        totalDays: number;
        holidayDays: number;
        workingDays: number;
        salaryAfterHolidayMinor: number;
        bonusPortionMinor: number;
        allowances: { name: string; amountMinor: number }[];
        totalAllowancesMinor: number;
        deductions: PayrollDeduction[];
        totalDeductionsMinor: number;
        lateSeconds: number;
        lateDeductionMinor: number;
        netAmountMinor: number;
        note: string | null;
      };
    }[] = [];

    for (const run of runs) {
      const rows = await db
        .select()
        .from(payrollItems)
        .where(
          and(
            eq(payrollItems.payrollRunId, run.id),
            eq(payrollItems.userId, userId)
          )
        )
        .limit(1);
      if (rows.length === 0) continue;
      const r = rows[0];
      items.push({
        runId: run.id,
        yearMonth: run.yearMonth,
        status: run.status,
        bonusPoolMinor: run.bonusPoolMinor,
        createdAt: run.createdAt,
        item: {
          baseSalaryMinor: r.baseSalaryMinor,
          totalDays: r.totalDays,
          holidayDays: r.holidayDays,
          workingDays: r.workingDays,
          salaryAfterHolidayMinor: r.salaryAfterHolidayMinor,
          bonusPortionMinor: r.bonusPortionMinor,
          allowances: (Array.isArray(r.allowances) ? r.allowances : []) as { name: string; amountMinor: number }[],
          totalAllowancesMinor: r.totalAllowancesMinor ?? 0,
          deductions: (Array.isArray(r.deductions) ? r.deductions : []) as PayrollDeduction[],
          totalDeductionsMinor: r.totalDeductionsMinor,
          lateSeconds: r.lateSeconds ?? 0,
          lateDeductionMinor: r.lateDeductionMinor ?? 0,
          netAmountMinor: r.netAmountMinor,
          note: r.note,
        },
      });
    }

    return NextResponse.json({ items });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
