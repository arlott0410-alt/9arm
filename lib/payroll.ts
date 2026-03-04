import type { Db } from '@/db';
import { settings, employeeSalaries, users, holidayEntries, lateArrivals } from '@/db/schema';
import { eq, and, lte, sql, like, inArray } from 'drizzle-orm';

export type PayrollDeduction = { label: string; amountMinor: number };
export type PayrollAllowance = { name: string; amountMinor: number };

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** นับวันหยุดต่อ user ในเดือนที่กำหนด (yearMonth = YYYY-MM) */
export async function getHolidayCountByUser(
  db: Db,
  yearMonth: string
): Promise<Map<number, number>> {
  const [y, m] = yearMonth.split('-').map(Number);
  const prefix = `${y}-${String(m).padStart(2, '0')}-`;
  const rows = await db
    .select({
      userId: holidayEntries.userId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(holidayEntries)
    .where(like(holidayEntries.holidayDate, `${prefix}%`))
    .groupBy(holidayEntries.userId);
  const map = new Map<number, number>();
  for (const r of rows) map.set(r.userId, r.count);
  return map;
}

/** เงินเดือนฐานของ user ณ เดือนที่กำหนด (ใช้ effective_from ล่าสุดที่ <= เดือนนั้น) */
export async function getBaseSalaryForUser(
  db: Db,
  userId: number,
  yearMonth: string
): Promise<{ baseSalaryMinor: number; currency: string } | null> {
  const firstDay = `${yearMonth}-01`;
  const rows = await db
    .select()
    .from(employeeSalaries)
    .where(
      and(
        eq(employeeSalaries.userId, userId),
        lte(employeeSalaries.effectiveFrom, firstDay)
      )
    )
    .orderBy(sql`${employeeSalaries.effectiveFrom} desc`)
    .limit(1);
  if (rows.length === 0) return null;
  return {
    baseSalaryMinor: rows[0].baseSalaryMinor,
    currency: rows[0].currency,
  };
}

export async function getSalaryPolicySettings(db: Db): Promise<{
  freeHolidayDays: number;
  deductMultiplierPerDay: number;
}> {
  const rows = await db
    .select()
    .from(settings)
    .where(
      inArray(settings.key, [
        'SALARY_FREE_HOLIDAY_DAYS',
        'SALARY_DEDUCT_MULTIPLIER_PER_DAY',
      ])
    );
  const obj: Record<string, number> = {};
  for (const r of rows) {
    const v = r.value;
    if (typeof v === 'number') obj[r.key] = v;
    else if (typeof v === 'string') {
      const n = parseInt(v, 10);
      if (!isNaN(n)) obj[r.key] = n;
    }
  }
  return {
    freeHolidayDays: obj.SALARY_FREE_HOLIDAY_DAYS ?? 4,
    deductMultiplierPerDay: obj.SALARY_DEDUCT_MULTIPLIER_PER_DAY ?? 2,
  };
}

/**
 * คำนวณเงินเดือนหลังหักวันหยุด: 4 วันแรกไม่หัก ตั้งแต่วันที่ 5 หัก 2 แรงต่อวัน
 * salaryAfterHolidayMinor = baseSalaryMinor - (วันหยุดที่หัก * 2) * (baseSalaryMinor / totalDays)
 */
export function computeSalaryAfterHoliday(
  baseSalaryMinor: number,
  totalDays: number,
  holidayDays: number,
  freeHolidayDays: number,
  deductMultiplierPerDay: number
): number {
  const deductibleDays = Math.max(0, holidayDays - freeHolidayDays);
  const forceToDeduct = deductibleDays * deductMultiplierPerDay;
  const dailyRate = baseSalaryMinor / totalDays;
  const deductAmount = Math.round(dailyRate * forceToDeduct);
  return Math.max(0, baseSalaryMinor - deductAmount);
}

/**
 * โบนัสจากก้อนรวม แบ่งตามสัดส่วนวันทำงาน
 */
export function computeBonusPortion(
  workingDays: number,
  totalWorkingDaysAll: number,
  bonusPoolMinor: number
): number {
  if (totalWorkingDaysAll <= 0) return 0;
  return Math.round((workingDays / totalWorkingDaysAll) * bonusPoolMinor);
}

/**
 * คำนวณยอดสุทธิ = เงินหลังหักวันหยุด + โบนัส + รายการเพิ่ม(ค่าไฟ/ค่าข้าว/ฯลฯ) − รายการหัก
 */
export function computeNetAmount(
  salaryAfterHolidayMinor: number,
  bonusPortionMinor: number,
  allowances: PayrollAllowance[],
  deductions: PayrollDeduction[]
): {
  totalAllowancesMinor: number;
  totalDeductionsMinor: number;
  netAmountMinor: number;
} {
  const totalAllowancesMinor = allowances.reduce((s, a) => s + a.amountMinor, 0);
  const totalDeductionsMinor = deductions.reduce((s, d) => s + d.amountMinor, 0);
  const netAmountMinor = Math.max(
    0,
    salaryAfterHolidayMinor + bonusPortionMinor + totalAllowancesMinor - totalDeductionsMinor
  );
  return { totalAllowancesMinor, totalDeductionsMinor, netAmountMinor };
}

/** ผลรวมนาทีที่มาสายต่อ user ในเดือนที่กำหนด */
export async function getLateMinutesByUser(
  db: Db,
  yearMonth: string
): Promise<Map<number, number>> {
  const prefix = `${yearMonth}-`;
  const rows = await db
    .select({
      userId: lateArrivals.userId,
      total: sql<number>`sum(${lateArrivals.minutesLate})`.mapWith(Number),
    })
    .from(lateArrivals)
    .where(like(lateArrivals.lateDate, `${prefix}%`))
    .groupBy(lateArrivals.userId);
  const map = new Map<number, number>();
  for (const r of rows) map.set(r.userId, r.total);
  return map;
}

/** ค่าหักมาสาย (นาทีละ 1000 กีบ จาก settings) */
export async function getLatePenaltyPerMinute(db: Db): Promise<number> {
  const rows = await db.select().from(settings).where(eq(settings.key, 'SALARY_LATE_PENALTY_PER_MINUTE')).limit(1);
  if (rows.length === 0) return 1000;
  const v = rows[0].value;
  if (typeof v === 'number' && v >= 0) return v;
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    if (!isNaN(n) && n >= 0) return n;
  }
  return 1000;
}
