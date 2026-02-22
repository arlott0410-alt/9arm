'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMinorToDisplay } from '@/lib/utils';
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  BarChart3,
  PiggyBank,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(
    null
  );
  const [filterWebsite, setFilterWebsite] = useState('__all__');
  const [websites, setWebsites] = useState<{ id: number; name: string; prefix: string }[]>([]);
  const [data, setData] = useState<{
    displayCurrency: string;
    today: { deposits: number; withdraws: number; net: number };
    month: { deposits: number; withdraws: number; net: number };
    wallets: { id: number; name: string; currency: string; balance: number }[];
  } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json() as Promise<{ user?: { username: string; role: string } }>)
      .then((d) => {
        if (!d.user) {
          router.replace('/login');
          return;
        }
        setUser(d.user);
      });
  }, [router]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/settings/websites').then((r) => r.json() as Promise<{ id: number; name: string; prefix: string }[]>).then((w) => setWebsites(Array.isArray(w) ? w : []));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams();
    if (filterWebsite !== '__all__') params.set('websiteId', filterWebsite);
    fetch(`/api/dashboard?${params}`)
      .then((r) => r.json() as Promise<{
        displayCurrency: string;
        today: { deposits: number; withdraws: number; net: number };
        month: { deposits: number; withdraws: number; net: number };
        wallets: { id: number; name: string; currency: string; balance: number }[];
      }>)
      .then(setData)
      .catch(console.error);
  }, [user, filterWebsite]);

  if (!user) return null;

  const cur = data?.displayCurrency || 'THB';

  const maxBar = Math.max(
    data?.today.deposits ?? 0,
    data?.today.withdraws ?? 0,
    data?.month.deposits ?? 0,
    data?.month.withdraws ?? 0,
    1
  );

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-[#E5E7EB]">แดชบอร์ด</h1>
          <div className="flex items-center gap-2">
            <label className="text-sm text-[#9CA3AF]">เว็บ</label>
            <select
              value={filterWebsite}
              onChange={(e) => setFilterWebsite(e.target.value)}
              className="h-10 rounded-lg border border-[#2D3748] bg-[#0F172A] px-4 text-sm text-[#E5E7EB] focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/50"
            >
              <option value="__all__">ทั้งหมด</option>
              {websites.map((w) => (
                <option key={w.id} value={String(w.id)}>{w.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary Cards - 4 main metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="overflow-hidden border border-[#2D3748] bg-gradient-to-br from-[#0F172A] to-[#1E293B] shadow-lg shadow-black/20 ring-1 ring-[#D4AF37]/20">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-[#9CA3AF]">Total Deposits</p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {data
                      ? `${formatMinorToDisplay(data.month.deposits, cur)} ${cur}`
                      : '-'}
                  </p>
                  <p className="mt-1 text-xs text-[#6B7280]">ฝากเดือนนี้</p>
                </div>
                <div className="rounded-lg bg-[#D4AF37]/10 p-3">
                  <Wallet className="h-6 w-6 text-[#D4AF37]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border border-[#2D3748] bg-gradient-to-br from-[#0F172A] to-[#1E293B] shadow-lg shadow-black/20 ring-1 ring-[#D4AF37]/20">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-[#9CA3AF]">Total Withdrawals</p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {data
                      ? `${formatMinorToDisplay(data.month.withdraws, cur)} ${cur}`
                      : '-'}
                  </p>
                  <p className="mt-1 text-xs text-[#6B7280]">ถอนเดือนนี้</p>
                </div>
                <div className="rounded-lg bg-[#D4AF37]/10 p-3">
                  <ArrowUpCircle className="h-6 w-6 text-[#D4AF37]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border border-[#2D3748] bg-gradient-to-br from-[#0F172A] to-[#1E293B] shadow-lg shadow-black/20 ring-1 ring-emerald-500/20">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-[#9CA3AF]">Daily Profit / Loss</p>
                  <p
                    className={`mt-2 flex items-center gap-1 text-2xl font-bold ${
                      data && data.today.net >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {data?.today.net !== undefined && data.today.net < 0 && '-'}
                    {data
                      ? `${formatMinorToDisplay(Math.abs(data.today.net), cur)} ${cur}`
                      : '-'}
                    {data && data.today.net >= 0 && (
                      <TrendingUp className="h-5 w-5" strokeWidth={2.5} />
                    )}
                  </p>
                  <p className="mt-1 text-xs text-[#6B7280]">สุทธิวันนี้</p>
                </div>
                <div
                  className={`rounded-lg p-3 ${
                    data && data.today.net >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'
                  }`}
                >
                  <BarChart3
                    className={`h-6 w-6 ${
                      data && data.today.net >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border border-[#2D3748] bg-gradient-to-br from-[#0F172A] to-[#1E293B] shadow-lg shadow-black/20 ring-1 ring-emerald-500/20">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-[#9CA3AF]">Monthly Profit / Loss</p>
                  <p
                    className={`mt-2 flex items-center gap-1 text-2xl font-bold ${
                      data && data.month.net >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {data?.month.net !== undefined && data.month.net < 0 && '-'}
                    {data
                      ? `${formatMinorToDisplay(Math.abs(data.month.net), cur)} ${cur}`
                      : '-'}
                    {data && data.month.net >= 0 && (
                      <TrendingUp className="h-5 w-5" strokeWidth={2.5} />
                    )}
                  </p>
                  <p className="mt-1 text-xs text-[#6B7280]">สุทธิเดือนนี้</p>
                </div>
                <div
                  className={`rounded-lg p-3 ${
                    data && data.month.net >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'
                  }`}
                >
                  <PiggyBank
                    className={`h-6 w-6 ${
                      data && data.month.net >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Daily Performance */}
          <Card className="overflow-hidden border border-[#2D3748] bg-gradient-to-br from-[#0F172A] to-[#1E293B] shadow-lg shadow-black/20 ring-1 ring-[#D4AF37]/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold text-[#E5E7EB]">
                Daily Performance
              </CardTitle>
              <p className="text-xs text-[#9CA3AF]">ยอดฝาก-ถอนวันนี้</p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex justify-between text-xs">
                    <span className="text-[#9CA3AF]">ฝาก</span>
                    <span className="font-medium text-[#D4AF37]">
                      {data ? formatMinorToDisplay(data.today.deposits, cur) : '0'} {cur}
                    </span>
                  </div>
                  <div className="h-8 overflow-hidden rounded-lg bg-[#1F2937]">
                    <div
                      className="h-full rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#E5C76B] transition-all"
                      style={{
                        width: `${maxBar ? Math.min(100, (data?.today.deposits ?? 0) / maxBar * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex justify-between text-xs">
                    <span className="text-[#9CA3AF]">ถอน</span>
                    <span className="font-medium text-[#6B7280]">
                      {data ? formatMinorToDisplay(data.today.withdraws, cur) : '0'} {cur}
                    </span>
                  </div>
                  <div className="h-8 overflow-hidden rounded-lg bg-[#1F2937]">
                    <div
                      className="h-full rounded-lg bg-gradient-to-r from-[#4B5563] to-[#6B7280] transition-all"
                      style={{
                        width: `${maxBar ? Math.min(100, (data?.today.withdraws ?? 0) / maxBar * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-[#2D3748] bg-[#111827]/50 px-4 py-3">
                  <span className="text-xs text-[#9CA3AF]">สุทธิวันนี้</span>
                  <p
                    className={`text-lg font-bold ${
                      data && data.today.net >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {data?.today.net !== undefined && data.today.net < 0 ? '-' : '+'}
                    {data ? formatMinorToDisplay(Math.abs(data.today.net), cur) : '0'} {cur}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Overview */}
          <Card className="overflow-hidden border border-[#2D3748] bg-gradient-to-br from-[#0F172A] to-[#1E293B] shadow-lg shadow-black/20 ring-1 ring-[#D4AF37]/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold text-[#E5E7EB]">
                Monthly Overview
              </CardTitle>
              <p className="text-xs text-[#9CA3AF]">ยอดฝาก-ถอนเดือนนี้</p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex justify-between text-xs">
                    <span className="text-[#9CA3AF]">ฝาก</span>
                    <span className="font-medium text-[#D4AF37]">
                      {data ? formatMinorToDisplay(data.month.deposits, cur) : '0'} {cur}
                    </span>
                  </div>
                  <div className="h-8 overflow-hidden rounded-lg bg-[#1F2937]">
                    <div
                      className="h-full rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#E5C76B] transition-all"
                      style={{
                        width: `${maxBar ? Math.min(100, (data?.month.deposits ?? 0) / maxBar * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex justify-between text-xs">
                    <span className="text-[#9CA3AF]">ถอน</span>
                    <span className="font-medium text-[#6B7280]">
                      {data ? formatMinorToDisplay(data.month.withdraws, cur) : '0'} {cur}
                    </span>
                  </div>
                  <div className="h-8 overflow-hidden rounded-lg bg-[#1F2937]">
                    <div
                      className="h-full rounded-lg bg-gradient-to-r from-[#4B5563] to-[#6B7280] transition-all"
                      style={{
                        width: `${maxBar ? Math.min(100, (data?.month.withdraws ?? 0) / maxBar * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-[#2D3748] bg-[#111827]/50 px-4 py-3">
                  <span className="text-xs text-[#9CA3AF]">สุทธิเดือนนี้</span>
                  <p
                    className={`text-lg font-bold ${
                      data && data.month.net >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {data?.month.net !== undefined && data.month.net < 0 ? '-' : '+'}
                    {data ? formatMinorToDisplay(Math.abs(data.month.net), cur) : '0'} {cur}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Wallets Table */}
        <Card className="overflow-hidden border border-[#2D3748] bg-gradient-to-br from-[#0F172A] to-[#1E293B] shadow-lg shadow-black/20 ring-1 ring-[#D4AF37]/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#E5E7EB]">
              <ArrowDownCircle className="h-5 w-5 text-[#D4AF37]" />
              ยอดกระเป๋าเงิน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2D3748]">
                    <th className="py-3 text-left font-medium text-[#9CA3AF]">
                      กระเป๋าเงิน
                    </th>
                    <th className="py-3 text-left font-medium text-[#9CA3AF]">
                      สกุลเงิน
                    </th>
                    <th className="py-3 text-right font-medium text-[#9CA3AF]">
                      ยอดคงเหลือ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data?.wallets.map((w) => (
                    <tr
                      key={w.id}
                      className="border-b border-[#2D3748]/50 last:border-0 transition-colors hover:bg-[#1E293B]/50"
                    >
                      <td className="py-3 text-[#E5E7EB]">{w.name}</td>
                      <td className="py-3 text-[#9CA3AF]">{w.currency}</td>
                      <td className="py-3 text-right font-semibold text-[#D4AF37]">
                        {formatMinorToDisplay(w.balance, w.currency)} {w.currency}
                      </td>
                    </tr>
                  ))}
                  {(!data?.wallets || data.wallets.length === 0) && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-[#9CA3AF]">
                        ไม่มีกระเป๋าเงิน
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
