import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMinorToDisplay(minor: number, currency: string): string {
  if (currency === 'LAK') return minor.toLocaleString();
  const major = minor / 100;
  const frac =
    currency === 'THB'
      ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
      : { minimumFractionDigits: 2 };
  return major.toLocaleString(undefined, frac);
}

export function parseDisplayToMinor(value: string, currency: string): number {
  const cleaned = value.replace(/,/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  if (currency === 'LAK') return Math.round(num);
  if (currency === 'THB') return Math.round(Math.floor(num) * 100);
  return Math.round(num * 100);
}

/** Thailand timezone UTC+7 */
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export function todayStr(): string {
  const thai = new Date(Date.now() + BANGKOK_OFFSET_MS);
  const y = thai.getUTCFullYear();
  const m = String(thai.getUTCMonth() + 1).padStart(2, '0');
  const d = String(thai.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Format YYYY-MM-DD to Thailand DD/MM/YYYY */
export function formatDateThailand(val: string | null | undefined): string {
  if (!val || typeof val !== 'string') return '-';
  const parts = val.split('-');
  if (parts.length !== 3) return val;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/** Today's date in Thailand timezone (YYYY-MM-DD). Safe for server or client. */
export function todayStrThailand(): string {
  const thai = new Date(Date.now() + BANGKOK_OFFSET_MS);
  const y = thai.getUTCFullYear();
  const m = String(thai.getUTCMonth() + 1).padStart(2, '0');
  const d = String(thai.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Format ISO string or Date to Thailand time "DD/MM/YYYY HH:MM" (no seconds) */
export function formatDateTimeThailand(val: string | Date | null | undefined): string {
  if (val == null) return '-';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return '-';
  const thai = new Date(d.getTime() + BANGKOK_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(thai.getUTCDate())}/${pad(thai.getUTCMonth() + 1)}/${thai.getUTCFullYear()} ${pad(thai.getUTCHours())}:${pad(thai.getUTCMinutes())}`;
}

/** Extract HH:MM from slip time (e.g. "2026-02-21T23:00" or "2026-02-21T23:00:00" -> "23:00") */
export function formatSlipTimeHHMM(val: string | null | undefined): string {
  if (!val || typeof val !== 'string') return '-';
  const t = val.includes('T') ? val.split('T')[1] : val;
  const parts = t?.split(':') ?? [];
  if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  return val;
}
