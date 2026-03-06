'use client';

import useSWR from 'swr';
import { SWR_CONFIG } from '@/lib/swr-config';

export type TransfersListResponse = {
  items: unknown[];
  page: number;
  pageSize: number;
  totalCount: number;
};

async function fetcher(url: string): Promise<TransfersListResponse> {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Failed to fetch transfers');
  return r.json() as Promise<TransfersListResponse>;
}

export function useTransfersList(key: string | null) {
  return useSWR<TransfersListResponse>(key, fetcher, SWR_CONFIG);
}
