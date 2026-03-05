'use client';

import useSWR from 'swr';
import { SWR_CONFIG } from '@/lib/swr-config';

export type Employee = {
  id: number;
  username: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

type EmployeesResponse = { employees: Employee[]; holidayHeadUserId: number | null };

async function fetcher(url: string): Promise<EmployeesResponse> {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Failed to fetch employees');
  return r.json() as Promise<EmployeesResponse>;
}

export function useEmployees(enabled = true) {
  return useSWR<EmployeesResponse>(enabled ? '/api/employees' : null, fetcher, SWR_CONFIG);
}
