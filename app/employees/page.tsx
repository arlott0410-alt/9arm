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
import { Users, Calendar, Banknote } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';

type Employee = {
  id: number;
  username: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export default function EmployeesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [holidayHeadUserId, setHolidayHeadUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingHolidayHead, setSavingHolidayHead] = useState(false);
  const [salaryYearMonth, setSalaryYearMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  type SalaryRow = { userId: number; username: string; baseSalaryMinor: number | null; currency: string | null; effectiveFrom: string | null };
  const [salaryRows, setSalaryRows] = useState<SalaryRow[]>([]);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [savingSalary, setSavingSalary] = useState<number | null>(null);
  const [pendingSalaries, setPendingSalaries] = useState<Record<number, { baseSalaryMinor: number; currency: string }>>({});

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

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch('/api/employees')
      .then((r) => r.json() as Promise<{ employees: Employee[]; holidayHeadUserId: number | null }>)
      .then((data) => {
        setEmployees(data.employees ?? []);
        setHolidayHeadUserId(data.holidayHeadUserId ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setSalaryLoading(true);
    fetch(`/api/employee-salaries?yearMonth=${salaryYearMonth}`)
      .then((r) => r.json() as Promise<{ yearMonth: string; items: SalaryRow[] }>)
      .then((data) => {
        setSalaryRows(data.items ?? []);
      })
      .catch(console.error)
      .finally(() => setSalaryLoading(false));
  }, [user, salaryYearMonth]);

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
                value={holidayHeadUserId != null ? String(holidayHeadUserId) : '__none__'}
                onValueChange={(v) => setHolidayHeadUserId(v === '__none__' ? null : parseInt(v, 10))}
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
                    body: JSON.stringify({ userId: holidayHeadUserId }),
                  });
                  if (res.ok) {
                    const d = (await res.json()) as { userId: number | null };
                    setHolidayHeadUserId(d.userId);
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
                                    setSalaryRows((prev) =>
                                      prev.map((r) =>
                                        r.userId === row.userId
                                          ? {
                                              ...r,
                                              baseSalaryMinor: b.baseSalaryMinor,
                                              currency: 'LAK',
                                              effectiveFrom: `${salaryYearMonth}-01`,
                                            }
                                          : r
                                      )
                                    );
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
      </div>
    </AppLayout>
  );
}
