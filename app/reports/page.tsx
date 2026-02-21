'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatMinorToDisplay } from '@/lib/utils';

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(
    null
  );
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'yearly' | 'custom'>('daily');
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState(currentMonth);
  const [dateFrom, setDateFrom] = useState(now.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(now.toISOString().slice(0, 10));
  const [data, setData] = useState<{
    period: string;
    dateFrom: string;
    dateTo: string;
    transactions: {
      deposits: number;
      withdraws: number;
      net: number;
    };
    transfers: {
      internalTotal: number;
      externalInTotal: number;
      externalOutTotal: number;
      netExternal: number;
    };
    displayCurrency?: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json() as Promise<{ user?: { username: string; role: string } }>)
      .then((d) => {
        if (!d.user) router.replace('/login');
        else setUser(d.user);
      });
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams({
      period,
      ...(period === 'monthly' && { year, month }),
      ...(period === 'yearly' && { year }),
      ...(period === 'daily' && { dateFrom }),
      ...(period === 'custom' && { dateFrom, dateTo }),
    });
    fetch(`/api/reports?${params}`)
      .then((r) => r.json() as Promise<NonNullable<typeof data>>)
      .then(setData);
  }, [user, period, year, month, dateFrom, dateTo]);

  if (!user) return null;

  const dispCur = data?.displayCurrency || 'THB';

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[#E5E7EB]">รายงาน</h1>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-sm text-[#9CA3AF]">ช่วงเวลา</label>
            <Select
              value={period}
              onValueChange={(v: 'daily' | 'monthly' | 'yearly' | 'custom') =>
                setPeriod(v)
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">รายวัน</SelectItem>
                <SelectItem value="monthly">รายเดือน</SelectItem>
                <SelectItem value="yearly">รายปี</SelectItem>
                <SelectItem value="custom">กำหนดช่วงวันที่</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {period === 'daily' && (
            <div>
              <label className="mb-1 block text-sm text-[#9CA3AF]">วันที่</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-10 w-40 rounded-md border border-[#1F2937] bg-[#0B0F1A] px-3 text-[#E5E7EB] focus:border-[#D4AF37] focus:outline-none"
              />
            </div>
          )}
          {period === 'monthly' && (
            <>
              <div>
                <label className="mb-1 block text-sm text-[#9CA3AF]">ปี</label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[currentYear, currentYear - 1, currentYear - 2].map(
                      (y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-[#9CA3AF]">เดือน</label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => {
                      const m = String(i + 1).padStart(2, '0');
                      return (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {period === 'custom' && (
            <>
              <div>
                <label className="mb-1 block text-sm text-[#9CA3AF]">ตั้งแต่</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  max={dateTo}
                  className="h-10 w-40 rounded-md border border-[#1F2937] bg-[#0B0F1A] px-3 text-[#E5E7EB] focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[#9CA3AF]">ถึง</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom}
                  className="h-10 w-40 rounded-md border border-[#1F2937] bg-[#0B0F1A] px-3 text-[#E5E7EB] focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
            </>
          )}
          {period === 'yearly' && (
            <div>
              <label className="mb-1 block text-sm text-[#9CA3AF]">ปี</label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {data && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-[#1F2937] bg-[#0F172A]">
              <CardHeader>
                <CardTitle className="text-[#E5E7EB]">
                  ธุรกรรม ({data.dateFrom} ถึง {data.dateTo})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">ฝาก</span>
                  <span className="font-medium text-[#D4AF37]">
                    {formatMinorToDisplay(data.transactions.deposits, dispCur)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">ถอน</span>
                  <span className="font-medium text-[#D4AF37]">
                    {formatMinorToDisplay(data.transactions.withdraws, dispCur)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-[#1F2937] pt-4">
                  <span className="text-[#9CA3AF]">สุทธิ</span>
                  <span
                    className={`font-medium ${
                      data.transactions.net >= 0
                        ? 'text-[#D4AF37]'
                        : 'text-red-400'
                    }`}
                  >
                    {formatMinorToDisplay(
                      Math.abs(data.transactions.net),
                      dispCur
                    )}
                    {data.transactions.net < 0 ? ' (ถอนออก)' : ''}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#1F2937] bg-[#0F172A]">
              <CardHeader>
                <CardTitle className="text-[#E5E7EB]">
                  โอนเงิน ({data.dateFrom} ถึง {data.dateTo})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">รวมภายใน</span>
                  <span className="font-medium text-[#D4AF37]">
                    {formatMinorToDisplay(
                      data.transfers.internalTotal,
                      dispCur
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">รวมรับจากภายนอก</span>
                  <span className="font-medium text-[#D4AF37]">
                    {formatMinorToDisplay(
                      data.transfers.externalInTotal,
                      dispCur
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">รวมโอนออกภายนอก</span>
                  <span className="font-medium text-[#D4AF37]">
                    {formatMinorToDisplay(
                      data.transfers.externalOutTotal,
                      dispCur
                    )}
                  </span>
                </div>
                <div className="flex justify-between border-t border-[#1F2937] pt-4">
                  <span className="text-[#9CA3AF]">สุทธิภายนอก</span>
                  <span
                    className={`font-medium ${
                      data.transfers.netExternal >= 0
                        ? 'text-[#D4AF37]'
                        : 'text-red-400'
                    }`}
                  >
                    {formatMinorToDisplay(
                      Math.abs(data.transfers.netExternal),
                      dispCur
                    )}
                    {data.transfers.netExternal < 0 ? ' (ถอนออก)' : ''}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
