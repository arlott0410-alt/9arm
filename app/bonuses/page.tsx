'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatMinorToDisplay, parseDisplayToMinor, todayStr, formatDateTimeThailand } from '@/lib/utils';
import { TimeInput24 } from '@/components/ui/time-input-24';
import { Copy } from 'lucide-react';

type Website = { id: number; name: string; prefix: string };
type BonusCategory = { id: number; name: string; sortOrder: number };
type Bonus = {
  id: number;
  websiteId: number;
  userIdInput: string;
  userFull: string;
  categoryId: number;
  displayCurrency: string;
  amountMinor: number;
  bonusTime: string;
  createdBy: number;
  createdAt: string;
  websiteName: string;
  categoryName: string;
  createdByUsername: string;
  deletedAt?: string | null;
  deletedByUsername?: string | null;
  deleteReason?: string | null;
};

export default function BonusesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [categories, setCategories] = useState<BonusCategory[]>([]);
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [settings, setSettings] = useState<{ displayCurrency: string } | null>(null);
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [filterTimeFrom, setFilterTimeFrom] = useState('00:00');
  const [filterTimeTo, setFilterTimeTo] = useState('23:59');
  const [filterWebsite, setFilterWebsite] = useState('__all__');
  const [filterCategory, setFilterCategory] = useState('__all__');
  const [filterDeleted, setFilterDeleted] = useState(false);
  const [form, setForm] = useState({
    websiteId: 0,
    userIdInput: '',
    categoryId: 0,
    amountMinor: 0,
    bonusDate: todayStr(),
    bonusTime: '00:00',
  });
  const [loading, setLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<Bonus | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const canMutate = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

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
    Promise.all([
      fetch('/api/settings/websites').then((r) => r.json() as Promise<Website[]>),
      fetch('/api/settings/bonus-categories').then((r) => r.json() as Promise<BonusCategory[]>),
      fetch('/api/settings').then((r) => r.json() as Promise<{ DISPLAY_CURRENCY?: string }>),
    ]).then(([w, c, s]) => {
      setWebsites(Array.isArray(w) ? w : []);
      setCategories(Array.isArray(c) ? c : []);
      setSettings({ displayCurrency: s.DISPLAY_CURRENCY || 'THB' });
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams({
      dateFrom,
      dateTo,
      ...(filterWebsite !== '__all__' && { websiteId: filterWebsite }),
      ...(filterCategory !== '__all__' && { categoryId: filterCategory }),
      ...(filterDeleted && { deletedOnly: 'true' }),
    });
    fetch(`/api/bonuses?${params}`)
      .then((r) => r.json() as Promise<Bonus[]>)
      .then(setBonuses);
  }, [user, dateFrom, dateTo, filterWebsite, filterCategory, filterDeleted]);

  function extractSlipTimeHM(s: string | null | undefined): string {
    if (!s || typeof s !== 'string') return '00:00';
    const t = s.includes('T') ? s.split('T')[1] : s;
    const parts = t?.split(':') ?? [];
    if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    return '00:00';
  }
  function inTimeRange(bonusTime: string | null | undefined): boolean {
    const hm = extractSlipTimeHM(bonusTime);
    return hm >= filterTimeFrom && hm <= filterTimeTo;
  }
  const filteredBonuses = bonuses.filter((b) => inTimeRange(b.bonusTime));
  const sortedBonuses = [...filteredBonuses].sort((a, b) =>
    (a.bonusTime || '').localeCompare(b.bonusTime || '')
  );

  function getSelectedWebsite() {
    return websites.find((w) => w.id === form.websiteId);
  }
  function getUserFull() {
    const w = getSelectedWebsite();
    return w ? `${w.prefix}${form.userIdInput}` : form.userIdInput || '';
  }
  function copyUserFull() {
    const full = getUserFull();
    if (full) navigator.clipboard.writeText(full);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canMutate) return;
    if (form.amountMinor <= 0) return;
    if (!form.websiteId || !form.categoryId) return;
    const userFull = getUserFull();
    if (!userFull) return;

    setLoading(true);
    try {
      const bonusTime = `${form.bonusDate}T${form.bonusTime}`;
      const res = await fetch('/api/bonuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteId: form.websiteId,
          userIdInput: form.userIdInput,
          userFull,
          categoryId: form.categoryId,
          amountMinor: form.amountMinor,
          bonusTime,
        }),
      });
      const data = (await res.json()) as Bonus & { error?: string };
      if (res.ok) {
        setForm({ ...form, amountMinor: 0, userIdInput: '' });
        const params = new URLSearchParams({
          dateFrom,
          dateTo,
          ...(filterWebsite !== '__all__' && { websiteId: filterWebsite }),
          ...(filterCategory !== '__all__' && { categoryId: filterCategory }),
          ...(filterDeleted && { deletedOnly: 'true' }),
        });
        const list = (await fetch(`/api/bonuses?${params}`).then((r) => r.json())) as Bonus[];
        setBonuses(list);
      } else {
        alert(typeof data.error === 'string' ? data.error : 'เกิดข้อผิดพลาด');
      }
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  const dispCur = settings?.displayCurrency || 'THB';

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[#E5E7EB]">โบนัส</h1>

        {canMutate && (
          <Card className="border-[#1F2937] bg-[#0F172A] max-w-4xl">
            <CardHeader className="py-4">
              <CardTitle className="text-[#E5E7EB] text-lg">สร้างรายการโบนัส</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  <div>
                    <Label>เว็บไซต์</Label>
                    <Select
                      value={form.websiteId ? String(form.websiteId) : ''}
                      onValueChange={(v) => setForm({ ...form, websiteId: parseInt(v) || 0 })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="เลือก" />
                      </SelectTrigger>
                      <SelectContent>
                        {websites.map((w) => (
                          <SelectItem key={w.id} value={String(w.id)}>
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>รหัสผู้ใช้</Label>
                    <Input
                      value={form.userIdInput}
                      onChange={(e) => setForm({ ...form, userIdInput: e.target.value })}
                      placeholder="ใส่รหัสผู้ใช้"
                    />
                  </div>
                  <div>
                    <Label>ชื่อผู้ใช้เต็ม</Label>
                    <div className="flex gap-2">
                      <Input
                        value={getUserFull()}
                        readOnly
                        className="bg-[#111827]"
                      />
                      <Button type="button" variant="outline" size="icon" onClick={copyUserFull}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>จำนวนโบนัส ({dispCur})</Label>
                    <Input
                      type="text"
                      placeholder="0"
                      value={form.amountMinor ? formatMinorToDisplay(form.amountMinor, dispCur) : ''}
                      onChange={(e) => {
                        const v = parseDisplayToMinor(e.target.value, dispCur);
                        setForm({ ...form, amountMinor: v });
                      }}
                    />
                  </div>
                  <div>
                    <Label>หมวดหมู่โบนัส</Label>
                    <Select
                      value={form.categoryId ? String(form.categoryId) : ''}
                      onValueChange={(v) => setForm({ ...form, categoryId: parseInt(v) || 0 })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="เลือก" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {categories.length === 0 && (
                      <p className="mt-1 text-xs text-amber-400">
                        ยังไม่มีหมวดหมู่ โปรดไปที่ ตั้งค่า → หมวดหมู่โบนัส เพื่อเพิ่มหมวดหมู่ (Superadmin เท่านั้น)
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>วันที่ให้โบนัส</Label>
                    <Input
                      type="date"
                      value={form.bonusDate}
                      onChange={(e) => setForm({ ...form, bonusDate: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>เวลาที่ให้โบนัส</Label>
                    <TimeInput24
                      value={form.bonusTime}
                      onChange={(v) => setForm({ ...form, bonusTime: v })}
                    />
                  </div>
                </div>
                <Button type="submit" disabled={loading || form.amountMinor <= 0 || !form.websiteId || !form.categoryId || !getUserFull()}>
                  บันทึก
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="border-[#1F2937] bg-[#0F172A]">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <CardTitle className="text-[#E5E7EB]">รายการโบนัส</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-36"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-36"
                />
                <TimeInput24 value={filterTimeFrom} onChange={setFilterTimeFrom} />
                <TimeInput24 value={filterTimeTo} onChange={setFilterTimeTo} />
                <Select value={filterWebsite} onValueChange={setFilterWebsite}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="เว็บไซต์" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">ทั้งหมด</SelectItem>
                    {websites.map((w) => (
                      <SelectItem key={w.id} value={String(w.id)}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="หมวดหมู่" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">ทั้งหมด</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-sm text-[#9CA3AF]">
                  <input
                    type="checkbox"
                    checked={filterDeleted}
                    onChange={(e) => setFilterDeleted(e.target.checked)}
                  />
                  รายการที่ลบ
                </label>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1F2937]">
                    <th className="py-2 text-left text-[#9CA3AF]">วันที่/เวลา</th>
                    <th className="py-2 text-left text-[#9CA3AF]">เว็บไซต์</th>
                    <th className="py-2 text-left text-[#9CA3AF]">ผู้ใช้</th>
                    <th className="py-2 text-left text-[#9CA3AF]">หมวดหมู่</th>
                    <th className="py-2 text-right text-[#9CA3AF] min-w-[100px] pr-4">จำนวน</th>
                    <th className="py-2 text-left text-[#9CA3AF] min-w-[90px] pl-6">ผู้ดำเนินการ</th>
                    {filterDeleted && (
                      <>
                        <th className="py-2 text-left text-[#9CA3AF]">ลบโดย</th>
                        <th className="py-2 text-left text-[#9CA3AF]">เหตุผล</th>
                      </>
                    )}
                    <th className="py-2 text-left text-[#9CA3AF]">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBonuses.map((b) => (
                    <tr key={b.id} className="border-b border-[#1F2937] whitespace-nowrap">
                      <td className="py-2 text-[#E5E7EB]">{formatDateTimeThailand(b.bonusTime)}</td>
                      <td className="py-2">{b.websiteName}</td>
                      <td className="py-2">{b.userFull}</td>
                      <td className="py-2">{b.categoryName}</td>
                      <td className="py-2 text-right font-medium text-[#D4AF37] min-w-[100px] pr-4">
                        {formatMinorToDisplay(b.amountMinor, b.displayCurrency)} {b.displayCurrency}
                      </td>
                      <td className="py-2 min-w-[90px] pl-6">{b.createdByUsername}</td>
                      {filterDeleted && (
                        <>
                          <td className="py-2 text-red-400/90">{b.deletedByUsername ?? '-'}</td>
                          <td className="py-2 text-[#9CA3AF] max-w-[160px] truncate" title={b.deleteReason ?? undefined}>
                            {b.deleteReason ?? '-'}
                          </td>
                        </>
                      )}
                      <td className="py-2 flex items-center gap-2">
                        <Link
                          href={`/bonuses/${b.id}`}
                          className="text-[#D4AF37] hover:underline"
                        >
                          ดู
                        </Link>
                        {canMutate && !filterDeleted && (
                          <button
                            onClick={() => setDeleteModal(b)}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            ลบ
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {sortedBonuses.length === 0 && (
                    <tr>
                      <td colSpan={filterDeleted ? 9 : 7} className="py-6 text-center text-[#9CA3AF]">
                        ไม่มีรายการโบนัส
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!deleteModal} onOpenChange={(o) => { if (!o) { setDeleteModal(null); setDeleteReason(''); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ลบรายการโบนัส</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-[#9CA3AF]">ระบุเหตุผลในการลบ</p>
            <Input
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="เหตุผลที่ลบ"
              className="mt-2"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setDeleteModal(null); setDeleteReason(''); }}>
                ยกเลิก
              </Button>
              <Button
                disabled={!deleteReason.trim() || deleteLoading}
                className="bg-red-600 hover:bg-red-700"
                onClick={async () => {
                  if (!deleteModal || !deleteReason.trim()) return;
                  setDeleteLoading(true);
                  try {
                    const res = await fetch(`/api/bonuses/${deleteModal.id}`, {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ deleteReason: deleteReason.trim() }),
                    });
                    const data = (await res.json()) as { error?: string };
                    if (res.ok) {
                      setDeleteModal(null);
                      setDeleteReason('');
                      const params = new URLSearchParams({
                        dateFrom,
                        dateTo,
                        ...(filterWebsite !== '__all__' && { websiteId: filterWebsite }),
                        ...(filterCategory !== '__all__' && { categoryId: filterCategory }),
                        ...(filterDeleted && { deletedOnly: 'true' }),
                      });
                      const list = (await fetch(`/api/bonuses?${params}`).then((r) => r.json())) as Bonus[];
                      setBonuses(list);
                    } else {
                      alert(typeof data.error === 'string' ? data.error : 'ลบไม่ได้');
                    }
                  } finally {
                    setDeleteLoading(false);
                  }
                }}
              >
                ยืนยันลบ
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
