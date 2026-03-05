'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMinorToDisplay } from '@/lib/utils';
import { useAuth } from '@/components/providers/AuthProvider';
import { useDashboard } from '@/hooks/use-dashboard';
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
  const { user, loading: authLoading } = useAuth();
  const [filterWebsite, setFilterWebsite] = useState('__all__');
  const { data, isLoading: dataLoading } = useDashboard(filterWebsite, !!user);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  const cur = data?.displayCurrency || 'THB';

  const cardBase =
    'overflow-hidden border border-[#2D3748] bg-gradient-to-br from-[#0F172A] to-[#1E293B] shadow-lg shadow-black/20 min-h-[120px] flex flex-col';

  const skeletonCard = (
    <div className={`${cardBase} animate-pulse ring-1 ring-[#2D3748]`}>
      <div className="flex flex-1 flex-col p-5">
        <div className="h-4 w-24 rounded bg-[#2D3748]" />
        <div className="mt-4 h-7 w-28 rounded bg-[#2D3748] ml-auto" />
        <div className="mt-1 h-3 w-10 rounded bg-[#2D3748] ml-auto" />
      </div>
    </div>
  );

  return (
    <AppLayout user={user}>
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-[#E5E7EB]">แดชบอร์ด</h1>
          <div className="flex items-center gap-2">
            <label className="text-sm text-[#9CA3AF]">เว็บ</label>
            <select
              value={filterWebsite}
              onChange={(e) => setFilterWebsite(e.target.value)}
              className="h-10 rounded-lg border border-[#2D3748] bg-[#0F172A] px-4 text-sm text-[#E5E7EB] focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/50"
            >
              <option value="__all__">ทั้งหมด</option>
              {(data?.websites ?? []).map((w) => (
                <option key={w.id} value={String(w.id)}>{w.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ยอดฝากถอนรายวัน รายเดือน */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
          {dataLoading ? (
            <>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i}>{skeletonCard}</div>
              ))}
            </>
          ) : (
          <>
          <Card className={`${cardBase} ring-1 ring-[#D4AF37]/20`}>
            <CardContent className="flex flex-1 flex-col p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#9CA3AF]">ฝากรายวัน</p>
                <div className="rounded-lg bg-[#D4AF37]/10 p-2.5">
                  <Wallet className="h-5 w-5 text-[#D4AF37]" />
                </div>
              </div>
              <p className="mt-4 text-right font-mono text-xl font-bold tabular-nums text-[#D4AF37]">
                {data ? formatMinorToDisplay(data.today.deposits, cur) : '-'}
              </p>
              <p className="mt-0.5 text-right text-xs text-[#6B7280]">{cur}</p>
            </CardContent>
          </Card>

          <Card className={`${cardBase} ring-1 ring-[#D4AF37]/20`}>
            <CardContent className="flex flex-1 flex-col p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#9CA3AF]">ถอนรายวัน</p>
                <div className="rounded-lg bg-[#6B7280]/20 p-2.5">
                  <ArrowUpCircle className="h-5 w-5 text-[#9CA3AF]" />
                </div>
              </div>
              <p className="mt-4 text-right font-mono text-xl font-bold tabular-nums text-white">
                {data ? formatMinorToDisplay(data.today.withdraws, cur) : '-'}
              </p>
              <p className="mt-0.5 text-right text-xs text-[#6B7280]">{cur}</p>
            </CardContent>
          </Card>

          <Card className={`${cardBase} ring-1 ring-emerald-500/20`}>
            <CardContent className="flex flex-1 flex-col p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#9CA3AF]">สุทธิวันนี้</p>
                <div
                  className={`rounded-lg p-2.5 ${
                    data && data.today.net >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'
                  }`}
                >
                  <BarChart3
                    className={`h-5 w-5 ${
                      data && data.today.net >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end gap-1.5">
                {data?.today.net !== undefined && data.today.net < 0 && (
                  <span className="font-mono text-xl font-bold tabular-nums text-red-400">−</span>
                )}
                <p
                  className={`font-mono text-xl font-bold tabular-nums ${
                    data && data.today.net >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {data ? formatMinorToDisplay(Math.abs(data.today.net), cur) : '-'}
                </p>
                {data && data.today.net >= 0 && (
                  <TrendingUp className="h-4 w-4 text-emerald-400" strokeWidth={2.5} />
                )}
              </div>
              <p className="mt-0.5 text-right text-xs text-[#6B7280]">{cur}</p>
            </CardContent>
          </Card>

          <Card className={`${cardBase} ring-1 ring-[#D4AF37]/20`}>
            <CardContent className="flex flex-1 flex-col p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#9CA3AF]">ฝากรายเดือน</p>
                <div className="rounded-lg bg-[#D4AF37]/10 p-2.5">
                  <Wallet className="h-5 w-5 text-[#D4AF37]" />
                </div>
              </div>
              <p className="mt-4 text-right font-mono text-xl font-bold tabular-nums text-[#D4AF37]">
                {data ? formatMinorToDisplay(data.month.deposits, cur) : '-'}
              </p>
              <p className="mt-0.5 text-right text-xs text-[#6B7280]">{cur}</p>
            </CardContent>
          </Card>

          <Card className={`${cardBase} ring-1 ring-[#D4AF37]/20`}>
            <CardContent className="flex flex-1 flex-col p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#9CA3AF]">ถอนรายเดือน</p>
                <div className="rounded-lg bg-[#6B7280]/20 p-2.5">
                  <ArrowUpCircle className="h-5 w-5 text-[#9CA3AF]" />
                </div>
              </div>
              <p className="mt-4 text-right font-mono text-xl font-bold tabular-nums text-white">
                {data ? formatMinorToDisplay(data.month.withdraws, cur) : '-'}
              </p>
              <p className="mt-0.5 text-right text-xs text-[#6B7280]">{cur}</p>
            </CardContent>
          </Card>

          <Card className={`${cardBase} ring-1 ring-emerald-500/20`}>
            <CardContent className="flex flex-1 flex-col p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#9CA3AF]">สุทธิเดือนนี้</p>
                <div
                  className={`rounded-lg p-2.5 ${
                    data && data.month.net >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'
                  }`}
                >
                  <PiggyBank
                    className={`h-5 w-5 ${
                      data && data.month.net >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end gap-1.5">
                {data?.month.net !== undefined && data.month.net < 0 && (
                  <span className="font-mono text-xl font-bold tabular-nums text-red-400">−</span>
                )}
                <p
                  className={`font-mono text-xl font-bold tabular-nums ${
                    data && data.month.net >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {data ? formatMinorToDisplay(Math.abs(data.month.net), cur) : '-'}
                </p>
                {data && data.month.net >= 0 && (
                  <TrendingUp className="h-4 w-4 text-emerald-400" strokeWidth={2.5} />
                )}
              </div>
              <p className="mt-0.5 text-right text-xs text-[#6B7280]">{cur}</p>
            </CardContent>
          </Card>
          </>
          )}
        </div>

        {/* ยอดกระเป๋าเงิน */}
        <Card className="overflow-hidden border border-[#2D3748] bg-gradient-to-br from-[#0F172A] to-[#1E293B] shadow-lg shadow-black/20 ring-1 ring-[#D4AF37]/10">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#E5E7EB]">
              <ArrowDownCircle className="h-5 w-5 text-[#D4AF37]" />
              ยอดกระเป๋าเงิน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {dataLoading ? (
                <div className="space-y-3 py-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-4 animate-pulse">
                      <div className="h-5 w-32 rounded bg-[#2D3748]" />
                      <div className="h-5 w-12 rounded bg-[#2D3748]" />
                      <div className="h-5 w-24 rounded bg-[#2D3748] ml-auto" />
                    </div>
                  ))}
                </div>
              ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2D3748]">
                    <th className="py-3.5 text-left font-medium text-[#9CA3AF]">กระเป๋าเงิน</th>
                    <th className="py-3.5 text-left font-medium text-[#9CA3AF]">สกุลเงิน</th>
                    <th className="py-3.5 text-right font-medium text-[#9CA3AF]">ยอดคงเหลือ</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.wallets.map((w) => (
                    <tr
                      key={w.id}
                      className="border-b border-[#2D3748]/50 last:border-0 transition-colors hover:bg-[#1E293B]/50"
                    >
                      <td className="py-3.5 text-[#E5E7EB]">{w.name}</td>
                      <td className="py-3.5 text-[#9CA3AF]">{w.currency}</td>
                      <td className="py-3.5 text-right font-mono font-semibold tabular-nums text-[#D4AF37]">
                        {formatMinorToDisplay(w.balance, w.currency)} {w.currency}
                      </td>
                    </tr>
                  ))}
                  {(!data?.wallets || data.wallets.length === 0) && (
                    <tr>
                      <td colSpan={3} className="py-14 text-center">
                        <div className="flex flex-col items-center gap-2 text-[#9CA3AF]">
                          <Wallet className="h-10 w-10 opacity-50" />
                          <span>ไม่มีกระเป๋าเงิน</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
