'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Calendar, Banknote, History, Plus } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useEmployees, type Employee } from '@/hooks/use-employees';
import { useEmployeeSalaries, type SalaryRow } from '@/hooks/use-employee-salaries';

export default function EmployeesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const canLoad = !!user && user.role === 'SUPER_ADMIN';
  const { data: employeesData, isLoading: loading, mutate: mutateEmployees } = useEmployees(canLoad);
  const [savingHolidayHead, setSavingHolidayHead] = useState(false);
  const [salaryYearMonth, setSalaryYearMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const { data: salariesData, isLoading: salaryLoading, mutate: mutateSalaries } = useEmployeeSalaries(canLoad ? salaryYearMonth : '');
  const [savingSalary, setSavingSalary] = useState<number | null>(null);
  const [pendingSalaries, setPendingSalaries] = useState<Record<number, { baseSalaryMinor: number; currency: string }>>({});
  const [salaryHistoryUserId, setSalaryHistoryUserId] = useState<number | ''>('');
  const [salaryHistory, setSalaryHistory] = useState<{
    userId: number;
    username: string;
    history: { id: number; effectiveFrom: string; effectiveTo: string | null; baseSalaryMinor: number; currency: string }[];
  } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [newSalaryEffectiveFrom, setNewSalaryEffectiveFrom] = useState('');
  const [newSalaryAmount, setNewSalaryAmount] = useState('');
  const [addingSalary, setAddingSalary] = useState(false);

  const employees = employeesData?.employees ?? [];
  const holidayHeadUserId = employeesData?.holidayHeadUserId ?? null;
  const [holidayHeadInput, setHolidayHeadInput] = useState<number | null | undefined>(undefined);
  const salaryRows = salariesData?.items ?? [];
  const displayHolidayHead = holidayHeadInput !== undefined ? holidayHeadInput : holidayHeadUserId;

  useEffect(() => {
    if (salaryHistoryUserId && typeof salaryHistoryUserId === 'number') {
      setLoadingHistory(true);
      fetch(`/api/employee-salaries/history?userId=${salaryHistoryUserId}`)
        .then((r) => r.json() as Promise<{ userId?: number; username?: string; history?: { id: number; effectiveFrom: string; effectiveTo: string | null; baseSalaryMinor: number; currency: string }[] }>)
        .then((d) => {
          if (d.userId != null && d.username !== undefined) {
            setSalaryHistory({
              userId: d.userId,
              username: d.username,
              history: d.history ?? [],
            });
          } else {
            setSalaryHistory(null);
          }
        })
        .catch(() => setSalaryHistory(null))
        .finally(() => setLoadingHistory(false));
    } else {
      setSalaryHistory(null);
    }
  }, [salaryHistoryUserId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'SUPER_ADMIN') {
      router.replace('/dashboard');
      return;
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[#E5E7EB]">จัดการพนักงาน</h1>
        <p className="text-sm text-[#9CA3AF]">
          รายชื่อผู้ใช้ role ADMIN (พนักงาน) — ใช้สำหรับตารางวันหยุดและเงินเดือน. การเปิด/ปิดใช้งาน และเปลี่ยนรหัสผ่าน ทำได้ที่{' '}
          <Link href="/settings" prefetch={false} className="text-[#D4AF37] hover:underline">
            ตั้งค่า → ผู้ใช้
          </Link>
        </p>

        <Card className="border-[#1F2937] bg-[#0F172A]">
          <CardHeader>
            <CardTitle className="text-[#E5E7EB] flex items-center gap-2">
              <Users className="h-5 w-5" />
              รายชื่อพนักงาน (ADMIN)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1F2937]">
                      <th className="py-3 text-left text-[#9CA3AF]">ชื่อผู้ใช้</th>
                      <th className="py-3 text-left text-[#9CA3AF]">สถานะ</th>
                      <th className="py-3 text-left text-[#9CA3AF]">หมายเหตุ</th>
                      <th className="py-3 text-left text-[#9CA3AF]">ล็อกอินล่าสุด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4].map((i) => (
                      <tr key={i} className="border-b border-[#1F2937]/50 animate-pulse">
                        <td className="py-3"><div className="h-4 w-24 rounded bg-[#2D3748]" /></td>
                        <td className="py-3"><div className="h-4 w-16 rounded bg-[#2D3748]" /></td>
                        <td className="py-3"><div className="h-4 w-20 rounded bg-[#2D3748]" /></td>
                        <td className="py-3"><div className="h-4 w-28 rounded bg-[#2D3748]" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1F2937]">
                      <th className="py-3 text-left text-[#9CA3AF]">ชื่อผู้ใช้</th>
                      <th className="py-3 text-left text-[#9CA3AF]">สถานะ</th>
                      <th className="py-3 text-left text-[#9CA3AF]">หมายเหตุ</th>
                      <th className="py-3 text-left text-[#9CA3AF]">ล็อกอินล่าสุด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id} className="border-b border-[#1F2937]/50 transition-colors hover:bg-[#1E293B]/50">
                        <td className="py-3 text-[#E5E7EB] font-medium">{emp.username}</td>
                        <td className="py-3">
                          <span
                            className={
                              emp.isActive
                                ? 'text-green-400'
                                : 'text-red-400/90'
                            }
                          >
                            {emp.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                          </span>
                        </td>
                        <td className="py-3 text-[#9CA3AF]">
                          {holidayHeadUserId === emp.id && (
                            <span className="inline-flex items-center gap-1 rounded bg-[#D4AF37]/20 px-2 py-0.5 text-xs text-[#D4AF37]">
                              <Calendar className="h-3 w-3" />
                              หัวหน้าวันหยุด
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-[#9CA3AF]">
                          {emp.lastLoginAt
                            ? new Date(emp.lastLoginAt).toLocaleString('th-TH')
                            : '-'}
                        </td>
                      </tr>
                    ))}
                    {employees.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-14 text-center">
                          <div className="flex flex-col items-center gap-2 text-[#9CA3AF]">
                            <Users className="h-10 w-10 opacity-50" />
                            <span>ไม่มีพนักงาน (ADMIN) ในระบบ</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#1F2937] bg-[#0F172A]">
          <CardHeader>
            <CardTitle className="text-[#E5E7EB] flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              หัวหน้าวันหยุด
            </CardTitle>
            <p className="text-sm text-[#9CA3AF]">
              เลือก ADMIN คนหนึ่งเป็นหัวหน้า — เฉพาะคนนี้เท่านั้นที่ลงวันหยุดให้พนักงาน (ADMIN) ทุกคนได้ (รวมถึงตัวเอง)
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="w-56">
              <Label>หัวหน้าวันหยุด</Label>
              <Select
                value={displayHolidayHead != null ? String(displayHolidayHead) : '__none__'}
                onValueChange={(v) => setHolidayHeadInput(v === '__none__' ? null : parseInt(v, 10))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="ไม่กำหนด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">ไม่กำหนด</SelectItem>
                  {employees
                    .filter((e) => e.isActive)
                    .map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.username}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              disabled={savingHolidayHead || loading}
              onClick={async () => {
                setSavingHolidayHead(true);
                try {
                  const res = await fetch('/api/settings/holiday-head', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: displayHolidayHead ?? holidayHeadUserId }),
                  });
                  if (res.ok) {
                    setHolidayHeadInput(undefined);
                    void mutateEmployees();
                  } else {
                    const d = (await res.json()) as { error?: string };
                    alert(d.error ?? 'บันทึกไม่ได้');
                  }
                } finally {
                  setSavingHolidayHead(false);
                }
              }}
            >
              บันทึก
            </Button>
          </CardContent>
        </Card>

        <Card className="border-[#1F2937] bg-[#0F172A]">
          <CardHeader>
            <CardTitle className="text-[#E5E7EB] flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              เงินเดือนฐาน
            </CardTitle>
            <p className="text-sm text-[#9CA3AF]">
              ตั้งค่าเงินเดือนฐานต่อพนักงาน (ใช้คำนวณรอบเงินเดือน). เลือกเดือนแล้วกรอกจำนวนเงิน — หน่วยเป็นกีบ (LAK)
            </p>
            <div className="flex items-center gap-4 pt-2">
              <div>
                <Label>เดือนที่ใช้</Label>
                <Input
                  type="month"
                  value={salaryYearMonth}
                  onChange={(e) => setSalaryYearMonth(e.target.value)}
                  className="mt-1 w-40 bg-[#1F2937] border-[#374151]"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {salaryLoading ? (
              <p className="py-4 text-center text-[#9CA3AF]">กำลังโหลด...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1F2937]">
                      <th className="py-2 text-left text-[#9CA3AF]">ชื่อผู้ใช้</th>
                      <th className="py-2 text-left text-[#9CA3AF]">เงินเดือนฐาน (กีบ)</th>
                      <th className="py-2 text-left text-[#9CA3AF]">ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaryRows.map((row) => {
                      const base = pendingSalaries[row.userId]?.baseSalaryMinor ?? row.baseSalaryMinor ?? 0;
                      return (
                        <tr key={row.userId} className="border-b border-[#1F2937]">
                          <td className="py-2 text-[#E5E7EB] font-medium">{row.username}</td>
                          <td className="py-2">
                            <Input
                              type="number"
                              min={0}
                              step={100}
                              className="w-32 bg-[#1F2937] border-[#374151]"
                              value={base ? base / 100 : ''}
                              onChange={(e) => {
                                const v = e.target.value === '' ? 0 : Math.round(parseFloat(e.target.value) * 100);
                                setPendingSalaries((p) => ({ ...p, [row.userId]: { baseSalaryMinor: v, currency: 'LAK' } }));
                              }}
                            />
                          </td>
                          <td className="py-2">
                            <Button
                              size="sm"
                              disabled={savingSalary === row.userId}
                              onClick={async () => {
                                setSavingSalary(row.userId);
                                try {
                                  const b = pendingSalaries[row.userId] ?? { baseSalaryMinor: row.baseSalaryMinor ?? 0, currency: 'LAK' };
                                  const res = await fetch('/api/employee-salaries', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      userId: row.userId,
                                      effectiveFrom: `${salaryYearMonth}-01`,
                                      baseSalaryMinor: b.baseSalaryMinor,
                                    }),
                                  });
                                  if (res.ok) {
                                    setPendingSalaries((p) => {
                                      const next = { ...p };
                                      delete next[row.userId];
                                      return next;
                                    });
                                    void mutateSalaries();
                                  } else {
                                    const d = (await res.json()) as { error?: string };
                                    alert(d.error ?? 'บันทึกไม่ได้');
                                  }
                                } finally {
                                  setSavingSalary(null);
                                }
                              }}
                            >
                              {savingSalary === row.userId ? 'กำลังบันทึก...' : 'บันทึก'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {salaryRows.length === 0 && (
                  <p className="py-4 text-center text-[#9CA3AF]">ไม่มีข้อมูลเงินเดือนฐานในเดือนนี้</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#1F2937] bg-[#0F172A]">
          <CardHeader>
            <CardTitle className="text-[#E5E7EB] flex items-center gap-2">
              <History className="h-5 w-5" />
              ประวัติเงินเดือน
            </CardTitle>
            <p className="text-sm text-[#9CA3AF]">
              ดูประวัติการเปลี่ยนเงินเดือนฐาน — เลือกพนักงานเพื่อดูและเพิ่มรายการใหม่ (effective-dated)
            </p>
            <div className="flex flex-wrap items-end gap-4 pt-2">
              <div className="w-56">
                <Label>พนักงาน</Label>
                <Select
                  value={salaryHistoryUserId === '' ? '__none__' : String(salaryHistoryUserId)}
                  onValueChange={(v) => setSalaryHistoryUserId(v === '__none__' ? '' : parseInt(v, 10))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกพนักงาน" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">เลือกพนักงาน</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <p className="py-6 text-center text-[#9CA3AF]">กำลังโหลด...</p>
            ) : salaryHistory ? (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-lg border border-[#1F2937]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1F2937] bg-[#111827]">
                        <th className="px-4 py-3 text-left font-medium text-[#9CA3AF]">มีผลตั้งแต่</th>
                        <th className="px-4 py-3 text-left font-medium text-[#9CA3AF]">ถึง</th>
                        <th className="px-4 py-3 text-right font-medium text-[#9CA3AF]">เงินเดือนฐาน (กีบ)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaryHistory.history.map((h) => (
                        <tr key={h.id} className="border-b border-[#1F2937]">
                          <td className="px-4 py-3 text-[#E5E7EB]">{h.effectiveFrom}</td>
                          <td className="px-4 py-3 text-[#9CA3AF]">{h.effectiveTo ?? '—'}</td>
                          <td className="px-4 py-3 text-right text-[#E5E7EB]">
                            {h.baseSalaryMinor.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-lg border border-[#1F2937] bg-[#111827] p-4">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-[#E5E7EB]">
                    <Plus className="h-4 w-4" />
                    เพิ่มการเปลี่ยนเงินเดือน
                  </h4>
                  <div className="flex flex-wrap items-end gap-4">
                    <div>
                      <Label>มีผลตั้งแต่ (YYYY-MM-DD)</Label>
                      <Input
                        type="date"
                        value={newSalaryEffectiveFrom}
                        onChange={(e) => setNewSalaryEffectiveFrom(e.target.value)}
                        className="mt-1 w-40 bg-[#1F2937] border-[#374151]"
                      />
                    </div>
                    <div>
                      <Label>เงินเดือนฐาน (กีบ)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={newSalaryAmount}
                        onChange={(e) => setNewSalaryAmount(e.target.value)}
                        className="mt-1 w-32 bg-[#1F2937] border-[#374151]"
                      />
                    </div>
                    <Button
                      disabled={addingSalary || !newSalaryEffectiveFrom || !newSalaryAmount}
                      onClick={async () => {
                        if (!salaryHistoryUserId || typeof salaryHistoryUserId !== 'number') return;
                        setAddingSalary(true);
                        try {
                          const baseSalaryMinor = Math.round(parseFloat(newSalaryAmount) || 0); // LAK: 1 minor = 1 kip
                          const res = await fetch('/api/employee-salaries', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              userId: salaryHistoryUserId,
                              effectiveFrom: newSalaryEffectiveFrom,
                              baseSalaryMinor,
                            }),
                          });
                          if (res.ok) {
                            setNewSalaryEffectiveFrom('');
                            setNewSalaryAmount('');
                            setSalaryHistory(null);
                            setLoadingHistory(true);
                            fetch(`/api/employee-salaries/history?userId=${salaryHistoryUserId}`)
                              .then((r) => r.json() as Promise<{ userId?: number; username?: string; history?: { id: number; effectiveFrom: string; effectiveTo: string | null; baseSalaryMinor: number; currency: string }[] }>)
                              .then((d) => {
                                if (d.userId != null && d.username !== undefined) {
                                  setSalaryHistory({
                                    userId: d.userId,
                                    username: d.username,
                                    history: d.history ?? [],
                                  });
                                }
                              })
                              .finally(() => setLoadingHistory(false));
                            void mutateSalaries();
                          } else {
                            const d = (await res.json()) as { error?: string };
                            alert(d.error ?? 'บันทึกไม่ได้');
                          }
                        } finally {
                          setAddingSalary(false);
                        }
                      }}
                    >
                      {addingSalary ? 'กำลังบันทึก...' : 'เพิ่ม'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="py-6 text-center text-[#9CA3AF]">เลือกพนักงานเพื่อดูประวัติเงินเดือน</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
