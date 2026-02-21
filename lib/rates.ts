export type Currency = 'LAK' | 'THB' | 'USD';

export type RateSnapshot = Record<string, number>;

/** 3 คู่หลักที่ผู้ใช้กรอก — ระบบคำนวณคู่ผกผันอัตโนมัติ */
export const BASE_RATE_KEYS = ['THB_LAK', 'USD_THB', 'USD_LAK'] as const;

/** คำนวณทุกคู่จาก 3 คู่หลัก (inverse = 1/rate) */
export function expandRatesFromBase(base: Record<string, number>): RateSnapshot {
  const thbLak = base.THB_LAK;
  const usdThb = base.USD_THB;
  const usdLak = base.USD_LAK;
  const out: RateSnapshot = {};
  if (typeof thbLak === 'number' && thbLak > 0) {
    out.THB_LAK = thbLak;
    out.LAK_THB = 1 / thbLak;
  }
  if (typeof usdThb === 'number' && usdThb > 0) {
    out.USD_THB = usdThb;
    out.THB_USD = 1 / usdThb;
  }
  if (typeof usdLak === 'number' && usdLak > 0) {
    out.USD_LAK = usdLak;
    out.LAK_USD = 1 / usdLak;
  }
  return out;
}

/** ดึง 3 คู่หลักจาก full rates (ใช้ตอนโหลดข้อมูลเก่า) */
export function getBaseRatesFromFull(full: RateSnapshot): Record<string, number> {
  const base: Record<string, number> = {};
  if (typeof full.THB_LAK === 'number') base.THB_LAK = full.THB_LAK;
  else if (typeof full.LAK_THB === 'number' && full.LAK_THB > 0)
    base.THB_LAK = 1 / full.LAK_THB;
  if (typeof full.USD_THB === 'number') base.USD_THB = full.USD_THB;
  else if (typeof full.THB_USD === 'number' && full.THB_USD > 0)
    base.USD_THB = 1 / full.THB_USD;
  if (typeof full.USD_LAK === 'number') base.USD_LAK = full.USD_LAK;
  else if (typeof full.LAK_USD === 'number' && full.LAK_USD > 0)
    base.USD_LAK = 1 / full.LAK_USD;
  return base;
}

export function convertBetween(
  amountMinor: number,
  fromCurrency: Currency,
  toCurrency: Currency,
  rates: RateSnapshot
): number {
  if (fromCurrency === toCurrency) return amountMinor;
  const key = `${fromCurrency}_${toCurrency}`;
  const rate = rates[key];
  if (typeof rate !== 'number') return 0;
  const fromMajor = fromCurrency === 'LAK' ? amountMinor : amountMinor / 100;
  const toMajor = fromMajor * rate;
  return toCurrency === 'LAK' ? Math.round(toMajor) : Math.round(toMajor * 100);
}

export function convertToDisplay(
  amountMinor: number,
  walletCurrency: Currency,
  displayCurrency: Currency,
  rates: RateSnapshot
): number {
  return convertBetween(amountMinor, walletCurrency, displayCurrency, rates);
}

export function convertFromDisplay(
  displayAmountMinor: number,
  displayCurrency: Currency,
  walletCurrency: Currency,
  rates: RateSnapshot
): number {
  return convertBetween(
    displayAmountMinor,
    displayCurrency,
    walletCurrency,
    rates
  );
}

export function getAllRateKeys(): string[] {
  const currencies: Currency[] = ['LAK', 'THB', 'USD'];
  const keys: string[] = [];
  for (const a of currencies) {
    for (const b of currencies) {
      if (a !== b) keys.push(`${a}_${b}`);
    }
  }
  return keys;
}
