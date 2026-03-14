'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Banknote,
  User,
  PlusCircle,
  MinusCircle,
  Trash2,
  FileText,
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  UserPlus,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { formatMinorToDisplay, parseDisplayToMinor } from '@/lib/utils';
import { deletePayroll, finalizePayroll } from '@/lib/actions/payroll';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type PayrollAllowance = { name: string; amountMinor: number };
type PayrollDeduction = { label: string; amountMinor: number };
type AllowanceType = { id: string; name: string };
type DeductionType = { id: string; name: string };

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
  excludeFromBonus?: boolean;
  allowances: PayrollAllowance[];
  totalAllowancesMinor: number;
  deductions: PayrollDeduction[];
  totalDeductionsMinor: number;
  lateMinutes: number;
  lateDeductionMinor: number;
  netAmountMinor: number;
  note: string | null;
  overrideBaseSalaryMinor?: number | null;
};

type Run = {
  id: number;
  yearMonth: string;
  status: string;
  bonusPoolMinor: number | null;
  createdAt: string;
  createdBy: number;
};

const PAYROLL_CURRENCY = 'LAK';

function formatPayroll(amount: number): string {
  return formatMinorToDisplay(amount, PAYROLL_CURRENCY);
}

export default function PayrollDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { user, loading: authLoading } = useAuth();
  const [run, setRun] = useState<Run | null>(null);
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState<PayrollItem | null>(null);
  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceType[]>([]);
  const [deductionTypes, setDeductionTypes] = useState<DeductionType[]>([]);
  const [allowanceAmounts, setAllowanceAmounts] = useState<Record<string, number>>({});
  const [deductionAmounts, setDeductionAmounts] = useState<Record<string, number>>({});
  const [overrideBaseSalary, setOverrideBaseSalary] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [togglingBonus, setTogglingBonus] = useState<number | null>(null);
  const [bulkExcludeOpen, setBulkExcludeOpen] = useState(false);
  const [bulkExcludeSaving, setBulkExcludeSaving] = useState(false);
  const [bulkExcludeSelected, setBulkExcludeSelected] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState<'name' | 'net'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [deleting, setDeleting] = useState(false);
  const [addingMissing, setAddingMissing] = useState(false);
  const [pullingSalaries, setPullingSalaries] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'AUDIT') {
      router.replace('/payroll');
      return;
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user || !id) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/payroll/${id}`).then((r) => {
        if (r.status === 404) throw new Error('Not found');
        return r.json() as Promise<{ run: Run; items: PayrollItem[] }>;
      }),
      fetch('/api/settings/allowance-types').then((r) => r.json() as Promise<{ items: AllowanceType[] }>),
      fetch('/api/settings/deduction-types').then((r) => r.json() as Promise<{ items: DeductionType[] }>),
    ])
      .then(([payroll, a, d]) => {
        setRun(payroll.run);
        setItems(payroll.items ?? []);
        setAllowanceTypes(Array.isArray(a?.items) ? a.items : []);
        setDeductionTypes(Array.isArray(d?.items) ? d.items : []);
      })
      .catch(() => router.replace('/payroll'))
      .finally(() => setLoading(false));
  }, [user, id, router]);

  const openEdit = (item: PayrollItem) => {
    setEditOpen(item);
    const allowMap: Record<string, number> = {};
    for (const a of item.allowances ?? []) {
      if (a.name?.trim()) allowMap[a.name.trim()] = a.amountMinor ?? 0;
    }
    setAllowanceAmounts(allowMap);
    const deductMap: Record<string, number> = {};
    for (const d of item.deductions ?? []) {
      if (d.label?.trim()) deductMap[d.label.trim()] = d.amountMinor ?? 0;
    }
    setDeductionAmounts(deductMap);
    const effectiveBase = item.overrideBaseSalaryMinor ?? item.baseSalaryMinor;
    setOverrideBaseSalary(effectiveBase ? formatPayroll(effectiveBase) : '');
  };

  const saveEdit = async () => {
    if (!editOpen || !id) return;
    const allowances: PayrollAllowance[] = allowanceTypes
      .filter((t) => (allowanceAmounts[t.name] ?? 0) > 0)
      .map((t) => ({ name: t.name, amountMinor: Math.round(allowanceAmounts[t.name] ?? 0) }));
    const deductions: PayrollDeduction[] = deductionTypes
      .filter((t) => (deductionAmounts[t.name] ?? 0) > 0)
      .map((t) => ({ label: t.name, amountMinor: Math.round(deductionAmounts[t.name] ?? 0) }));
    const overrideVal = overrideBaseSalary.trim() ? parseDisplayToMinor(overrideBaseSalary, PAYROLL_CURRENCY) : null;
    const shouldOverride = overrideVal !== null && overrideVal !== editOpen.baseSalaryMinor;
    const shouldClearOverride = overrideVal === null || overrideVal === editOpen.baseSalaryMinor;
    const overridePayload =
      shouldOverride
        ? { overrideBaseSalaryMinor: overrideVal }
        : shouldClearOverride && editOpen.overrideBaseSalaryMinor != null
          ? { overrideBaseSalaryMinor: null }
          : {};
    setSaving(true);
    try {
      const res = await fetch(`/api/payroll/${id}/items/${editOpen.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowances: allowances.map((a) => ({ name: a.name, amountMinor: a.amountMinor })),
          deductions: deductions.map((d) => ({ label: d.label, amountMinor: d.amountMinor })),
          ...overridePayload,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        allowances?: PayrollAllowance[];
        totalAllowancesMinor?: number;
        deductions?: PayrollDeduction[];
        totalDeductionsMinor?: number;
        netAmountMinor?: number;
        overrideBaseSalaryMinor?: number | null;
        salaryAfterHolidayMinor?: number;
      };
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) =>
            i.userId === editOpen.userId
              ? {
                  ...i,
                  allowances: data.allowances ?? i.allowances,
                  totalAllowancesMinor: data.totalAllowancesMinor ?? i.totalAllowancesMinor,
                  deductions: data.deductions ?? i.deductions,
                  totalDeductionsMinor: data.totalDeductionsMinor ?? i.totalDeductionsMinor,
                  netAmountMinor: data.netAmountMinor ?? i.netAmountMinor,
                  overrideBaseSalaryMinor: data.overrideBaseSalaryMinor !== undefined ? data.overrideBaseSalaryMinor : i.overrideBaseSalaryMinor,
                  salaryAfterHolidayMinor: data.salaryAfterHolidayMinor ?? i.salaryAfterHolidayMinor,
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
    if (!run || run.status !== 'DRAFT' || !id) return;
    if (!confirm('ยืนยันรอบเงินเดือนนี้? หลังยืนยันจะแก้ไขไม่ได้ (สามารถเปิดแก้ไขภายหลังได้)')) return;
    setConfirming(true);
    try {
      const result = await finalizePayroll(parseInt(id, 10));
      if (result.ok) {
        setRun((p) => (p ? { ...p, status: 'CONFIRMED' } : null));
      } else {
        alert(result.error);
      }
    } finally {
      setConfirming(false);
    }
  };

  const toggleExcludeFromBonus = async (item: PayrollItem) => {
    if (!run || run.status !== 'DRAFT' || user?.role !== 'SUPER_ADMIN') return;
    setTogglingBonus(item.userId);
    try {
      const res = await fetch(`/api/payroll/${id}/items/${item.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excludeFromBonus: !item.excludeFromBonus }),
      });
      const data = (await res.json()) as { error?: string; recalculated?: boolean };
      if (res.ok) {
        const res2 = await fetch(`/api/payroll/${id}`);
        const d = (await res2.json()) as { items?: PayrollItem[] };
        if (d.items) setItems(d.items);
      } else {
        alert(data.error ?? 'เปลี่ยนไม่ได้');
      }
    } finally {
      setTogglingBonus(null);
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

  const sortedItems = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      if (sortBy === 'name') {
        const cmp = a.username.localeCompare(b.username);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const cmp = a.netAmountMinor - b.netAmountMinor;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [items, sortBy, sortDir]);

  const toggleSort = (col: 'name' | 'net') => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const handleBulkExclude = async (excludeUserIds: number[]) => {
    if (!id) return;
    setBulkExcludeSaving(true);
    try {
      const res = await fetch(`/api/payroll/${id}/bulk-exclude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excludeUserIds }),
      });
      if (res.ok) {
        const res2 = await fetch(`/api/payroll/${id}`);
        const d2 = (await res2.json()) as { items?: PayrollItem[] };
        if (d2.items) setItems(d2.items);
        setBulkExcludeOpen(false);
      } else {
        const err = (await res.json()) as { error?: string };
        alert(err.error ?? 'บันทึกไม่สำเร็จ');
      }
    } finally {
      setBulkExcludeSaving(false);
    }
  };

  const openBulkExclude = () => {
    setBulkExcludeSelected(new Set(items.filter((i) => i.excludeFromBonus).map((i) => i.userId)));
    setBulkExcludeOpen(true);
  };

  const handleDeleteDraft = async () => {
    if (!run || run.status !== 'DRAFT' || !id) return;
    if (!confirm('ลบรอบเงินเดือนแบบร่างนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้')) return;
    setDeleting(true);
    try {
      const result = await deletePayroll(parseInt(id, 10));
      if (result.ok) {
        window.location.href = '/payroll';
      } else {
        alert(result.error);
      }
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading || !user) return null;

  const totalNet = items.reduce((s, i) => s + i.netAmountMinor, 0);

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/payroll"
            prefetch={false}
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
                  {run.status === 'CONFIRMED' ? 'Finalized' : 'Draft'}
                </span>
                {(user.role === 'SUPER_ADMIN' || user.role === 'AUDIT') && run.status === 'CONFIRMED' && (
                  <Link href="/reports" prefetch={false}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#374151] text-[#E5E7EB] hover:bg-[#1F2937]"
                    >
                      <FileText className="h-4 w-4 mr-1.5" />
                      Generate Report
                    </Button>
                  </Link>
                )}
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
                {user.role === 'SUPER_ADMIN' && run.status === 'DRAFT' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteDraft}
                    disabled={deleting}
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    {deleting ? 'กำลังลบ...' : 'Delete Draft'}
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
                      <p className="text-xl font-semibold text-[#D4AF37]">{formatPayroll(totalNet)} กีบ</p>
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
                {run.status === 'DRAFT' && user.role === 'SUPER_ADMIN' && (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pullingSalaries}
                      onClick={async () => {
                        setPullingSalaries(true);
                        try {
                          const res = await fetch(`/api/payroll/${id}/pull-base-salaries`, {
                            method: 'POST',
                          });
                          const data = (await res.json()) as { updated?: number; error?: string };
                          if (res.ok && (data.updated ?? 0) > 0) {
                            const payrollRes = await fetch(`/api/payroll/${id}`);
                            const payrollData = (await payrollRes.json()) as { run: Run; items: PayrollItem[] };
                            setRun(payrollData.run);
                            setItems(payrollData.items ?? []);
                          } else if (data.error) {
                            alert(data.error);
                          }
                        } finally {
                          setPullingSalaries(false);
                        }
                      }}
                      className="border-[#374151] text-[#E5E7EB] hover:bg-[#1F2937]"
                      title="ดึงฐานเงินเดือนล่าสุดจากหน้าจัดการพนักงาน"
                    >
                      <RefreshCw className="h-4 w-4 mr-1.5" />
                      {pullingSalaries ? 'กำลังดึง...' : 'ดึงฐานเงินเดือนล่าสุด'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={addingMissing}
                      onClick={async () => {
                        setAddingMissing(true);
                        try {
                          const res = await fetch(`/api/payroll/${id}/add-missing-employees`, {
                            method: 'POST',
                          });
                          const data = (await res.json()) as { added?: number; error?: string; message?: string };
                          if (res.ok && (data.added ?? 0) > 0) {
                            const payrollRes = await fetch(`/api/payroll/${id}`);
                            const payrollData = (await payrollRes.json()) as { run: Run; items: PayrollItem[] };
                            setRun(payrollData.run);
                            setItems(payrollData.items ?? []);
                          } else if (res.ok && data.message) {
                            alert(data.message);
                          } else if (data.error) {
                            alert(data.error);
                          }
                        } finally {
                          setAddingMissing(false);
                        }
                      }}
                      className="border-[#374151] text-[#E5E7EB] hover:bg-[#1F2937]"
                    >
                      <UserPlus className="h-4 w-4 mr-1.5" />
                      {addingMissing ? 'กำลังเพิ่ม...' : 'เพิ่มพนักงานที่ขาด'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openBulkExclude}
                      className="border-[#374151] text-[#E5E7EB] hover:bg-[#1F2937]"
                    >
                      <Users className="h-4 w-4 mr-1.5" />
                      เลือกพนักงานที่ไม่รับโบนัส (รวม)
                    </Button>
                    <p className="text-sm text-[#D4AF37]/90">
                      → ใส่ค่าข้าว / รายการเพิ่มอื่น และหักเงินเดือนได้ที่ปุ่ม <strong>กรอกรายการ</strong> ในแถวของแต่ละคน
                      <br />
                      → เลือก <strong>ไม่รับโบนัส</strong> สำหรับพนักงานที่ไม่ได้รับโบนัส (จะไม่นับวันทำงานเข้าไปหารโบนัส)
                    </p>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border border-[#1F2937]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#1F2937] bg-[#111827] hover:bg-[#111827]">
                        <TableHead
                          className="px-4 py-3 font-medium text-[#9CA3AF] cursor-pointer select-none"
                          onClick={() => toggleSort('name')}
                        >
                          <span className="flex items-center gap-1">
                            ชื่อ
                            {sortBy === 'name' ? sortDir === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4 opacity-50" />}
                          </span>
                        </TableHead>
                        {run.status === 'DRAFT' && user.role === 'SUPER_ADMIN' && (
                          <TableHead className="px-4 py-3 text-center font-medium text-[#9CA3AF]" title="ไม่นับเข้าไปหารโบนัส">
                            ไม่รับโบนัส
                          </TableHead>
                        )}
                        <TableHead className="px-4 py-3 text-right font-medium text-[#9CA3AF]">วันทำงาน</TableHead>
                        <TableHead className="px-4 py-3 text-right font-medium text-[#9CA3AF]">เงินหลังหักวันหยุด</TableHead>
                        <TableHead className="px-4 py-3 text-right font-medium text-[#9CA3AF]">โบนัส</TableHead>
                        {allowanceTypes.length > 0 ? (
                          allowanceTypes.map((t) => (
                            <TableHead key={t.id} className="px-4 py-3 text-right font-medium text-[#9CA3AF]" title="รายการเพิ่ม">
                              {t.name}
                            </TableHead>
                          ))
                        ) : (
                          <TableHead className="px-4 py-3 text-right font-medium text-[#9CA3AF]">รายการเพิ่ม</TableHead>
                        )}
                        <TableHead className="px-4 py-3 text-right font-medium text-[#9CA3AF]">มาสาย</TableHead>
                        {deductionTypes.length > 0 ? (
                          deductionTypes.map((t) => (
                            <TableHead key={t.id} className="px-4 py-3 text-right font-medium text-[#9CA3AF]" title="รายการหัก">
                              {t.name}
                            </TableHead>
                          ))
                        ) : (
                          <TableHead className="px-4 py-3 text-right font-medium text-[#9CA3AF]">รายการหัก</TableHead>
                        )}
                        <TableHead
                          className="px-4 py-3 text-right font-medium text-[#D4AF37] cursor-pointer select-none"
                          onClick={() => toggleSort('net')}
                        >
                          <span className="flex items-center gap-1 justify-end">
                            ยอดสุทธิ
                            {sortBy === 'net' ? sortDir === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4 opacity-50" />}
                          </span>
                        </TableHead>
                        {run.status === 'DRAFT' && (
                          <TableHead className="px-4 py-3 text-left font-medium text-[#9CA3AF]">ดำเนินการ</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedItems.map((item) => (
                        <TableRow key={item.id} className="border-[#1F2937] hover:bg-[#111827]/50">
                          <TableCell className="px-4 py-3 font-medium text-[#E5E7EB]">{item.username}</TableCell>
                          {run.status === 'DRAFT' && user.role === 'SUPER_ADMIN' && (
                            <TableCell className="px-4 py-3 text-center">
                              <label className="flex items-center justify-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!item.excludeFromBonus}
                                  onChange={() => toggleExcludeFromBonus(item)}
                                  disabled={togglingBonus !== null}
                                  className="h-4 w-4 rounded border-[#374151] bg-[#1F2937] text-[#D4AF37] focus:ring-[#D4AF37]/50"
                                />
                                {togglingBonus === item.userId && (
                                  <span className="text-xs text-[#9CA3AF]">...</span>
                                )}
                              </label>
                            </TableCell>
                          )}
                          <TableCell className="px-4 py-3 text-right text-[#9CA3AF]">{item.workingDays} วัน</TableCell>
                          <TableCell className="px-4 py-3 text-right text-[#E5E7EB]">{formatPayroll(item.salaryAfterHolidayMinor)}</TableCell>
                          <TableCell className="px-4 py-3 text-right text-[#E5E7EB]">{formatPayroll(item.bonusPortionMinor)}</TableCell>
                          {allowanceTypes.length > 0 ? (
                            allowanceTypes.map((t) => {
                              const amt = (item.allowances ?? []).find((a) => a.name === t.name)?.amountMinor ?? 0;
                              return (
                                <TableCell key={t.id} className="px-4 py-3 text-right">
                                  {amt > 0 ? (
                                    <span className="text-green-400">+{formatPayroll(amt)}</span>
                                  ) : (
                                    <span className="text-[#6B7280]">-</span>
                                  )}
                                </TableCell>
                              );
                            })
                          ) : (
                            <TableCell className="px-4 py-3 text-right">
                              {(item.totalAllowancesMinor ?? 0) > 0 ? (
                                <span className="text-green-400">+{formatPayroll(item.totalAllowancesMinor ?? 0)}</span>
                              ) : (
                                <span className="text-[#6B7280]">-</span>
                              )}
                            </TableCell>
                          )}
                          <TableCell className="px-4 py-3 text-right">
                            {(item.lateDeductionMinor ?? 0) > 0 ? (
                              <span className="text-orange-400" title={`${item.lateMinutes ?? 0} นาที`}>
                                −{formatPayroll(item.lateDeductionMinor ?? 0)}
                              </span>
                            ) : (
                              <span className="text-[#6B7280]">-</span>
                            )}
                          </TableCell>
                          {deductionTypes.length > 0 ? (
                            deductionTypes.map((t) => {
                              const amt = (item.deductions ?? []).find((d) => d.label === t.name)?.amountMinor ?? 0;
                              return (
                                <TableCell key={t.id} className="px-4 py-3 text-right">
                                  {amt > 0 ? (
                                    <span className="text-red-400">−{formatPayroll(amt)}</span>
                                  ) : (
                                    <span className="text-[#6B7280]">-</span>
                                  )}
                                </TableCell>
                              );
                            })
                          ) : (
                            <TableCell className="px-4 py-3 text-right">
                              {(item.totalDeductionsMinor ?? 0) > 0 ? (
                                <span className="text-red-400">−{formatPayroll(item.totalDeductionsMinor ?? 0)}</span>
                              ) : (
                                <span className="text-[#6B7280]">-</span>
                              )}
                            </TableCell>
                          )}
                          <TableCell className="px-4 py-3 text-right font-semibold text-[#D4AF37]">{formatPayroll(item.netAmountMinor)} กีบ</TableCell>
                          {run.status === 'DRAFT' && (
                            <TableCell className="px-4 py-3">
                              <Button variant="outline" size="sm" onClick={() => openEdit(item)} className="border-[#374151] text-[#E5E7EB] hover:bg-[#1F2937]">
                                กรอกรายการ
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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

      <Dialog open={bulkExcludeOpen} onOpenChange={setBulkExcludeOpen}>
        <DialogContent className="border-[#1F2937] bg-[#0F172A] text-[#E5E7EB] max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              เลือกพนักงานที่ไม่รับโบนัส
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#9CA3AF]">
            เลือกพนักงานที่ต้องการยกเว้นจากโบนัส — จะไม่นับวันทำงานเข้าไปหารโบนัส
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto py-2">
            {items.map((item) => (
              <label
                key={item.userId}
                className="flex items-center gap-3 rounded-lg border border-[#1F2937] px-3 py-2 cursor-pointer hover:bg-[#111827] transition-colors"
              >
                <input
                  type="checkbox"
                  checked={bulkExcludeSelected.has(item.userId)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setBulkExcludeSelected((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(item.userId);
                      else next.delete(item.userId);
                      return next;
                    });
                  }}
                  disabled={bulkExcludeSaving}
                  className="h-4 w-4 rounded border-[#374151] bg-[#1F2937] text-[#D4AF37]"
                />
                <span className="font-medium">{item.username}</span>
                <span className="text-sm text-[#9CA3AF]">{item.workingDays} วัน</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setBulkExcludeOpen(false)} className="border-[#374151]">
              ยกเลิก
            </Button>
            <Button
              onClick={() => handleBulkExclude(Array.from(bulkExcludeSelected))}
              disabled={bulkExcludeSaving}
              className="bg-[#D4AF37] text-[#0F172A] hover:bg-[#D4AF37]/90"
            >
              {bulkExcludeSaving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editOpen} onOpenChange={(o) => !o && setEditOpen(null)}>
        <DialogContent className="border-[#1F2937] bg-[#0F172A] text-[#E5E7EB] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              กรอกรายการเพิ่มและรายการหัก — {editOpen?.username}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {run?.status === 'DRAFT' && user?.role === 'SUPER_ADMIN' && (
              <div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-[#E5E7EB]">
                  <Banknote className="h-4 w-4 text-[#D4AF37]" />
                  Override เงินเดือนฐาน (เฉพาะเดือนนี้)
                </h4>
                <p className="mb-2 text-xs text-[#9CA3AF]">
                  ค่าเริ่มต้นจากประวัติเงินเดือน: {formatPayroll(editOpen?.baseSalaryMinor ?? 0)} กีบ. ว่าง = ใช้ค่าจากประวัติ
                </p>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="ว่าง = ใช้จากประวัติ"
                  className="w-40 bg-[#1F2937] border-[#374151] text-right tabular-nums"
                  value={overrideBaseSalary}
                  onChange={(e) => setOverrideBaseSalary(e.target.value)}
                  onBlur={() => {
                    const parsed = parseDisplayToMinor(overrideBaseSalary, PAYROLL_CURRENCY);
                    if (parsed > 0) setOverrideBaseSalary(formatPayroll(parsed));
                  }}
                />
                <span className="ml-2 text-xs text-[#6B7280]">กีบ</span>
              </div>
            )}

            <div>
              <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-[#E5E7EB]">
                <PlusCircle className="h-4 w-4 text-green-400" />
                รายการเพิ่ม (ตามหมวดหมู่ที่ตั้งค่า)
              </h4>
              <p className="mb-2 text-xs text-[#9CA3AF]">
                กรอกจำนวนต่อหมวดหมู่ — 0 = ไม่ใช้รายการนี้. ไปเพิ่มหมวดหมู่ที่ ตั้งค่า → หมวดหมู่รายการเพิ่ม
              </p>
              {allowanceTypes.length === 0 ? (
                <p className="rounded border border-[#1F2937] px-4 py-3 text-sm text-[#9CA3AF]">
                  ยังไม่มีหมวดหมู่ — ไปที่ ตั้งค่า → หมวดหมู่รายการเพิ่ม เพื่อเพิ่มหมวดหมู่ (ค่าไฟ, ค่าข้าว ฯลฯ)
                </p>
              ) : (
                <div className="space-y-2">
                  {allowanceTypes.map((t) => (
                    <div key={t.id} className="flex gap-2 items-center">
                      <span className="min-w-[140px] text-[#E5E7EB]">{t.name}</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={(allowanceAmounts[t.name] ?? 0) > 0 ? formatPayroll(allowanceAmounts[t.name] ?? 0) : ''}
                        onChange={(e) => {
                          const minor = parseDisplayToMinor(e.target.value, PAYROLL_CURRENCY);
                          setAllowanceAmounts((p) => ({ ...p, [t.name]: minor }));
                        }}
                        className="flex-1 max-w-[140px] bg-[#1F2937] border-[#374151] text-right tabular-nums"
                      />
                      <span className="text-xs text-[#6B7280] w-8">กีบ</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-[#E5E7EB]">
                <MinusCircle className="h-4 w-4 text-red-400" />
                รายการหัก (ตามหมวดหมู่ที่ตั้งค่า)
              </h4>
              <p className="mb-2 text-xs text-[#9CA3AF]">
                กรอกจำนวนต่อหมวดหมู่ — 0 = ไม่ใช้รายการนี้. ไปเพิ่มหมวดหมู่ที่ ตั้งค่า → หมวดหมู่รายการหัก
              </p>
              {deductionTypes.length === 0 ? (
                <p className="rounded border border-[#1F2937] px-4 py-3 text-sm text-[#9CA3AF]">
                  ยังไม่มีหมวดหมู่ — ไปที่ ตั้งค่า → หมวดหมู่รายการหัก เพื่อเพิ่มหมวดหมู่ (มาสาย, ค่าปรับ ฯลฯ)
                </p>
              ) : (
                <div className="space-y-2">
                  {deductionTypes.map((t) => (
                    <div key={t.id} className="flex gap-2 items-center">
                      <span className="min-w-[140px] text-[#E5E7EB]">{t.name}</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={(deductionAmounts[t.name] ?? 0) > 0 ? formatPayroll(deductionAmounts[t.name] ?? 0) : ''}
                        onChange={(e) => {
                          const minor = parseDisplayToMinor(e.target.value, PAYROLL_CURRENCY);
                          setDeductionAmounts((p) => ({ ...p, [t.name]: minor }));
                        }}
                        className="flex-1 max-w-[140px] bg-[#1F2937] border-[#374151] text-right tabular-nums"
                      />
                      <span className="text-xs text-[#6B7280] w-8">กีบ</span>
                    </div>
                  ))}
                </div>
              )}
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
