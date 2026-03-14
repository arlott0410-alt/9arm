'use client';

import useSWR from 'swr';
import { SWR_CONFIG } from '@/lib/swr-config';

export type PayrollRun = {
  id: number;
  yearMonth: string;
  status: 'DRAFT' | 'CONFIRMED';
  bonusPoolMinor: number | null;
  createdAt: string;
  createdBy: number;
  deletedAt?: string | null;
};

type PayrollRunsResponse = { runs: PayrollRun[] };

async function fetcher(url: string): Promise<PayrollRunsResponse> {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Failed to fetch payroll runs');
  return r.json() as Promise<PayrollRunsResponse>;
}

export function usePayroll(enabled = true) {
  return useSWR<PayrollRunsResponse>(enabled ? '/api/payroll' : null, fetcher, SWR_CONFIG);
}
