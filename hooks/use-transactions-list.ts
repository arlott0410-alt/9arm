'use client';

import useSWR from 'swr';
import { SWR_CONFIG } from '@/lib/swr-config';

export type TransactionsListResponse = {
  items: unknown[];
  page: number;
  pageSize: number;
  totalCount: number;
};

async function fetcher(url: string): Promise<TransactionsListResponse> {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Failed to fetch transactions');
  return r.json() as Promise<TransactionsListResponse>;
}

/** useSWR for transactions list. Key = full URL e.g. /api/transactions?type=DEPOSIT&page=1&... */
export function useTransactionsList(key: string | null) {
  return useSWR<TransactionsListResponse>(key, fetcher, SWR_CONFIG);
}
