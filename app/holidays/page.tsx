'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar, Plus, User, Clock } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';

type Employee = { id: number; username: string; role: string };
type HolidayEntry = { userId: number; date: string };
type LateEntry = { userId: number; date: string; minutes: number };

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

const LONG_PRESS_MS = 1000;

export default function HolidaysPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<HolidayEntry[]>([]);
  const [lateArrivals, setLateArrivals] = useState<LateEntry[]>([]);
  const [holidayHeadUserId, setHolidayHeadUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [lateDialog, setLateDialog] = useState<{ empId: number; empName: string; date: string; day: number; minutes: number } | null>(null);
  const [lateInputMinutes, setLateInputMinutes] = useState('');
  const [savingLate, setSavingLate] = useState(false);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressHandledRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch(`/api/holidays?year=${year}&month=${month}`)
      .then((r) => r.json() as Promise<{
        employees: Employee[];
        entries: HolidayEntry[];
        lateArrivals: LateEntry[];
        holidayHeadUserId: number | null;
      }>)
      .then((data) => {
        setEmployees(data.employees ?? []);
        setEntries(data.entries ?? []);
        setLateArrivals(data.lateArrivals ?? []);
        setHolidayHeadUserId(data.holidayHeadUserId ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, year, month]);

  const entrySet = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      set.add(`${e.userId}:${e.date}`);
    }
    return set;
  }, [entries]);

  const lateMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of lateArrivals) {
      map.set(`${e.userId}:${e.date}`, e.minutes);
    }
    return map;
  }, [lateArrivals]);

  const isHead = user !== null && holidayHeadUserId !== null && user.id === holidayHeadUserId;
  const daysCount = getDaysInMonth(year, month);
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;

  async function toggleDay(empId: number, day: number) {
    if (!isHead || !user) return;
    const date = `${prefix}${String(day).padStart(2, '0')}`;
    const key = `${empId}:${date}`;
    const isSet = entrySet.has(key);

    if (isSet) {
      const res = await fetch('/api/holidays', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: empId, date }),
      });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.userId !== empId || e.date !== date));
      }
    } else {
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: empId, date }),
      });
      if (res.ok) {
        setEntries((prev) => [...prev, { userId: empId, date }]);
      }
    }
  }

  function handleCellPointerDown(empId: number, day: number, empName: string) {
    if (!isHead) return;
    longPressHandledRef.current = false;
    const date = `${prefix}${String(day).padStart(2, '0')}`;
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      longPressHandledRef.current = true;
      const minutes = lateMap.get(`${empId}:${date}`) ?? 0;
      setLateDialog({ empId, empName, date, day, minutes });
      setLateInputMinutes(minutes > 0 ? String(minutes) : '');
    }, LONG_PRESS_MS);
  }

  function handleCellPointerUp() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handleCellClick(empId: number, day: number) {
    if (longPressHandledRef.current) {
      longPressHandledRef.current = false;
      return;
    }
    toggleDay(empId, day);
  }

  async function saveLateArrival() {
    if (!lateDialog) return;
    const minutes = Math.max(0, Math.round(parseInt(lateInputMinutes, 10) || 0));
    setSavingLate(true);
    try {
      const res = await fetch('/api/late-arrivals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: lateDialog.empId, date: lateDialog.date, minutes }),
      });
      if (res.ok) {
        if (minutes === 0) {
          setLateArrivals((prev) => prev.filter((e) => e.userId !== lateDialog.empId || e.date !== lateDialog.date));
        } else {
          setLateArrivals((prev) => {
            const rest = prev.filter((e) => e.userId !== lateDialog.empId || e.date !== lateDialog.date);
            return [...rest, { userId: lateDialog.empId, date: lateDialog.date, minutes }];
          });
        }
        setLateDialog(null);
      } else {
        const d = (await res.json()) as { error?: string };
        alert(d.error ?? 'บันทึกไม่ได้');
      }
    } finally {
      setSavingLate(false);
    }
  }

  if (authLoading || !user) return null;

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[#E5E7EB]">ตารางวันหยุด</h1>
        <p className="text-sm text-[#9CA3AF]">
          ตารางนี้แสดงเฉพาะผู้ใช้ role ADMIN (เงินเดือนและวันหยุดนับเฉพาะ ADMIN).
          {isHead
            ? ' คุณเป็นหัวหน้าวันหยุด — คลิกเซลล์เพิ่ม/ลบวันหยุด · กดค้าง 1 วินาทีที่ปุ่ม + เพื่อลงมาสาย (หักนาทีละ 1000 กีบตอนคำนวณเงินเดือน)'
            : ' เฉพาะหัวหน้าวันหยุดสามารถลงวันหยุดได้'}
        </p>

        <Card className="border-[#1F2937] bg-[#0F172A]">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-4">
              <CardTitle className="text-[#E5E7EB]">รายการวันหยุดตามเดือน</CardTitle>
              <div className="flex items-center gap-2">
                <select
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                  className="h-10 rounded-lg border border-[#2D3748] bg-[#0F172A] px-3 text-sm text-[#E5E7EB] focus:border-[#D4AF37] focus:outline-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <span className="text-[#9CA3AF]">/</span>
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value, 10) || year)}
                  className="h-10 w-20 rounded-lg border border-[#2D3748] bg-[#0F172A] px-3 text-sm text-[#E5E7EB] focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
            </div>
            {isHead && (
              <p className="text-xs text-[#6B7280]">
                สีส้ม = มาสาย · กดค้าง 1 วินาทีที่ปุ่ม + เพื่อกรอก/แก้ไข/ลบ (นาที)
              </p>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-8 text-center text-[#9CA3AF]">กำลังโหลด...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#1F2937]">
                      <th className="sticky left-0 z-10 min-w-[140px] border-r border-b border-[#1F2937] bg-[#0F172A] py-2 pr-2 text-left text-[#9CA3AF]">
                        <span className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          ชื่อ
                        </span>
                      </th>
                      {Array.from({ length: daysCount }, (_, i) => i + 1).map((d) => (
                        <th
                          key={d}
                          className="min-w-[36px] border-b border-[#1F2937] py-1 text-center text-xs text-[#9CA3AF]"
                        >
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id} className="border-b border-[#1F2937]">
                        <td className="sticky left-0 z-10 border-r border-[#1F2937] bg-[#0F172A] py-1.5 pr-2 font-medium text-[#E5E7EB]">
                          {emp.username}
                          <span className="ml-1 text-xs text-[#9CA3AF]">({emp.role})</span>
                        </td>
                        {Array.from({ length: daysCount }, (_, i) => i + 1).map((day) => {
                          const date = `${prefix}${String(day).padStart(2, '0')}`;
                          const key = `${emp.id}:${date}`;
                          const isHoliday = entrySet.has(key);
                          const lateMinutes = lateMap.get(key) ?? 0;
                          const isLate = lateMinutes > 0;

                          return (
                            <td
                              key={day}
                              className={`min-w-[36px] border-[#1F2937] p-0.5 text-center align-middle ${isLate ? 'bg-orange-500/20' : ''}`}
                            >
                              {isHead ? (
                                <button
                                  type="button"
                                  onClick={() => handleCellClick(emp.id, day)}
                                  onPointerDown={() => handleCellPointerDown(emp.id, day, emp.username)}
                                  onPointerUp={handleCellPointerUp}
                                  onPointerLeave={handleCellPointerUp}
                                  className={`inline-flex h-8 w-8 items-center justify-center rounded border transition-colors ${
                                    isHoliday
                                      ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#D4AF37]'
                                      : isLate
                                        ? 'border-orange-400/60 bg-orange-500/30 text-orange-200'
                                        : 'border-dashed border-[#374151] text-[#6B7280] hover:border-[#D4AF37]/60 hover:text-[#D4AF37]'
                                  }`}
                                  title={
                                    isLate
? `มาสาย ${lateMinutes} นาที — กดค้างเพื่อแก้ไข/ลบ`
                                        : isHoliday
                                        ? `ลบวันหยุด ${date}`
                                        : `เพิ่มวันหยุด ${date} · กดค้าง 1 วิ สำหรับมาสาย`
                                  }
                                >
                                  {isHoliday ? (
                                    <span className="text-xs font-medium">หยุด</span>
                                  ) : isLate ? (
                                    <span className="text-xs font-medium">{lateMinutes}น</span>
                                  ) : (
                                    <Plus className="h-4 w-4" />
                                  )}
                                </button>
                              ) : (
                                <span
                                  className={`inline-flex h-8 w-8 items-center justify-center rounded ${
                                    isHoliday
                                      ? 'bg-[#D4AF37]/20 text-[#D4AF37] text-xs'
                                      : isLate
                                        ? 'bg-orange-500/20 text-orange-300 text-xs'
                                        : 'text-[#374151]'
                                  }`}
                                >
                                  {isHoliday ? 'หยุด' : isLate ? `${lateMinutes}น` : '—'}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {employees.length === 0 && (
                  <p className="py-6 text-center text-[#9CA3AF]">ไม่มีผู้ใช้ role ADMIN ในระบบ</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!lateDialog} onOpenChange={(o) => !o && setLateDialog(null)}>
        <DialogContent className="border-[#1F2937] bg-[#0F172A] text-[#E5E7EB] max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-400" />
              มาสาย — {lateDialog?.empName} วันที่ {lateDialog?.day}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#9CA3AF]">
            จำนวนนาทีที่มาสาย (หักนาทีละ 1000 กีบตอนคำนวณเงินเดือน). ใส่ 0 เพื่อลบรายการ
          </p>
          <div className="flex items-center gap-2 pt-2">
            <Label className="min-w-[80px]">นาที</Label>
            <Input
              type="number"
              min={0}
              value={lateInputMinutes}
              onChange={(e) => setLateInputMinutes(e.target.value)}
              className="flex-1 bg-[#1F2937] border-[#374151]"
              placeholder="0"
            />
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => setLateDialog(null)} className="border-[#374151]">
              ยกเลิก
            </Button>
            <Button onClick={saveLateArrival} disabled={savingLate} className="bg-[#D4AF37] text-[#0F172A] hover:bg-[#D4AF37]/90">
              {savingLate ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
