import { NextResponse } from 'next/server';
import { getDbAndUser, requireSettings } from '@/lib/api-helpers';
import { payrollRuns, payrollItems } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
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

    const excludeIds: number[] = [];
    const includeIds: number[] = [];
    for (const item of allItems) {
      if (excludeSet.has(item.userId)) {
        excludeIds.push(item.userId);
      } else {
        includeIds.push(item.userId);
      }
    }
    if (excludeIds.length > 0) {
      await db
        .update(payrollItems)
        .set({ excludeFromBonus: true })
        .where(
          and(
            eq(payrollItems.payrollRunId, runId),
            inArray(payrollItems.userId, excludeIds)
          )
        );
    }
    if (includeIds.length > 0) {
      await db
        .update(payrollItems)
        .set({ excludeFromBonus: false })
        .where(
          and(
            eq(payrollItems.payrollRunId, runId),
            inArray(payrollItems.userId, includeIds)
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

    const recalcStatements = recalc.map((r) =>
      db
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
        )
    );
    if (recalcStatements.length > 0) {
      await db.batch(recalcStatements as unknown as Parameters<import('@/db').Db['batch']>[0]);
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
