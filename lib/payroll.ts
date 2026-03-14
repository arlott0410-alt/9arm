import type { Db } from '@/db';
import { employeeSalaries, users, holidayEntries, lateArrivals } from '@/db/schema';
import { eq, and, lte, gte, or, isNull, sql, like, inArray, desc } from 'drizzle-orm';
import { getSettingValueCached } from '@/lib/get-setting-cached';

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

/** คำนวณวันสุดท้ายของเดือน (YYYY-MM) */
function getLastDayOfMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const lastDate = new Date(y, m, 0);
  return `${y}-${String(m).padStart(2, '0')}-${String(lastDate.getDate()).padStart(2, '0')}`;
}

/** Helper: ดึงเงินเดือนฐานที่มีผลในช่วงวันที่กำหนด (ใช้สำหรับ payroll period) */
export async function getEffectiveBaseSalary(
  db: Db,
  userId: number,
  periodStart: string,
  periodEnd: string
): Promise<number | null> {
  const result = await getBaseSalaryForUserByRange(db, userId, periodStart, periodEnd);
  return result?.baseSalaryMinor ?? null;
}

/** เงินเดือนฐานของ user ณ ช่วงวันที่กำหนด (effective_from <= periodEnd AND (effective_to >= periodStart OR effective_to IS NULL)) */
async function getBaseSalaryForUserByRange(
  db: Db,
  userId: number,
  periodStart: string,
  periodEnd: string
): Promise<{ baseSalaryMinor: number; currency: string } | null> {
  const rows = await db
    .select()
    .from(employeeSalaries)
    .where(
      and(
        eq(employeeSalaries.userId, userId),
        lte(employeeSalaries.effectiveFrom, periodEnd),
        or(
          isNull(employeeSalaries.effectiveTo),
          gte(employeeSalaries.effectiveTo, periodStart)
        )
      )
    )
    .orderBy(desc(employeeSalaries.effectiveFrom))
    .limit(1);
  if (rows.length === 0) return null;
  return {
    baseSalaryMinor: rows[0].baseSalaryMinor,
    currency: rows[0].currency,
  };
}

export async function getBaseSalaryForUser(
  db: Db,
  userId: number,
  yearMonth: string
): Promise<{ baseSalaryMinor: number; currency: string } | null> {
  const periodStart = `${yearMonth}-01`;
  const periodEnd = getLastDayOfMonth(yearMonth);
  return getBaseSalaryForUserByRange(db, userId, periodStart, periodEnd);
}

/** เงินเดือนฐานของหลาย user ในครั้งเดียว — auto-selected จาก effective date range ตาม payroll period */
export async function getBaseSalariesForUsers(
  db: Db,
  userIds: number[],
  yearMonth: string
): Promise<Map<number, { baseSalaryMinor: number; currency: string; effectiveFrom: string }>> {
  if (userIds.length === 0) return new Map();
  const periodStart = `${yearMonth}-01`;
  const periodEnd = getLastDayOfMonth(yearMonth);
  const rows = await db
    .select({
      userId: employeeSalaries.userId,
      baseSalaryMinor: employeeSalaries.baseSalaryMinor,
      currency: employeeSalaries.currency,
      effectiveFrom: employeeSalaries.effectiveFrom,
    })
    .from(employeeSalaries)
    .where(
      and(
        inArray(employeeSalaries.userId, userIds),
        lte(employeeSalaries.effectiveFrom, periodEnd),
        or(
          isNull(employeeSalaries.effectiveTo),
          gte(employeeSalaries.effectiveTo, periodStart)
        )
      )
    )
    .orderBy(employeeSalaries.userId, desc(employeeSalaries.effectiveFrom));
  const map = new Map<number, { baseSalaryMinor: number; currency: string; effectiveFrom: string }>();
  for (const r of rows) {
    if (!map.has(r.userId)) map.set(r.userId, { baseSalaryMinor: r.baseSalaryMinor, currency: r.currency, effectiveFrom: r.effectiveFrom });
  }
  return map;
}

/** เงินเดือนฐานล่าสุดต่อ user (effectiveFrom <= periodEnd, เรียง desc) — ใช้เป็น fallback เมื่อเดือนนั้นยังไม่มี record */
async function getLatestBaseSalariesForUsers(
  db: Db,
  userIds: number[],
  periodEnd: string
): Promise<Map<number, { baseSalaryMinor: number; currency: string; effectiveFrom: string }>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({
      userId: employeeSalaries.userId,
      baseSalaryMinor: employeeSalaries.baseSalaryMinor,
      currency: employeeSalaries.currency,
      effectiveFrom: employeeSalaries.effectiveFrom,
    })
    .from(employeeSalaries)
    .where(
      and(
        inArray(employeeSalaries.userId, userIds),
        lte(employeeSalaries.effectiveFrom, periodEnd)
      )
    )
    .orderBy(employeeSalaries.userId, desc(employeeSalaries.effectiveFrom));
  const map = new Map<number, { baseSalaryMinor: number; currency: string; effectiveFrom: string }>();
  for (const r of rows) {
    if (!map.has(r.userId)) map.set(r.userId, { baseSalaryMinor: r.baseSalaryMinor, currency: r.currency, effectiveFrom: r.effectiveFrom });
  }
  return map;
}

