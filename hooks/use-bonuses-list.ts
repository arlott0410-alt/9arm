'use client';

import useSWR from 'swr';
import { SWR_CONFIG } from '@/lib/swr-config';

export type BonusesListResponse = {
  items: unknown[];
  page: number;
  pageSize: number;
  totalCount: number;
};

async function fetcher(url: string): Promise<BonusesListResponse> {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Failed to fetch bonuses');
  return r.json() as Promise<BonusesListResponse>;
}

export function useBonusesList(key: string | null) {
  return useSWR<BonusesListResponse>(key, fetcher, SWR_CONFIG);
}
