'use client';

import useSWR from 'swr';
import { SWR_CONFIG } from '@/lib/swr-config';

export type DashboardData = {
  displayCurrency: string;
  websites: { id: number; name: string; prefix: string }[];
  today: { deposits: number; withdraws: number; net: number };
  month: { deposits: number; withdraws: number; net: number };
  wallets: { id: number; name: string; currency: string; balance: number }[];
};

async function fetcher(url: string): Promise<DashboardData> {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Failed to fetch dashboard');
  return r.json() as Promise<DashboardData>;
}

/** Cache key ตาม filter — เปลี่ยน websiteId ถึง refetch. ส่ง null เพื่อไม่ fetch เมื่อยังไม่ login */
export function useDashboard(websiteId: string, enabled = true) {
  const params = new URLSearchParams();
  if (websiteId !== '__all__') params.set('websiteId', websiteId);
  const key = enabled ? `/api/dashboard?${params.toString()}` : null;
  return useSWR(key, fetcher, {
    ...SWR_CONFIG,
    revalidateIfStale: true,
  });
}
