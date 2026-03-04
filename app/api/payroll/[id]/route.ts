import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth, requireSettings } from '@/lib/api-helpers';
import { payrollRuns, payrollItems, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { computeNetAmount, type PayrollDeduction } from '@/lib/payroll';

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
    const role = user!.role as string;

    if (role !== 'SUPER_ADMIN' && run.status !== 'CONFIRMED') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์ดูรอบนี้' }, { status: 403 });
    }

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
        deductions: payrollItems.deductions,
        totalDeductionsMinor: payrollItems.totalDeductionsMinor,
        netAmountMinor: payrollItems.netAmountMinor,
        note: payrollItems.note,
      })
      .from(payrollItems)
      .innerJoin(users, eq(payrollItems.userId, users.id))
      .where(eq(payrollItems.payrollRunId, id));

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
      deductions: (Array.isArray(r.deductions) ? r.deductions : []) as PayrollDeduction[],
      totalDeductionsMinor: r.totalDeductionsMinor,
      netAmountMinor: r.netAmountMinor,
      note: r.note,
    }));

    if (role !== 'SUPER_ADMIN') {
      items = items.filter((i) => i.userId === user!.id);
      if (items.length === 0) {
        return NextResponse.json({ error: 'ไม่มีข้อมูลเงินเดือนของคุณในรอบนี้' }, { status: 404 });
      }
    }

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

/** PATCH: เปลี่ยนสถานะเป็น CONFIRMED หรืออัปเดต bonus_pool (DRAFT). SUPER_ADMIN เท่านั้น */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
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
    if (
      typeof body.bonusPoolMinor === 'number' &&
      runRows[0].status === 'DRAFT' &&
      body.bonusPoolMinor >= 0
    ) {
      await db
        .update(payrollRuns)
        .set({ bonusPoolMinor: Math.round(body.bonusPoolMinor) })
        .where(eq(payrollRuns.id, id));
      return NextResponse.json({
        run: { id, bonusPoolMinor: Math.round(body.bonusPoolMinor) },
      });
    }

    return NextResponse.json(
      { error: 'ส่ง status: CONFIRMED หรือ bonusPoolMinor (DRAFT)' },
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
