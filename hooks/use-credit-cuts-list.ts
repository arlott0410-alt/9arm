'use client';

import useSWR from 'swr';
import { SWR_CONFIG } from '@/lib/swr-config';

export type CreditCutsListResponse = {
  items: unknown[];
  page: number;
  pageSize: number;
  totalCount: number;
};

async function fetcher(url: string): Promise<CreditCutsListResponse> {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Failed to fetch credit cuts');
  return r.json() as Promise<CreditCutsListResponse>;
}

export function useCreditCutsList(key: string | null) {
  return useSWR<CreditCutsListResponse>(key, fetcher, SWR_CONFIG);
}
