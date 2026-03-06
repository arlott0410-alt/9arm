'use client';

import useSWR from 'swr';
import { SWR_CONFIG } from '@/lib/swr-config';

/** รูปแบบรายการธุรกรรมจาก GET /api/transactions (ใช้ type ชัดเจนเพื่อป้องกัน type error ตอน mutate/filter) */
export type TransactionListItem = {
  id: number;
  txnDate: string;
  type: string;
  userFull: string;
  websiteName: string;
  walletName: string;
  walletCurrency: string;
  amountMinor: number;
  withdrawFeeMinor?: number | null;
  depositSlipTime: string | null;
  depositSystemTime: string | null;
  withdrawSlipTime: string | null;
  withdrawSystemTime: string | null;
  createdByUsername: string;
  displayCurrency: string;
  deletedAt?: string | null;
  deletedByUsername?: string | null;
  deleteReason?: string | null;
};

export type TransactionsListResponse = {
  items: TransactionListItem[];
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
