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
import { formatMinorToDisplay, formatDateThailand } from '@/lib/utils';

const now = new Date(Date.now() + 7 * 60 * 60 * 1000); // Thailand UTC+7
const currentYear = now.getUTCFullYear();
const currentMonth = String(now.getUTCMonth() + 1).padStart(2, '0');

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(
    null
  );
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'yearly' | 'custom'>('daily');
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState(currentMonth);
  const [dateFrom, setDateFrom] = useState(() => {
    const t = new Date(Date.now() + 7 * 60 * 60 * 1000);
    return t.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => {
    const t = new Date(Date.now() + 7 * 60 * 60 * 1000);
    return t.toISOString().slice(0, 10);
  });
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
      internalByCurrency: Record<string, number>;
      externalInByCurrency: Record<string, number>;
      externalOutByCurrency: Record<string, number>;
    };
    withdrawFeesByCurrency?: Record<string, number>;
    displayCurrency?: string;
  } | null>(null);
  const [bonusData, setBonusData] = useState<{
    displayCurrency: string;
    dateFrom: string;
    dateTo: string;
    byCategory: Record<string, number>;
    total: number;
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
    Promise.all([
      fetch(`/api/reports?${params}`).then((r) => r.json() as Promise<NonNullable<typeof data>>),
      fetch(`/api/reports/bonuses?${params}`).then((r) => r.json()).then((b) => (b?.displayCurrency ? b : null)) as Promise<NonNullable<typeof bonusData> | null>,
    ]).then(([d, b]) => {
      setData(d);
      setBonusData(b ?? null);
    });
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
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="border-[#1F2937] bg-[#0F172A]">
              <CardHeader>
                <CardTitle className="text-[#E5E7EB]">
                  ธุรกรรม ({formatDateThailand(data.dateFrom)} ถึง {formatDateThailand(data.dateTo)})
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
                  โอนเงิน ({formatDateThailand(data.dateFrom)} ถึง {formatDateThailand(data.dateTo)})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-[#9CA3AF]">รวมภายใน (แยกตามสกุลเงิน)</span>
                  <ul className="mt-1 space-y-1">
                    {Object.entries(data.transfers.internalByCurrency ?? {})
                      .filter(([, v]) => v !== 0)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([cur, amt]) => (
                        <li key={cur} className="flex justify-between text-sm">
                          <span className="text-[#9CA3AF]">{cur}</span>
                          <span className="font-medium text-[#D4AF37]">
                            {formatMinorToDisplay(amt, cur)}
                          </span>
                        </li>
                      ))}
                    {Object.keys(data.transfers.internalByCurrency ?? {}).length === 0 && (
                      <li className="text-sm text-[#6B7280]">-</li>
                    )}
                  </ul>
                </div>
                <div>
                  <span className="text-[#9CA3AF]">รวมรับจากภายนอก (แยกตามสกุลเงิน)</span>
                  <ul className="mt-1 space-y-1">
                    {Object.entries(data.transfers.externalInByCurrency ?? {})
                      .filter(([, v]) => v !== 0)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([cur, amt]) => (
                        <li key={cur} className="flex justify-between text-sm">
                          <span className="text-[#9CA3AF]">{cur}</span>
                          <span className="font-medium text-[#D4AF37]">
                            {formatMinorToDisplay(amt, cur)}
                          </span>
                        </li>
                      ))}
                    {Object.keys(data.transfers.externalInByCurrency ?? {}).length === 0 && (
                      <li className="text-sm text-[#6B7280]">-</li>
                    )}
                  </ul>
                </div>
                <div>
                  <span className="text-[#9CA3AF]">รวมโอนออกภายนอก (แยกตามสกุลเงิน)</span>
                  <ul className="mt-1 space-y-1">
                    {Object.entries(data.transfers.externalOutByCurrency ?? {})
                      .filter(([, v]) => v !== 0)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([cur, amt]) => (
                        <li key={cur} className="flex justify-between text-sm">
                          <span className="text-[#9CA3AF]">{cur}</span>
                          <span className="font-medium text-[#D4AF37]">
                            {formatMinorToDisplay(amt, cur)}
                          </span>
                        </li>
                      ))}
                    {Object.keys(data.transfers.externalOutByCurrency ?? {}).length === 0 && (
                      <li className="text-sm text-[#6B7280]">-</li>
                    )}
                  </ul>
                </div>
                <div className="border-t border-[#1F2937] pt-4">
                  <span className="text-[#9CA3AF]">สุทธิภายนอก (แยกตามสกุลเงิน)</span>
                  <ul className="mt-1 space-y-1">
                    {(() => {
                      const allCur = Array.from(
                        new Set([
                          ...Object.keys(data.transfers.externalInByCurrency ?? {}),
                          ...Object.keys(data.transfers.externalOutByCurrency ?? {}),
                        ])
                      ).sort();
                      const items = allCur.map((cur) => {
                        const inAmt = data.transfers.externalInByCurrency?.[cur] ?? 0;
                        const outAmt = data.transfers.externalOutByCurrency?.[cur] ?? 0;
                        return { cur, net: inAmt - outAmt };
                      }).filter((x) => x.net !== 0);
                      if (items.length === 0) return <li className="text-sm text-[#6B7280]">-</li>;
                      return items.map(({ cur, net }) => (
                        <li key={cur} className="flex justify-between text-sm">
                          <span className="text-[#9CA3AF]">{cur}</span>
                          <span
                            className={`font-medium ${
                              net >= 0 ? 'text-[#D4AF37]' : 'text-red-400'
                            }`}
                          >
                            {formatMinorToDisplay(Math.abs(net), cur)}
                            {net < 0 ? ' (ถอนออก)' : ' (รับเข้า)'}
                          </span>
                        </li>
                      ));
                    })()}
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#1F2937] bg-[#0F172A]">
              <CardHeader>
                <CardTitle className="text-[#E5E7EB]">
                  ค่าธรรมเนียมถอน ({formatDateThailand(data.dateFrom)} ถึง {formatDateThailand(data.dateTo)})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <span className="text-[#9CA3AF]">แยกตามสกุลเงิน</span>
                  <ul className="mt-1 space-y-1">
                    {Object.entries(data.withdrawFeesByCurrency ?? {})
                      .filter(([, v]) => v > 0)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([cur, amt]) => (
                        <li key={cur} className="flex justify-between text-sm">
                          <span className="text-[#9CA3AF]">{cur}</span>
                          <span className="font-medium text-[#D4AF37]">
                            {formatMinorToDisplay(amt, cur)}
                          </span>
                        </li>
                      ))}
                    {(!data.withdrawFeesByCurrency || Object.keys(data.withdrawFeesByCurrency).length === 0 ||
                      Object.values(data.withdrawFeesByCurrency).every((v) => v === 0)) && (
                      <li className="text-sm text-[#6B7280]">-</li>
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {bonusData && (
              <Card className="border-[#1F2937] bg-[#0F172A]">
                <CardHeader>
                  <CardTitle className="text-[#E5E7EB]">
                    รายงานโบนัส ({formatDateThailand(bonusData.dateFrom)} ถึง {formatDateThailand(bonusData.dateTo)})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-[#9CA3AF]">แยกตามหมวดหมู่</span>
                    <ul className="mt-1 space-y-1">
                      {Object.entries(bonusData.byCategory ?? {})
                        .filter(([, v]) => v > 0)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([name, amt]) => (
                          <li key={name} className="flex justify-between text-sm">
                            <span className="text-[#9CA3AF]">{name}</span>
                            <span className="font-medium text-[#D4AF37]">
                              {formatMinorToDisplay(amt, bonusData.displayCurrency)}
                            </span>
                          </li>
                        ))}
                      {(!bonusData.byCategory || Object.keys(bonusData.byCategory).length === 0 ||
                        Object.values(bonusData.byCategory).every((v) => v === 0)) && (
                        <li className="text-sm text-[#6B7280]">-</li>
                      )}
                    </ul>
                  </div>
                  <div className="flex justify-between border-t border-[#1F2937] pt-4">
                    <span className="text-[#9CA3AF]">รวมโบนัส</span>
                    <span className="font-medium text-[#D4AF37]">
                      {formatMinorToDisplay(bonusData.total, bonusData.displayCurrency)} {bonusData.displayCurrency}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
