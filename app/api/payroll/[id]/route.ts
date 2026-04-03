import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth, requireSettings } from '@/lib/api-helpers';
import { payrollRuns, payrollItems, users } from '@/db/schema';
import { eq, and, SQL } from 'drizzle-orm';
import {
  recalcBonusPortions,
  type PayrollDeduction,
  type PayrollAllowance,
} from '@/lib/payroll';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const authErr = requireAuth(user);
    if (authErr) return authErr;

    const id = parseInt((await params).id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid run id' }, { status: 400 });
    }

    const runRows = await db
      .select()
      .from(payrollRuns)
      .where(eq(payrollRuns.id, id))
      .limit(1);
    if (runRows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรอบเงินเดือน' }, { status: 404 });
    }
    const run = runRows[0];
    if (run.deletedAt) {
      return NextResponse.json({ error: 'ไม่พบรอบเงินเดือน' }, { status: 404 });
    }
    const role = user!.role as string;

    if (role !== 'SUPER_ADMIN' && run.status !== 'CONFIRMED') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์ดูรอบนี้' }, { status: 403 });
    }

    const itemWhere: SQL<unknown> =
      role === 'ADMIN'
        ? and(
            eq(payrollItems.payrollRunId, id),
            eq(payrollItems.userId, user!.id)
          )!
        : eq(payrollItems.payrollRunId, id);

    const itemRows = await db
      .select({
        id: payrollItems.id,
        userId: payrollItems.userId,
        username: users.username,
        baseSalaryMinor: payrollItems.baseSalaryMinor,
        totalDays: payrollItems.totalDays,
        holidayDays: payrollItems.holidayDays,
        workingDays: payrollItems.workingDays,
        salaryAfterHolidayMinor: payrollItems.salaryAfterHolidayMinor,
        bonusPortionMinor: payrollItems.bonusPortionMinor,
        allowances: payrollItems.allowances,
        totalAllowancesMinor: payrollItems.totalAllowancesMinor,
        deductions: payrollItems.deductions,
        totalDeductionsMinor: payrollItems.totalDeductionsMinor,
        lateMinutes: payrollItems.lateMinutes,
        lateDeductionMinor: payrollItems.lateDeductionMinor,
        netAmountMinor: payrollItems.netAmountMinor,
        note: payrollItems.note,
        excludeFromBonus: payrollItems.excludeFromBonus,
        overrideBaseSalaryMinor: payrollItems.overrideBaseSalaryMinor,
      })
      .from(payrollItems)
      .innerJoin(users, eq(payrollItems.userId, users.id))
      .where(itemWhere);

    let items = itemRows.map((r) => ({
      id: r.id,
      userId: r.userId,
      username: r.username,
      baseSalaryMinor: r.baseSalaryMinor,
      totalDays: r.totalDays,
      holidayDays: r.holidayDays,
      workingDays: r.workingDays,
      salaryAfterHolidayMinor: r.salaryAfterHolidayMinor,
      bonusPortionMinor: r.bonusPortionMinor,
      allowances: (Array.isArray(r.allowances) ? r.allowances : []) as PayrollAllowance[],
      totalAllowancesMinor: r.totalAllowancesMinor ?? 0,
      deductions: (Array.isArray(r.deductions) ? r.deductions : []) as PayrollDeduction[],
      totalDeductionsMinor: r.totalDeductionsMinor,
      lateMinutes: r.lateMinutes ?? 0,
      lateDeductionMinor: r.lateDeductionMinor ?? 0,
      netAmountMinor: r.netAmountMinor,
      note: r.note,
      excludeFromBonus: !!r.excludeFromBonus,
      overrideBaseSalaryMinor: r.overrideBaseSalaryMinor ?? null,
    }));

    if (role === 'ADMIN' && items.length === 0) {
      return NextResponse.json({ error: 'ไม่มีข้อมูลเงินเดือนของคุณในรอบนี้' }, { status: 404 });
    }
    // SUPER_ADMIN และ AUDIT เห็นรายการทุกคน (AUDIT เฉพาะรอบ CONFIRMED)

    return NextResponse.json({
      run: {
        id: run.id,
        yearMonth: run.yearMonth,
        status: run.status,
        bonusPoolMinor: run.bonusPoolMinor,
        createdAt: run.createdAt,
        createdBy: run.createdBy,
      },
      items,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/** PATCH: เปลี่ยนสถานะ CONFIRMED/DRAFT หรืออัปเดต bonus_pool (DRAFT). SUPER_ADMIN เท่านั้น */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const authErr = requireAuth(user);
    if (authErr) return authErr;
    if ((user!.role as string) !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 });
    }
    const err = requireSettings(user);
    if (err) return err;

    const id = parseInt((await params).id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid run id' }, { status: 400 });
    }

    const runRows = await db
      .select()
      .from(payrollRuns)
      .where(eq(payrollRuns.id, id))
      .limit(1);
    if (runRows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรอบเงินเดือน' }, { status: 404 });
    }

    const body = (await request.json()) as { status?: string; bonusPoolMinor?: number };
    if (body.status === 'CONFIRMED') {
      await db
        .update(payrollRuns)
        .set({ status: 'CONFIRMED' })
        .where(eq(payrollRuns.id, id));
      return NextResponse.json({ run: { id, status: 'CONFIRMED' } });
    }
    // เปิดแก้ไขรอบที่ยืนยันแล้ว (เปลี่ยนกลับเป็น DRAFT)
    if (body.status === 'DRAFT' && runRows[0].status === 'CONFIRMED') {
      await db
        .update(payrollRuns)
        .set({ status: 'DRAFT' })
        .where(eq(payrollRuns.id, id));
      return NextResponse.json({ run: { id, status: 'DRAFT' } });
    }
    if (
      typeof body.bonusPoolMinor === 'number' &&
      runRows[0].status === 'DRAFT' &&
      body.bonusPoolMinor >= 0
    ) {
      const newBonusPool = Math.round(body.bonusPoolMinor);
      await db
        .update(payrollRuns)
        .set({ bonusPoolMinor: newBonusPool })
        .where(eq(payrollRuns.id, id));

      const allItems = await db
        .select()
        .from(payrollItems)
        .where(eq(payrollItems.payrollRunId, id));
      const itemsForRecalc = allItems.map((i) => ({
        userId: i.userId,
        workingDays: i.workingDays,
        excludeFromBonus: !!i.excludeFromBonus,
        salaryAfterHolidayMinor: i.salaryAfterHolidayMinor,
        allowances: (Array.isArray(i.allowances) ? i.allowances : []) as PayrollAllowance[],
        deductions: (Array.isArray(i.deductions) ? i.deductions : []) as PayrollDeduction[],
        lateDeductionMinor: i.lateDeductionMinor ?? 0,
      }));
      const recalc = recalcBonusPortions(itemsForRecalc, newBonusPool);
      const recalcStatements = recalc.map((r) =>
        db
          .update(payrollItems)
          .set({
            bonusPortionMinor: r.bonusPortionMinor,
            netAmountMinor: r.netAmountMinor,
          })
          .where(
            and(
              eq(payrollItems.payrollRunId, id),
              eq(payrollItems.userId, r.userId)
            )
          )
      );
      if (recalcStatements.length > 0) {
        await db.batch(recalcStatements as unknown as Parameters<import('@/db').Db['batch']>[0]);
      }

      return NextResponse.json({
        run: { id, bonusPoolMinor: newBonusPool },
      });
    }

    return NextResponse.json(
      { error: 'ส่ง status: CONFIRMED หรือ DRAFT (เปิดแก้ไข) หรือ bonusPoolMinor (DRAFT)' },
      { status: 400 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/** DELETE: Soft delete draft payroll run. SUPER_ADMIN only. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const authErr = requireAuth(user);
    if (authErr) return authErr;
    if ((user!.role as string) !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 });
    }
    const err = requireSettings(user);
    if (err) return err;

    const id = parseInt((await params).id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid run id' }, { status: 400 });
    }

    const runRows = await db
      .select({ status: payrollRuns.status })
      .from(payrollRuns)
      .where(eq(payrollRuns.id, id))
      .limit(1);
    if (runRows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรอบเงินเดือน' }, { status: 404 });
    }
    if (runRows[0].status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'ลบได้เฉพาะรอบแบบร่าง (DRAFT)' },
        { status: 400 }
      );
    }

    await db
      .update(payrollRuns)
      .set({ deletedAt: new Date() })
      .where(eq(payrollRuns.id, id));

    return NextResponse.json({ deleted: true, id });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