/**
 * เงินเดือนฐานของหลาย user — ใช้ค่าที่ effective ในเดือนนั้นก่อน
 * ถ้าเดือนนั้นยังไม่มี record ให้ใช้ค่าล่าสุดจากประวัติ (ตั้งค่าล่าสุด) เป็น fallback
 * ทำให้ไม่ต้องกรอกเงินเดือนทุกเดือน — แก้เฉพาะเดือนที่ต้องการเปลี่ยน
 */
export async function getBaseSalariesForUsersWithLatestFallback(
  db: Db,
  userIds: number[],
  yearMonth: string
): Promise<Map<number, { baseSalaryMinor: number; currency: string; effectiveFrom: string }>> {
  const periodEnd = getLastDayOfMonth(yearMonth);
  const [primaryMap, fallbackMap] = await Promise.all([
    getBaseSalariesForUsers(db, userIds, yearMonth),
    getLatestBaseSalariesForUsers(db, userIds, periodEnd),
  ]);
  const result = new Map(primaryMap);
  for (const userId of userIds) {
    if (!result.has(userId) && fallbackMap.has(userId)) {
      result.set(userId, fallbackMap.get(userId)!);
    }
  }
  return result;
}

export async function getSalaryPolicySettings(db: Db): Promise<{
  freeHolidayDays: number;
  deductMultiplierPerDay: number;
}> {
  function toInt(v: unknown, def: number): number {
    if (typeof v === 'number' && !isNaN(v)) return v;
    if (typeof v === 'string') {
      const n = parseInt(v, 10);
      if (!isNaN(n)) return n;
    }
    return def;
  }
  const [freeHolidayDays, deductMultiplierPerDay] = await Promise.all([
    getSettingValueCached(db, 'SALARY_FREE_HOLIDAY_DAYS').then((v) => toInt(v, 4)),
    getSettingValueCached(db, 'SALARY_DEDUCT_MULTIPLIER_PER_DAY').then((v) => toInt(v, 2)),
  ]);
  return { freeHolidayDays, deductMultiplierPerDay };
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
 * พนักงานที่ excludeFromBonus จะไม่นับวันทำงานเข้า totalWorkingDaysAll
 */
export function computeBonusPortion(
  workingDays: number,
  totalWorkingDaysAll: number,
  bonusPoolMinor: number
): number {
  if (totalWorkingDaysAll <= 0) return 0;
  return Math.round((workingDays / totalWorkingDaysAll) * bonusPoolMinor);
}

export type PayrollItemForRecalc = {
  userId: number;
  workingDays: number;
  excludeFromBonus: boolean;
  salaryAfterHolidayMinor: number;
  allowances: PayrollAllowance[];
  deductions: PayrollDeduction[];
  lateDeductionMinor: number;
};

/**
 * คำนวณโบนัสใหม่เมื่อมีการเปลี่ยน exclude_from_bonus
 * รวมเฉพาะพนักงานที่ไม่ถูก exclude เข้า totalWorkingDaysAll
 */
export function recalcBonusPortions(
  items: PayrollItemForRecalc[],
  bonusPoolMinor: number
): { userId: number; bonusPortionMinor: number; netAmountMinor: number }[] {
  const totalWorkingDaysAll = items
    .filter((i) => !i.excludeFromBonus)
    .reduce((s, i) => s + i.workingDays, 0);
  return items.map((item) => {
    const bonusPortionMinor = item.excludeFromBonus
      ? 0
      : computeBonusPortion(item.workingDays, totalWorkingDaysAll, bonusPoolMinor);
    const { netAmountMinor } = computeNetAmount(
      item.salaryAfterHolidayMinor,
      bonusPortionMinor,
      item.allowances,
      item.deductions
    );
    return {
      userId: item.userId,
      bonusPortionMinor,
      netAmountMinor: Math.max(0, netAmountMinor - item.lateDeductionMinor),
    };
  });
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

/** ค่าหักมาสาย (นาทีละ 1000 กีบ จาก settings, cached) */
export async function getLatePenaltyPerMinute(db: Db): Promise<number> {
  const v = await getSettingValueCached(db, 'SALARY_LATE_PENALTY_PER_MINUTE');
  if (typeof v === 'number' && v >= 0) return v;
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    if (!isNaN(n) && n >= 0) return n;
  }
  return 1000;
}
