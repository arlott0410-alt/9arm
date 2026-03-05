'use client';

import useSWR from 'swr';
import { SWR_CONFIG } from '@/lib/swr-config';

export type SalaryRow = {
  userId: number;
  username: string;
  baseSalaryMinor: number | null;
  currency: string | null;
  effectiveFrom: string | null;
};

type SalariesResponse = { yearMonth: string; items: SalaryRow[] };

async function fetcher(url: string): Promise<SalariesResponse> {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Failed to fetch salaries');
  return r.json() as Promise<SalariesResponse>;
}

export function useEmployeeSalaries(yearMonth: string) {
  const key = yearMonth ? `/api/employee-salaries?yearMonth=${yearMonth}` : null;
  return useSWR<SalariesResponse>(key, fetcher, SWR_CONFIG);
}
