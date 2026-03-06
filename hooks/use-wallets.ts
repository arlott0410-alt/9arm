'use client';

import useSWR from 'swr';
import { SWR_CONFIG } from '@/lib/swr-config';

export type WalletWithBalance = {
  id: number;
  name: string;
  currency: string;
  openingBalanceMinor?: number;
  balance?: number;
  createdAt?: string;
};

async function fetcher(url: string): Promise<WalletWithBalance[]> {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Failed to fetch wallets');
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

export function useWallets(enabled = true) {
  return useSWR<WalletWithBalance[]>(
    enabled ? '/api/wallets?withBalance=1' : null,
    fetcher,
    SWR_CONFIG
  );
}
