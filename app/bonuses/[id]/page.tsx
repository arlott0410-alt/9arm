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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatMinorToDisplay, parseDisplayToMinor, formatDateTimeThailand } from '@/lib/utils';
import { TimeInput24 } from '@/components/ui/time-input-24';
import { ArrowLeft } from 'lucide-react';

type BonusDetail = {
  id: number;
  websiteId: number;
  websiteName: string;
  websitePrefix: string;
  userIdInput: string;
  userFull: string;
  categoryId: number;
  categoryName: string;
  displayCurrency: string;
  amountMinor: number;
  bonusTime: string;
  createdByUsername: string;
  createdAt: string;
  deletedAt?: string | null;
  deletedByUsername?: string | null;
  deleteReason?: string | null;
  edits: {
    id: number;
    editedByUsername: string;
    editReason: string;
    beforeSnapshot: Record<string, unknown>;
    afterSnapshot: Record<string, unknown>;
    editedAt: string;
  }[];
};

export default function BonusDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const [bonus, setBonus] = useState<BonusDetail | null>(null);
  const [websites, setWebsites] = useState<{ id: number; name: string; prefix: string }[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [editForm, setEditForm] = useState<Partial<{
    websiteId: number;
    userIdInput: string;
    userFull: string;
    categoryId: number;
    amountMinor: number;
    bonusTime: string;
  }>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [loading, setLoading] = useState(false);
  const canEdit = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json() as Promise<{ user?: { username: string; role: string } }>)
      .then((d) => {
        if (!d.user) router.replace('/login');
        else setUser(d.user);
      });
  }, [router]);

  useEffect(() => {
    if (!user || !id) return;
    fetch(`/api/bonuses/${id}`)
      .then((r) => r.json() as Promise<BonusDetail & { error?: string }>)
      .then((d) => {
        if (d.error) return;
        setBonus(d);
        const dt = d.bonusTime?.includes('T') ? d.bonusTime.split('T')[0] : '';
        const tm = d.bonusTime?.includes('T') ? d.bonusTime.split('T')[1]?.slice(0, 5) || '00:00' : '00:00';
        setEditForm({
          websiteId: d.websiteId,
          userIdInput: d.userIdInput,
          userFull: d.userFull,
          categoryId: d.categoryId,
          amountMinor: d.amountMinor,
          bonusTime: dt ? `${dt}T${tm}` : '',
        });
      });
    Promise.all([
      fetch('/api/settings/websites').then((r) => r.json() as Promise<{ id: number; name: string; prefix: string }[]>),
      fetch('/api/settings/bonus-categories').then((r) => r.json() as Promise<{ id: number; name: string }[]>),
    ]).then(([w, c]) => {
      setWebsites(Array.isArray(w) ? w : []);
      setCategories(Array.isArray(c) ? c : []);
    });
  }, [user, id]);

  function openEdit() {
    if (!bonus) return;
    const dt = bonus.bonusTime?.includes('T') ? bonus.bonusTime.split('T')[0] : '';
    const tm = bonus.bonusTime?.includes('T') ? bonus.bonusTime.split('T')[1]?.slice(0, 5) || '00:00' : '00:00';
    setEditForm({
      websiteId: bonus.websiteId,
      userIdInput: bonus.userIdInput,
      userFull: bonus.userFull,
      categoryId: bonus.categoryId,
      amountMinor: bonus.amountMinor,
      bonusTime: dt ? `${dt}T${tm}` : '',
    });
    setEditReason('');
    setEditOpen(true);
  }

  function getEditUserFull() {
    const w = websites.find((x) => x.id === editForm.websiteId);
    const input = editForm.userIdInput ?? '';
    return w ? `${w.prefix}${input}` : input || editForm.userFull || '';
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !editReason.trim()) return;
    setLoading(true);
    try {
      const bonusDate = editForm.bonusTime?.split('T')[0] ?? '';
      const bonusTimePart = editForm.bonusTime?.split('T')[1]?.slice(0, 5) ?? '00:00';
      const userFull = getEditUserFull();

      const payload: Record<string, unknown> = {
        editReason: editReason.trim(),
        websiteId: editForm.websiteId,
        userIdInput: editForm.userIdInput,
        userFull,
        categoryId: editForm.categoryId,
        amountMinor: editForm.amountMinor,
        bonusTime: bonusDate ? `${bonusDate}T${bonusTimePart}` : undefined,
      };

      const res = await fetch(`/api/bonuses/${id}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const d = (await fetch(`/api/bonuses/${id}`).then((r) => r.json())) as BonusDetail;
        setBonus(d);
        setEditOpen(false);
      } else {
        const err = (await res.json()) as { error?: string };
        alert(err.error ?? 'แก้ไขไม่ได้');
      }
    } finally {
      setLoading(false);
    }
  }

  if (!user || !bonus) return null;

  const isDeleted = !!bonus.deletedAt;

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <Link
          href="/bonuses"
          className="inline-flex items-center gap-2 text-sm text-[#9CA3AF] hover:text-[#D4AF37]"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับไปโบนัส
        </Link>

        <Card className="border-[#1F2937] bg-[#0F172A]">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-[#E5E7EB]">
                โบนัส #{bonus.id}
                {isDeleted && (
                  <span className="ml-2 text-sm font-normal text-red-400">(ลบแล้ว)</span>
                )}
              </CardTitle>
              {canEdit && !isDeleted && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={openEdit}>
                    แก้ไข
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-400 border-red-400/50 hover:bg-red-500/10"
                    onClick={() => { setDeleteReason(''); setDeleteOpen(true); }}
                  >
                    ลบ
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="text-sm text-[#9CA3AF]">เว็บไซต์</span>
                <p className="text-[#E5E7EB]">{bonus.websiteName}</p>
              </div>
              <div>
                <span className="text-sm text-[#9CA3AF]">ชื่อผู้ใช้เต็ม</span>
                <p className="text-[#E5E7EB]">{bonus.userFull}</p>
              </div>
              <div>
                <span className="text-sm text-[#9CA3AF]">หมวดหมู่โบนัส</span>
                <p className="text-[#E5E7EB]">{bonus.categoryName}</p>
              </div>
              <div>
                <span className="text-sm text-[#9CA3AF]">จำนวนโบนัส</span>
                <p className="text-[#D4AF37] font-medium">
                  {formatMinorToDisplay(bonus.amountMinor, bonus.displayCurrency)}{' '}
                  {bonus.displayCurrency}
                </p>
              </div>
              <div>
                <span className="text-sm text-[#9CA3AF]">เวลาที่ให้โบนัส</span>
                <p className="text-[#E5E7EB]">{formatDateTimeThailand(bonus.bonusTime)}</p>
              </div>
              <div>
                <span className="text-sm text-[#9CA3AF]">ผู้ดำเนินการ</span>
                <p className="text-[#E5E7EB]">{bonus.createdByUsername}</p>
              </div>
              <div>
                <span className="text-sm text-[#9CA3AF]">สร้างเมื่อ</span>
                <p className="text-[#E5E7EB]">{formatDateTimeThailand(bonus.createdAt)}</p>
              </div>
              {isDeleted && (
                <>
                  <div>
                    <span className="text-sm text-[#9CA3AF]">ลบโดย</span>
                    <p className="text-red-400/90">{bonus.deletedByUsername ?? '-'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-[#9CA3AF]">เหตุผลที่ลบ</span>
                    <p className="text-[#E5E7EB]">{bonus.deleteReason ?? '-'}</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {bonus.edits && bonus.edits.length > 0 && (
          <Card className="border-[#1F2937] bg-[#0F172A]">
            <CardHeader>
              <CardTitle className="text-[#E5E7EB]">ประวัติการแก้ไข</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {bonus.edits.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-lg border border-[#1F2937] bg-[#111827] p-4"
                  >
                    <div className="flex justify-between text-sm text-[#9CA3AF]">
                      <span>{e.editedByUsername}</span>
                      <span>{formatDateTimeThailand(e.editedAt)}</span>
                    </div>
                    <p className="mt-2 text-[#E5E7EB]">{e.editReason}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ลบโบนัส</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-[#9CA3AF]">ระบุเหตุผลในการลบ</p>
            <Input
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="เหตุผลที่ลบ"
              className="mt-2"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                ยกเลิก
              </Button>
              <Button
                disabled={!deleteReason.trim() || loading}
                className="bg-red-600 hover:bg-red-700"
                onClick={async () => {
                  if (!deleteReason.trim()) return;
                  setLoading(true);
                  try {
                    const res = await fetch(`/api/bonuses/${id}`, {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ deleteReason: deleteReason.trim() }),
                    });
                    const data = (await res.json()) as { error?: string };
                    if (res.ok) {
                      router.replace('/bonuses');
                    } else {
                      alert(typeof data.error === 'string' ? data.error : 'ลบไม่ได้');
                    }
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                ยืนยันลบ
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>แก้ไขโบนัส</DialogTitle>
            </DialogHeader>
            <form onSubmit={submitEdit} className="space-y-4">
              <div>
                <Label>เหตุผลในการแก้ไข (จำเป็น)</Label>
                <Input
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  required
                  placeholder="อธิบายการเปลี่ยนแปลง"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>เว็บไซต์</Label>
                  <Select
                    value={editForm.websiteId ? String(editForm.websiteId) : ''}
                    onValueChange={(v) =>
                      setEditForm({ ...editForm, websiteId: parseInt(v) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
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
                    value={editForm.userIdInput || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, userIdInput: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>ชื่อผู้ใช้เต็ม</Label>
                  <Input
                    value={getEditUserFull()}
                    readOnly
                    className="bg-[#111827]"
                  />
                </div>
                <div>
                  <Label>หมวดหมู่โบนัส</Label>
                  <Select
                    value={editForm.categoryId ? String(editForm.categoryId) : ''}
                    onValueChange={(v) =>
                      setEditForm({ ...editForm, categoryId: parseInt(v) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>จำนวนโบนัส ({bonus.displayCurrency})</Label>
                  <Input
                    type="text"
                    value={
                      editForm.amountMinor !== undefined
                        ? formatMinorToDisplay(editForm.amountMinor, bonus.displayCurrency)
                        : ''
                    }
                    onChange={(e) => {
                      const v = parseDisplayToMinor(
                        e.target.value,
                        bonus.displayCurrency
                      );
                      setEditForm({ ...editForm, amountMinor: v });
                    }}
                  />
                </div>
                <div>
                  <Label>วันที่/เวลาที่ให้โบนัส</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={editForm.bonusTime?.split('T')[0] ?? ''}
                      onChange={(e) => {
                        const d = e.target.value;
                        const t = editForm.bonusTime?.split('T')[1] ?? '00:00';
                        setEditForm({ ...editForm, bonusTime: d ? `${d}T${t}` : '' });
                      }}
                    />
                    <TimeInput24
                      value={editForm.bonusTime?.split('T')[1]?.slice(0, 5) ?? '00:00'}
                      onChange={(v) => {
                        const d = editForm.bonusTime?.split('T')[0] ?? '';
                        setEditForm({ ...editForm, bonusTime: d ? `${d}T${v}` : `1970-01-01T${v}` });
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={loading}>
                  บันทึก
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
