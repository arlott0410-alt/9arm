'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';

type PayrollItem = {
  id: number;
  userId: number;
  username: string;
  baseSalaryMinor: number;
  totalDays: number;
  holidayDays: number;
  workingDays: number;
  salaryAfterHolidayMinor: number;
  bonusPortionMinor: number;
  deductions: { label: string; amountMinor: number }[];
  totalDeductionsMinor: number;
  netAmountMinor: number;
  note: string | null;
};

type Run = {
  id: number;
  yearMonth: string;
  status: string;
  bonusPoolMinor: number | null;
  createdAt: string;
  createdBy: number;
};

function formatMinor(amount: number): string {
  return (amount / 100).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function PayrollDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deductOpen, setDeductOpen] = useState<{ userId: number; username: string } | null>(null);
  const [deductList, setDeductList] = useState<{ label: string; amountMinor: number }[]>([]);
  const [savingDeduct, setSavingDeduct] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json() as Promise<{ user?: { username: string; role: string } }>)
      .then((d) => {
        if (!d.user) {
          router.replace('/login');
          return;
        }
        if (d.user.role !== 'SUPER_ADMIN') {
          router.replace('/payroll');
          return;
        }
        setUser(d.user);
      });
  }, [router]);

  useEffect(() => {
    if (!user || !id) return;
    setLoading(true);
    fetch(`/api/payroll/${id}`)
      .then((r) => {
        if (r.status === 404) throw new Error('Not found');
        return r.json() as Promise<{ run: Run; items: PayrollItem[] }>;
      })
      .then((data) => {
        setRun(data.run);
        setItems(data.items ?? []);
      })
      .catch(() => router.replace('/payroll'))
      .finally(() => setLoading(false));
  }, [user, id, router]);

  const openDeduct = (item: PayrollItem) => {
    setDeductOpen({ userId: item.userId, username: item.username });
    setDeductList(
      item.deductions.length > 0
        ? item.deductions.map((d) => ({ label: d.label, amountMinor: d.amountMinor }))
        : [{ label: '', amountMinor: 0 }]
    );
  };

  const addDeductRow = () => {
    setDeductList((p) => [...p, { label: '', amountMinor: 0 }]);
  };

  const saveDeductions = async () => {
    if (!deductOpen || !id) return;
    const list = deductList
      .filter((d) => d.label.trim() && d.amountMinor >= 0)
      .map((d) => ({ label: d.label.trim(), amountMinor: Math.round(d.amountMinor) }));
    setSavingDeduct(true);
    try {
      const res = await fetch(`/api/payroll/${id}/items/${deductOpen.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deductions: list }),
      });
      const data = (await res.json()) as { error?: string; totalDeductionsMinor?: number; netAmountMinor?: number };
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) =>
            i.userId === deductOpen.userId
              ? {
                  ...i,
                  deductions: list,
                  totalDeductionsMinor: data.totalDeductionsMinor ?? 0,
                  netAmountMinor: data.netAmountMinor ?? i.netAmountMinor,
                }
              : i
          )
        );
        setDeductOpen(null);
      } else {
        alert(data.error ?? 'บันทึกไม่ได้');
      }
    } finally {
      setSavingDeduct(false);
    }
  };

  const confirmRun = async () => {
    if (!run || run.status !== 'DRAFT') return;
    if (!confirm('ยืนยันรอบเงินเดือนนี้? หลังยืนยันจะแก้ไขไม่ได้')) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/payroll/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CONFIRMED' }),
      });
      if (res.ok) {
        setRun((p) => (p ? { ...p, status: 'CONFIRMED' } : null));
      } else {
        const d = (await res.json()) as { error?: string };
        alert(d.error ?? 'ยืนยันไม่ได้');
      }
    } finally {
      setConfirming(false);
    }
  };

  if (!user) return null;

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/payroll"
            className="text-[#9CA3AF] hover:text-[#E5E7EB] flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            กลับ
          </Link>
        </div>

        {loading ? (
          <p className="py-6 text-center text-[#9CA3AF]">กำลังโหลด...</p>
        ) : run ? (
          <>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-[#E5E7EB]">
                รอบเงินเดือน {run.yearMonth}
              </h1>
              <span
                className={
                  run.status === 'CONFIRMED'
                    ? 'rounded bg-green-500/20 px-3 py-1 text-sm text-green-400'
                    : 'rounded bg-[#D4AF37]/20 px-3 py-1 text-sm text-[#D4AF37]'
                }
              >
                {run.status === 'CONFIRMED' ? 'ยืนยันแล้ว' : 'แบบร่าง'}
              </span>
            </div>

            <Card className="border-[#1F2937] bg-[#0F172A]">
              <CardHeader>
                <CardTitle className="text-[#E5E7EB]">รายการพนักงาน</CardTitle>
                <p className="text-sm text-[#9CA3AF]">
                  เงินเดือนฐาน → หลังหักวันหยุด → + โบนัส → − รายการตัด = ยอดสุทธิ
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1F2937]">
                        <th className="py-2 text-left text-[#9CA3AF]">ชื่อ</th>
                        <th className="py-2 text-right text-[#9CA3AF]">วันทำงาน</th>
                        <th className="py-2 text-right text-[#9CA3AF]">หลังหักวันหยุด</th>
                        <th className="py-2 text-right text-[#9CA3AF]">โบนัส</th>
                        <th className="py-2 text-right text-[#9CA3AF]">รายการตัด</th>
                        <th className="py-2 text-right text-[#9CA3AF]">ยอดสุทธิ</th>
                        {run.status === 'DRAFT' && (
                          <th className="py-2 text-left text-[#9CA3AF]">ดำเนินการ</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="border-b border-[#1F2937]">
                          <td className="py-2 text-[#E5E7EB] font-medium">{item.username}</td>
                          <td className="py-2 text-right text-[#9CA3AF]">
                            {item.workingDays} วัน
                          </td>
                          <td className="py-2 text-right text-[#E5E7EB]">
                            {formatMinor(item.salaryAfterHolidayMinor)}
                          </td>
                          <td className="py-2 text-right text-[#E5E7EB]">
                            {formatMinor(item.bonusPortionMinor)}
                          </td>
                          <td className="py-2 text-right">
                            {item.deductions.length === 0 ? (
                              <span className="text-[#6B7280]">-</span>
                            ) : (
                              <span className="text-red-400">
                                -{formatMinor(item.totalDeductionsMinor)} ({item.deductions.length} รายการ)
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-right text-[#D4AF37] font-medium">
                            {formatMinor(item.netAmountMinor)}
                          </td>
                          {run.status === 'DRAFT' && (
                            <td className="py-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDeduct(item)}
                              >
                                ตั้งค่าตัด
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {run.status === 'DRAFT' && (
                  <div className="mt-4 flex justify-end">
                    <Button onClick={confirmRun} disabled={confirming}>
                      {confirming ? 'กำลังยืนยัน...' : 'ยืนยันรอบเงินเดือน'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <Dialog open={!!deductOpen} onOpenChange={(o) => !o && setDeductOpen(null)}>
        <DialogContent className="border-[#1F2937] bg-[#0F172A] text-[#E5E7EB] max-w-md">
          <DialogHeader>
            <DialogTitle>
              รายการตัดเงินเดือน — {deductOpen?.username}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#9CA3AF]">
            ระบุว่าตัดค่าอะไร และจำนวนเงิน (บาท)
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {deductList.map((d, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  placeholder="เช่น หักค่าอะไร"
                  value={d.label}
                  onChange={(e) =>
                    setDeductList((p) =>
                      p.map((x, j) =>
                        j === i ? { ...x, label: e.target.value } : x
                      )
                    )
                  }
                  className="flex-1 bg-[#1F2937] border-[#374151]"
                />
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0"
                  value={d.amountMinor ? d.amountMinor / 100 : ''}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    const minor = isNaN(v) ? 0 : Math.round(v * 100);
                    setDeductList((p) =>
                      p.map((x, j) => (j === i ? { ...x, amountMinor: minor } : x))
                    );
                  }}
                  className="w-28 bg-[#1F2937] border-[#374151]"
                />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addDeductRow}>
              + เพิ่มรายการตัด
            </Button>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeductOpen(null)}>
              ยกเลิก
            </Button>
            <Button onClick={saveDeductions} disabled={savingDeduct}>
              {savingDeduct ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
