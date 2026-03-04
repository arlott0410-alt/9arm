'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Banknote } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';

type Run = {
  id: number;
  yearMonth: string;
  status: string;
  bonusPoolMinor: number | null;
  createdAt: string;
  createdBy: number;
};

export default function PayrollPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [yearMonth, setYearMonth] = useState('');
  const [bonusPool, setBonusPool] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'AUDIT') {
      router.replace('/dashboard');
      return;
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch('/api/payroll')
      .then((r) => r.json() as Promise<{ runs: Run[] }>)
      .then((data) => setRuns(data.runs ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const handleCreate = async () => {
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      alert('กรุณาเลือกปี-เดือน (YYYY-MM)');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yearMonth,
          bonusPoolMinor: bonusPool === '' ? 0 : Math.round(parseFloat(bonusPool) * 100),
        }),
      });
      const data = (await res.json()) as { run?: { id: number }; error?: string };
      if (res.ok && data.run) {
        setCreateOpen(false);
        setYearMonth('');
        setBonusPool('');
        setRuns((prev) => [
          { id: data.run!.id, yearMonth, status: 'DRAFT', bonusPoolMinor: bonusPool ? Math.round(parseFloat(bonusPool) * 100) : null, createdAt: new Date().toISOString(), createdBy: 0 },
          ...prev,
        ]);
        window.location.href = `/payroll/${data.run.id}`;
      } else {
        alert(data.error ?? 'สร้างไม่สำเร็จ');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) return null;

  const now = new Date();
  const defaultYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[#E5E7EB] flex items-center gap-2">
          <Banknote className="h-7 w-7 text-[#D4AF37]" />
          จัดการเงินเดือน
        </h1>
        <p className="text-sm text-[#9CA3AF]">
          {user.role === 'AUDIT'
            ? 'ดูรายการรอบเงินเดือนที่ยืนยันแล้ว และเงินเดือนของทุกคนในหน้ารายละเอียด (ดูได้อย่างเดียว)'
            : 'หัวหน้าแอดมินลงวันหยุด · จัดการเงินเดือนทุกอย่างโดย SUPER_ADMIN — สร้างรอบ (DRAFT) กรอกรายการเพิ่ม/หัก แล้วยืนยัน'}
        </p>

        <Card className="border-[#1F2937] bg-[#0F172A]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[#E5E7EB]">รอบเงินเดือน</CardTitle>
              {user.role === 'SUPER_ADMIN' && (
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => {
                      if (!yearMonth) setYearMonth(defaultYearMonth);
                    }}
                  >
                    สร้างรอบใหม่
                  </Button>
                </DialogTrigger>
                <DialogContent className="border-[#1F2937] bg-[#0F172A] text-[#E5E7EB]">
                  <DialogHeader>
                    <DialogTitle>สร้างรอบเงินเดือน</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <Label>ปี-เดือน (YYYY-MM)</Label>
                      <Input
                        type="month"
                        value={yearMonth}
                        onChange={(e) => setYearMonth(e.target.value)}
                        className="mt-1 bg-[#1F2937] border-[#374151]"
                      />
                    </div>
                    <div>
                      <Label>โบนัสก้อนรวม (บาท) — แบ่งตามสัดส่วนวันทำงาน</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="0"
                        value={bonusPool}
                        onChange={(e) => setBonusPool(e.target.value)}
                        className="mt-1 bg-[#1F2937] border-[#374151]"
                      />
                    </div>
                    <Button
                      onClick={handleCreate}
                      disabled={submitting || !yearMonth}
                      className="w-full"
                    >
                      {submitting ? 'กำลังสร้าง...' : 'สร้างรอบ (DRAFT)'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-6 text-center text-[#9CA3AF]">กำลังโหลด...</p>
            ) : runs.length === 0 ? (
              <p className="py-6 text-center text-[#9CA3AF]">ยังไม่มีรอบเงินเดือน</p>
            ) : (
              <div className="space-y-2">
                {runs.map((r) => (
                  <Link
                    key={r.id}
                    href={`/payroll/${r.id}`}
                    prefetch={false}
                    className="flex items-center justify-between rounded-lg border border-[#1F2937] px-4 py-3 text-[#E5E7EB] transition-colors hover:bg-[#111827] hover:border-[#374151]"
                  >
                    <span className="font-medium">{r.yearMonth}</span>
                    <span
                      className={
                        r.status === 'CONFIRMED'
                          ? 'rounded-full bg-green-500/20 px-3 py-0.5 text-sm text-green-400'
                          : 'rounded-full bg-amber-500/20 px-3 py-0.5 text-sm text-amber-400'
                      }
                    >
                      {r.status === 'CONFIRMED' ? 'ยืนยันแล้ว' : 'แบบร่าง'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
