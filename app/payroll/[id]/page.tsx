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
import { ArrowLeft, Banknote, User, PlusCircle, MinusCircle } from 'lucide-react';

type PayrollAllowance = { name: string; amountMinor: number };
type PayrollDeduction = { label: string; amountMinor: number };

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
  allowances: PayrollAllowance[];
  totalAllowancesMinor: number;
  deductions: PayrollDeduction[];
  totalDeductionsMinor: number;
  lateSeconds: number;
  lateDeductionMinor: number;
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

type AllowanceType = { id: string; name: string };

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
  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceType[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState<PayrollItem | null>(null);
  const [allowanceValues, setAllowanceValues] = useState<Record<string, number>>({});
  const [deductList, setDeductList] = useState<{ label: string; amountMinor: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reopening, setReopening] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json() as Promise<{ user?: { username: string; role: string } }>)
      .then((d) => {
        if (!d.user) {
          router.replace('/login');
          return;
        }
        if (d.user.role !== 'SUPER_ADMIN' && d.user.role !== 'AUDIT') {
          router.replace('/payroll');
          return;
        }
        setUser(d.user);
      });
  }, [router]);

  useEffect(() => {
    if (!user || !id) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/payroll/${id}`).then((r) => {
        if (r.status === 404) throw new Error('Not found');
        return r.json() as Promise<{ run: Run; items: PayrollItem[] }>;
      }),
      fetch('/api/settings/allowance-types').then((r) => r.json() as Promise<{ items: AllowanceType[] }>),
    ])
      .then(([payrollData, allowanceData]) => {
        setRun(payrollData.run);
        setItems(payrollData.items ?? []);
        setAllowanceTypes(allowanceData.items ?? []);
      })
      .catch(() => router.replace('/payroll'))
      .finally(() => setLoading(false));
  }, [user, id, router]);

  const openEdit = (item: PayrollItem) => {
    setEditOpen(item);
    const byName: Record<string, number> = {};
    (item.allowances ?? []).forEach((a) => {
      byName[a.name] = a.amountMinor;
    });
    allowanceTypes.forEach((t) => {
      if (byName[t.name] == null) byName[t.name] = 0;
    });
    setAllowanceValues(byName);
    setDeductList(
      (item.deductions ?? []).length > 0
        ? (item.deductions ?? []).map((d) => ({ label: d.label, amountMinor: d.amountMinor }))
        : [{ label: '', amountMinor: 0 }]
    );
  };

  const addDeductRow = () => {
    setDeductList((p) => [...p, { label: '', amountMinor: 0 }]);
  };

  const saveEdit = async () => {
    if (!editOpen || !id) return;
    const allowances: PayrollAllowance[] = allowanceTypes
      .filter((t) => (allowanceValues[t.name] ?? 0) > 0)
      .map((t) => ({ name: t.name, amountMinor: Math.round(allowanceValues[t.name] ?? 0) }));
    const deductions = deductList
      .filter((d) => d.label.trim() && d.amountMinor >= 0)
      .map((d) => ({ label: d.label.trim(), amountMinor: Math.round(d.amountMinor) }));
    setSaving(true);
    try {
      const res = await fetch(`/api/payroll/${id}/items/${editOpen.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowances: allowances.map((a) => ({ name: a.name, amountMinor: a.amountMinor })),
          deductions: deductions.map((d) => ({ label: d.label, amountMinor: d.amountMinor })),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        allowances?: PayrollAllowance[];
        totalAllowancesMinor?: number;
        deductions?: PayrollDeduction[];
        totalDeductionsMinor?: number;
        netAmountMinor?: number;
      };
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) =>
            i.userId === editOpen.userId
              ? {
                  ...i,
                  allowances: data.allowances ?? [],
                  totalAllowancesMinor: data.totalAllowancesMinor ?? 0,
                  deductions: data.deductions ?? [],
                  totalDeductionsMinor: data.totalDeductionsMinor ?? 0,
                  netAmountMinor: data.netAmountMinor ?? i.netAmountMinor,
                }
              : i
          )
        );
        setEditOpen(null);
      } else {
        alert(data.error ?? 'บันทึกไม่ได้');
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmRun = async () => {
    if (!run || run.status !== 'DRAFT') return;
    if (!confirm('ยืนยันรอบเงินเดือนนี้? หลังยืนยันจะแก้ไขไม่ได้ (สามารถเปิดแก้ไขภายหลังได้)')) return;
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

  const reopenForEdit = async () => {
    if (!run || run.status !== 'CONFIRMED') return;
    if (!confirm('เปิดแก้ไขรอบนี้? รอบจะกลับเป็นแบบร่าง แล้วสามารถกรอกรายการและยืนยันใหม่ได้')) return;
    setReopening(true);
    try {
      const res = await fetch(`/api/payroll/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DRAFT' }),
      });
      if (res.ok) {
        setRun((p) => (p ? { ...p, status: 'DRAFT' } : null));
      } else {
        const d = (await res.json()) as { error?: string };
        alert(d.error ?? 'เปิดแก้ไขไม่ได้');
      }
    } finally {
      setReopening(false);
    }
  };

  if (!user) return null;

  const totalNet = items.reduce((s, i) => s + i.netAmountMinor, 0);

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/payroll"
            className="inline-flex items-center gap-1 text-sm text-[#9CA3AF] hover:text-[#E5E7EB] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            กลับรายการรอบเงินเดือน
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-[#9CA3AF]">กำลังโหลด...</p>
          </div>
        ) : run ? (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-[#E5E7EB] flex items-center gap-2">
                  <Banknote className="h-7 w-7 text-[#D4AF37]" />
                  รอบเงินเดือน {run.yearMonth}
                </h1>
                <p className="mt-1 text-sm text-[#9CA3AF]">
                  {user.role === 'AUDIT'
                    ? 'ดูรายงานเงินเดือนของทุกคนในรอบนี้ (ดูได้อย่างเดียว)'
                    : 'หัวหน้าแอดมินลงวันหยุด · จัดการเงินเดือนทุกอย่างโดย SUPER_ADMIN'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={
                    run.status === 'CONFIRMED'
                      ? 'inline-flex items-center rounded-full bg-green-500/20 px-4 py-1.5 text-sm font-medium text-green-400'
                      : 'inline-flex items-center rounded-full bg-amber-500/20 px-4 py-1.5 text-sm font-medium text-amber-400'
                  }
                >
                  {run.status === 'CONFIRMED' ? 'ยืนยันแล้ว' : 'แบบร่าง'}
                </span>
                {user.role === 'SUPER_ADMIN' && run.status === 'CONFIRMED' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={reopenForEdit}
                    disabled={reopening}
                    className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                  >
                    {reopening ? 'กำลังเปิดแก้ไข...' : 'เปิดแก้ไข'}
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-[#1F2937] bg-[#0F172A]">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-[#1F2937] p-3">
                      <User className="h-6 w-6 text-[#9CA3AF]" />
                    </div>
                    <div>
                      <p className="text-sm text-[#9CA3AF]">จำนวนพนักงาน</p>
                      <p className="text-xl font-semibold text-[#E5E7EB]">{items.length} คน</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-[#1F2937] bg-[#0F172A]">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-[#D4AF37]/20 p-3">
                      <Banknote className="h-6 w-6 text-[#D4AF37]" />
                    </div>
                    <div>
                      <p className="text-sm text-[#9CA3AF]">ยอดรวมสุทธิ</p>
                      <p className="text-xl font-semibold text-[#D4AF37]">{formatMinor(totalNet)} ฿</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-[#1F2937] bg-[#0F172A]">
              <CardHeader>
                <CardTitle className="text-[#E5E7EB]">รายการพนักงาน</CardTitle>
                <p className="text-sm text-[#9CA3AF]">
                  เงินหลังหักวันหยุด + โบนัส + รายการเพิ่ม (ค่าไฟ/ค่าข้าว/ฯลฯ) − รายการหัก = ยอดสุทธิ
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border border-[#1F2937]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1F2937] bg-[#111827]">
                        <th className="px-4 py-3 text-left font-medium text-[#9CA3AF]">ชื่อ</th>
                        <th className="px-4 py-3 text-right font-medium text-[#9CA3AF]">วันทำงาน</th>
                        <th className="px-4 py-3 text-right font-medium text-[#9CA3AF]">เงินหลังหักวันหยุด</th>
                        <th className="px-4 py-3 text-right font-medium text-[#9CA3AF]">โบนัส</th>
                        <th className="px-4 py-3 text-right font-medium text-[#9CA3AF]">รายการเพิ่ม</th>
                        <th className="px-4 py-3 text-right font-medium text-[#9CA3AF]">มาสาย</th>
                        <th className="px-4 py-3 text-right font-medium text-[#9CA3AF]">รายการหัก</th>
                        <th className="px-4 py-3 text-right font-medium text-[#D4AF37]">ยอดสุทธิ</th>
                        {run.status === 'DRAFT' && (
                          <th className="px-4 py-3 text-left font-medium text-[#9CA3AF]">ดำเนินการ</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="border-b border-[#1F2937] hover:bg-[#111827]/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-[#E5E7EB]">{item.username}</td>
                          <td className="px-4 py-3 text-right text-[#9CA3AF]">{item.workingDays} วัน</td>
                          <td className="px-4 py-3 text-right text-[#E5E7EB]">{formatMinor(item.salaryAfterHolidayMinor)}</td>
                          <td className="px-4 py-3 text-right text-[#E5E7EB]">{formatMinor(item.bonusPortionMinor)}</td>
                          <td className="px-4 py-3 text-right">
                            {(item.totalAllowancesMinor ?? 0) > 0 ? (
                              <span className="text-green-400">+{formatMinor(item.totalAllowancesMinor ?? 0)}</span>
                            ) : (
                              <span className="text-[#6B7280]">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {(item.lateDeductionMinor ?? 0) > 0 ? (
                              <span className="text-orange-400" title={`${item.lateSeconds ?? 0} วินาที`}>
                                −{formatMinor(item.lateDeductionMinor ?? 0)}
                              </span>
                            ) : (
                              <span className="text-[#6B7280]">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {(item.totalDeductionsMinor ?? 0) > 0 ? (
                              <span className="text-red-400">−{formatMinor(item.totalDeductionsMinor ?? 0)}</span>
                            ) : (
                              <span className="text-[#6B7280]">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-[#D4AF37]">{formatMinor(item.netAmountMinor)}</td>
                          {run.status === 'DRAFT' && (
                            <td className="px-4 py-3">
                              <Button variant="outline" size="sm" onClick={() => openEdit(item)} className="border-[#374151] text-[#E5E7EB] hover:bg-[#1F2937]">
                                กรอกรายการ
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {run.status === 'DRAFT' && (
                  <div className="mt-6 flex justify-end">
                    <Button onClick={confirmRun} disabled={confirming} className="bg-[#D4AF37] text-[#0F172A] hover:bg-[#D4AF37]/90">
                      {confirming ? 'กำลังยืนยัน...' : 'ยืนยันรอบเงินเดือน'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <Dialog open={!!editOpen} onOpenChange={(o) => !o && setEditOpen(null)}>
        <DialogContent className="border-[#1F2937] bg-[#0F172A] text-[#E5E7EB] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              กรอกรายการเพิ่มและรายการหัก — {editOpen?.username}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            <div>
              <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-[#E5E7EB]">
                <PlusCircle className="h-4 w-4 text-green-400" />
                รายการเพิ่ม (ค่าไฟ, ค่าข้าว, โบนัส ฯลฯ)
              </h4>
              <div className="space-y-2 rounded-lg border border-[#1F2937] bg-[#111827] p-3">
                {allowanceTypes.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">ไม่มีรายการจากตั้งค่า — ไปที่ ตั้งค่า → รายการค่าตอบแทนเพิ่ม</p>
                ) : (
                  allowanceTypes.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-4">
                      <Label className="min-w-[100px] text-[#9CA3AF]">{t.name}</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="0"
                        className="w-32 bg-[#1F2937] border-[#374151] text-right"
                        value={allowanceValues[t.name] ? (allowanceValues[t.name] / 100).toFixed(2) : ''}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          const minor = isNaN(v) ? 0 : Math.round(v * 100);
                          setAllowanceValues((p) => ({ ...p, [t.name]: minor }));
                        }}
                      />
                      <span className="text-xs text-[#6B7280]">บาท</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-[#E5E7EB]">
                <MinusCircle className="h-4 w-4 text-red-400" />
                รายการหักเงินเดือน (ตัดค่าอะไร จำนวนเท่าไหร่)
              </h4>
              <div className="space-y-2">
                {deductList.map((d, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      placeholder="เช่น หักค่าอะไร"
                      value={d.label}
                      onChange={(e) =>
                        setDeductList((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
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
                        setDeductList((p) => p.map((x, j) => (j === i ? { ...x, amountMinor: minor } : x)));
                      }}
                      className="w-28 bg-[#1F2937] border-[#374151] text-right"
                    />
                    <span className="text-xs text-[#6B7280] w-8">บาท</span>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addDeductRow} className="border-[#374151] text-[#9CA3AF]">
                  + เพิ่มรายการหัก
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-[#1F2937]">
            <Button variant="outline" onClick={() => setEditOpen(null)} className="border-[#374151]">
              ยกเลิก
            </Button>
            <Button onClick={saveEdit} disabled={saving} className="bg-[#D4AF37] text-[#0F172A] hover:bg-[#D4AF37]/90">
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
