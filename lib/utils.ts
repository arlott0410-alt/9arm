import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMinorToDisplay(minor: number, currency: string): string {
  if (currency === 'LAK') return minor.toLocaleString();
  const major = minor / 100;
  return major.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

export function parseDisplayToMinor(value: string, currency: string): number {
  const cleaned = value.replace(/,/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  if (currency === 'LAK') return Math.round(num);
  return Math.round(num * 100);
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
