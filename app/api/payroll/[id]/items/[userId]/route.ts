import { NextResponse } from 'next/server';
import { getDbAndUser, requireSettings } from '@/lib/api-helpers';
import { payrollRuns, payrollItems } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  computeNetAmount,
  recalcBonusPortions,
  type PayrollDeduction,
  type PayrollAllowance,
} from '@/lib/payroll';

/** PATCH: ตั้งค่ารายการเพิ่ม (ค่าไฟ/ค่าข้าว/ฯลฯ) และรายการหักเงินเดือน. SUPER_ADMIN เท่านั้น, รอบต้องเป็น DRAFT */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireSettings(user);
    if (err) return err;

    const runId = parseInt((await params).id, 10);
    const userId = parseInt((await params).userId, 10);
    if (isNaN(runId) || isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid id or userId' }, { status: 400 });
    }

    const runRows = await db
      .select({ status: payrollRuns.status })
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

    const body = (await request.json()) as {
      allowances?: unknown;
      deductions?: unknown;
      excludeFromBonus?: boolean;
    };
    const itemRowsForAllow = await db
      .select()
      .from(payrollItems)
      .where(
        and(
          eq(payrollItems.payrollRunId, runId),
          eq(payrollItems.userId, userId)
        )
      )
      .limit(1);
    const existing = itemRowsForAllow[0];
    const rawAllowances = Array.isArray(body?.allowances) ? body.allowances : (Array.isArray(existing?.allowances) ? existing.allowances : []);
    const rawDeductions = Array.isArray(body?.deductions) ? body.deductions : (Array.isArray(existing?.deductions) ? existing.deductions : []);

    const allowances: PayrollAllowance[] = rawAllowances
      .filter(
        (x: unknown): x is PayrollAllowance =>
          x != null &&
          typeof x === 'object' &&
          typeof (x as PayrollAllowance).name === 'string' &&
          typeof (x as PayrollAllowance).amountMinor === 'number' &&
          Number.isInteger((x as PayrollAllowance).amountMinor) &&
          (x as PayrollAllowance).amountMinor >= 0
      )
      .map((x) => ({ name: (x as PayrollAllowance).name.trim(), amountMinor: (x as PayrollAllowance).amountMinor }))
      .filter((x) => x.name.length > 0);

    const deductions: PayrollDeduction[] = rawDeductions
      .filter(
        (x: unknown): x is PayrollDeduction =>
          x != null &&
          typeof x === 'object' &&
          typeof (x as PayrollDeduction).label === 'string' &&
          typeof (x as PayrollDeduction).amountMinor === 'number' &&
          Number.isInteger((x as PayrollDeduction).amountMinor) &&
          (x as PayrollDeduction).amountMinor >= 0
      )
      .map((x) => ({ label: (x as PayrollDeduction).label.trim(), amountMinor: (x as PayrollDeduction).amountMinor }))
      .filter((x) => x.label.length > 0);

    if (!existing) {
      return NextResponse.json({ error: 'ไม่พบรายการเงินเดือนของพนักงานนี้' }, { status: 404 });
    }

    const item = existing;

    // กรณีเปลี่ยน "ไม่ได้รับโบนัส" — อัปเดต exclude_from_bonus แล้วคำนวณโบนัสใหม่ทั้งรอบ
    if (typeof body.excludeFromBonus === 'boolean') {
      await db
        .update(payrollItems)
        .set({ excludeFromBonus: body.excludeFromBonus })
        .where(
          and(
            eq(payrollItems.payrollRunId, runId),
            eq(payrollItems.userId, userId)
          )
        );

      const runRows = await db
        .select({ bonusPoolMinor: payrollRuns.bonusPoolMinor })
        .from(payrollRuns)
        .where(eq(payrollRuns.id, runId))
        .limit(1);
      const bonusPoolMinor = runRows[0]?.bonusPoolMinor ?? 0;

      const allItems = await db
        .select()
        .from(payrollItems)
        .where(eq(payrollItems.payrollRunId, runId));

      const itemsForRecalc = allItems.map((i) => ({
        userId: i.userId,
        workingDays: i.workingDays,
        excludeFromBonus: i.userId === userId ? body.excludeFromBonus! : !!i.excludeFromBonus,
        salaryAfterHolidayMinor: i.salaryAfterHolidayMinor,
        allowances: (Array.isArray(i.allowances) ? i.allowances : []) as PayrollAllowance[],
        deductions: (Array.isArray(i.deductions) ? i.deductions : []) as PayrollDeduction[],
        lateDeductionMinor: i.lateDeductionMinor ?? 0,
      }));

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

      const updated = recalc.find((r) => r.userId === userId);
      return NextResponse.json({
        userId,
        excludeFromBonus: body.excludeFromBonus,
        bonusPortionMinor: updated?.bonusPortionMinor ?? 0,
        netAmountMinor: updated?.netAmountMinor ?? item.netAmountMinor,
        recalculated: true,
      });
    }

    const { totalAllowancesMinor: totAll, totalDeductionsMinor: totDed, netAmountMinor: net } = computeNetAmount(
      item.salaryAfterHolidayMinor,
      item.bonusPortionMinor,
      allowances,
      deductions
    );

    await db
      .update(payrollItems)
      .set({
        allowances,
        totalAllowancesMinor: totAll,
        deductions,
        totalDeductionsMinor: totDed,
        netAmountMinor: net,
      })
      .where(
        and(
          eq(payrollItems.payrollRunId, runId),
          eq(payrollItems.userId, userId)
        )
      );

    return NextResponse.json({
      userId,
      allowances,
      totalAllowancesMinor: totAll,
      deductions,
      totalDeductionsMinor: totDed,
      netAmountMinor: net,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
