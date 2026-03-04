import { NextResponse } from 'next/server';
import { getDbAndUser, requireSettings } from '@/lib/api-helpers';
import { payrollRuns, payrollItems } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { computeNetAmount, type PayrollDeduction } from '@/lib/payroll';

/** PATCH: ตั้งค่ารายการตัดเงินเดือน (ตัดค่าอะไร จำนวนเท่าไหร่). SUPER_ADMIN เท่านั้น, รอบต้องเป็น DRAFT */
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
        { error: 'แก้ไขรายการตัดได้เฉพาะรอบแบบ DRAFT' },
        { status: 400 }
      );
    }

    const body = (await request.json()) as { deductions?: unknown };
    const raw = body?.deductions;
    if (!Array.isArray(raw)) {
      return NextResponse.json(
        { error: 'ต้องส่ง deductions เป็น array ของ { label, amountMinor }' },
        { status: 400 }
      );
    }

    const deductions: PayrollDeduction[] = raw
      .filter(
        (x: unknown): x is PayrollDeduction =>
          x != null &&
          typeof x === 'object' &&
          typeof (x as PayrollDeduction).label === 'string' &&
          typeof (x as PayrollDeduction).amountMinor === 'number' &&
          Number.isInteger((x as PayrollDeduction).amountMinor) &&
          (x as PayrollDeduction).amountMinor >= 0
      )
      .map((x) => ({ label: x.label.trim(), amountMinor: x.amountMinor }));

    const itemRows = await db
      .select()
      .from(payrollItems)
      .where(
        and(
          eq(payrollItems.payrollRunId, runId),
          eq(payrollItems.userId, userId)
        )
      )
      .limit(1);
    if (itemRows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายการเงินเดือนของพนักงานนี้' }, { status: 404 });
    }

    const item = itemRows[0];
    const { totalDeductionsMinor, netAmountMinor } = computeNetAmount(
      item.salaryAfterHolidayMinor,
      item.bonusPortionMinor,
      deductions
    );

    await db
      .update(payrollItems)
      .set({
        deductions,
        totalDeductionsMinor,
        netAmountMinor,
      })
      .where(
        and(
          eq(payrollItems.payrollRunId, runId),
          eq(payrollItems.userId, userId)
        )
      );

    return NextResponse.json({
      userId,
      deductions,
      totalDeductionsMinor,
      netAmountMinor,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function requireSettings(user: { role: string } | null): NextResponse | null {
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}
