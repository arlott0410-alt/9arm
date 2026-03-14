import { NextResponse } from 'next/server';
import { getDbAndUser, requireSettings } from '@/lib/api-helpers';
import { payrollRuns, payrollItems } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  recalcBonusPortions,
  type PayrollDeduction,
  type PayrollAllowance,
} from '@/lib/payroll';

/** POST: Bulk set exclude_from_bonus for multiple employees. SUPER_ADMIN only, DRAFT only. */
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

    const runId = parseInt((await params).id, 10);
    if (isNaN(runId)) {
      return NextResponse.json({ error: 'Invalid run id' }, { status: 400 });
    }

    const runRows = await db
      .select({ status: payrollRuns.status, bonusPoolMinor: payrollRuns.bonusPoolMinor })
      .from(payrollRuns)
      .where(eq(payrollRuns.id, runId))
      .limit(1);
    if (runRows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรอบเงินเดือน' }, { status: 404 });
    }
    if (runRows[0].status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'แก้ไขได้เฉพาะรอบแบบ DRAFT' },
        { status: 400 }
      );
    }

    const body = (await request.json()) as { excludeUserIds?: unknown };
    const excludeUserIds = Array.isArray(body?.excludeUserIds)
      ? (body.excludeUserIds as number[]).filter(
          (n) => typeof n === 'number' && Number.isInteger(n)
        )
      : [];
    const excludeSet = new Set(excludeUserIds);

    const allItems = await db
      .select()
      .from(payrollItems)
      .where(eq(payrollItems.payrollRunId, runId));

    for (const item of allItems) {
      await db
        .update(payrollItems)
        .set({ excludeFromBonus: excludeSet.has(item.userId) })
        .where(
          and(
            eq(payrollItems.payrollRunId, runId),
            eq(payrollItems.userId, item.userId)
          )
        );
    }

    const itemsForRecalc = allItems.map((i) => ({
      userId: i.userId,
      workingDays: i.workingDays,
      excludeFromBonus: excludeSet.has(i.userId),
      salaryAfterHolidayMinor: i.salaryAfterHolidayMinor,
      allowances: (Array.isArray(i.allowances) ? i.allowances : []) as PayrollAllowance[],
      deductions: (Array.isArray(i.deductions) ? i.deductions : []) as PayrollDeduction[],
      lateDeductionMinor: i.lateDeductionMinor ?? 0,
    }));

    const bonusPoolMinor = runRows[0].bonusPoolMinor ?? 0;
    const recalc = recalcBonusPortions(itemsForRecalc, bonusPoolMinor);

    for (const r of recalc) {
      await db
        .update(payrollItems)
        .set({
          bonusPortionMinor: r.bonusPortionMinor,
          netAmountMinor: r.netAmountMinor,
        })
        .where(
          and(
            eq(payrollItems.payrollRunId, runId),
            eq(payrollItems.userId, r.userId)
          )
        );
    }

    return NextResponse.json({
      excludeUserIds,
      recalculated: true,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
