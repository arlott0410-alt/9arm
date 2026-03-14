'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { formatMinorToDisplay } from '@/lib/utils';

type SalaryItem = {
  runId: number;
  yearMonth: string;
  status: string;
  bonusPoolMinor: number | null;
  createdAt: string;
  item: {
    baseSalaryMinor: number;
    totalDays: number;
    holidayDays: number;
    workingDays: number;
    salaryAfterHolidayMinor: number;
    bonusPortionMinor: number;
    allowances: { name: string; amountMinor: number }[];
    totalAllowancesMinor: number;
    deductions: { label: string; amountMinor: number }[];
    totalDeductionsMinor: number;
    lateMinutes: number;
    lateDeductionMinor: number;
    netAmountMinor: number;
    note: string | null;
  };
};

const PAYROLL_CURRENCY = 'LAK';

function formatPayroll(amount: number): string {
  return formatMinorToDisplay(amount, PAYROLL_CURRENCY);
}

export default function MySalaryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<SalaryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'ADMIN') {
      router.replace('/dashboard');
      return;
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch('/api/payroll/my-salary')
      .then((r) => r.json() as Promise<{ items: SalaryItem[] }>)
      .then((data) => setItems(data.items ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading || !user) return null;

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[#E5E7EB] flex items-center gap-2">
          <Receipt className="h-7 w-7" />
          เงินเดือนของฉัน
        </h1>
        <p className="text-sm text-[#9CA3AF]">
          รายการเงินเดือนที่ยืนยันแล้ว — แสดงเฉพาะของท่าน
        </p>

        <Card className="border-[#1F2937] bg-[#0F172A]">
          <CardHeader>
            <CardTitle className="text-[#E5E7EB]">รายเดือน</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-6 text-center text-[#9CA3AF]">กำลังโหลด...</p>
            ) : items.length === 0 ? (
              <p className="py-6 text-center text-[#9CA3AF]">ยังไม่มีรายการเงินเดือนที่ยืนยัน</p>
            ) : (
              <div className="space-y-4">
                {items.map((s) => (
                  <details
                    key={s.runId}
                    className="rounded-lg border border-[#1F2937] bg-[#111827]"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[#E5E7EB]">
                      <span className="font-medium">{s.yearMonth}</span>
                      <span className="text-[#D4AF37]">
                        ยอดสุทธิ {formatPayroll(s.item.netAmountMinor)} กีบ
                      </span>
                    </summary>
                    <div className="border-t border-[#1F2937] px-4 py-3 text-sm space-y-2">
                      <div className="flex justify-between text-[#9CA3AF]">
                        <span>เงินเดือนฐาน (หลังหักวันหยุด)</span>
                        <span>{formatPayroll(s.item.salaryAfterHolidayMinor)} กีบ</span>
                      </div>
                      <div className="flex justify-between text-[#9CA3AF]">
                        <span>โบนัส (จากก้อนรวม)</span>
                        <span>{formatPayroll(s.item.bonusPortionMinor)} กีบ</span>
                      </div>
                      {s.item.allowances.length > 0 && (
                        <div className="pt-2 border-t border-[#1F2937]">
                          <p className="text-[#9CA3AF] mb-1">รายการเพิ่ม</p>
                          <ul className="space-y-1">
                            {s.item.allowances.map((a, i) => (
                              <li key={i} className="flex justify-between text-[#E5E7EB]">
                                <span>{a.name}</span>
                                <span className="text-green-400">+{formatPayroll(a.amountMinor)} กีบ</span>
                              </li>
                            ))}
                          </ul>
                          <div className="flex justify-between text-[#9CA3AF] mt-2">
                            <span>รวมรายการเพิ่ม</span>
                            <span className="text-green-400">+{formatPayroll(s.item.totalAllowancesMinor ?? 0)} กีบ</span>
                          </div>
                        </div>
                      )}
                      {(s.item.lateDeductionMinor ?? 0) > 0 && (
                        <div className="flex justify-between text-[#9CA3AF]">
                          <span>หักมาสาย ({(s.item.lateMinutes ?? 0)} นาที)</span>
                          <span className="text-orange-400">−{formatPayroll(s.item.lateDeductionMinor ?? 0)} กีบ</span>
                        </div>
                      )}
                      {s.item.deductions.length > 0 && (
                        <div className="pt-2 border-t border-[#1F2937]">
                          <p className="text-[#9CA3AF] mb-1">รายการตัดเงินเดือน</p>
                          <ul className="space-y-1">
                            {s.item.deductions.map((d, i) => (
                              <li key={i} className="flex justify-between text-[#E5E7EB]">
                                <span>{d.label}</span>
                                <span className="text-red-400">-{formatPayroll(d.amountMinor)} กีบ</span>
                              </li>
                            ))}
                          </ul>
                          <div className="flex justify-between text-[#9CA3AF] mt-2">
                            <span>รวมตัด</span>
                            <span className="text-red-400">-{formatPayroll(s.item.totalDeductionsMinor)} กีบ</span>
                          </div>
                        </div>
                      )}
                      <div className="flex justify-between font-medium text-[#E5E7EB] pt-2">
                        <span>ยอดสุทธิที่ได้รับ</span>
                        <span className="text-[#D4AF37]">{formatPayroll(s.item.netAmountMinor)} กีบ</span>
                      </div>
                      <p className="text-xs text-[#6B7280]">
                        วันทำงาน {s.item.workingDays} วัน (หยุด {s.item.holidayDays} วัน)
                      </p>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
