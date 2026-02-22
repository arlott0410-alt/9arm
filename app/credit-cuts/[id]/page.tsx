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
import { ArrowLeft } from 'lucide-react';

type CreditCutDetail = {
  id: number;
  websiteId: number;
  websiteName: string;
  websitePrefix: string;
  userIdInput: string;
  userFull: string;
  displayCurrency: string;
  amountMinor: number;
  cutReason: string;
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

export default function CreditCutDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const [cut, setCut] = useState<CreditCutDetail | null>(null);
  const [websites, setWebsites] = useState<{ id: number; name: string; prefix: string }[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [editForm, setEditForm] = useState<Partial<{
    websiteId: number;
    userIdInput: string;
    userFull: string;
    amountMinor: number;
    cutReason: string;
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
    fetch(`/api/credit-cuts/${id}`)
      .then((r) => r.json() as Promise<CreditCutDetail & { error?: string }>)
      .then((d) => {
        if (d.error) return;
        setCut(d);
        setEditForm({
          websiteId: d.websiteId,
          userIdInput: d.userIdInput,
          userFull: d.userFull,
          amountMinor: d.amountMinor,
          cutReason: d.cutReason,
        });
      });
    fetch('/api/settings/websites').then((r) => r.json() as Promise<{ id: number; name: string; prefix: string }[]>).then((w) => setWebsites(Array.isArray(w) ? w : []));
  }, [user, id]);

  function openEdit() {
    if (!cut) return;
    setEditForm({
      websiteId: cut.websiteId,
      userIdInput: cut.userIdInput,
      userFull: cut.userFull,
      amountMinor: cut.amountMinor,
      cutReason: cut.cutReason,
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
      const userFull = getEditUserFull();

      const payload: Record<string, unknown> = {
        editReason: editReason.trim(),
        websiteId: editForm.websiteId,
        userIdInput: editForm.userIdInput,
        userFull,
        amountMinor: editForm.amountMinor,
        cutReason: editForm.cutReason,
      };

      const res = await fetch(`/api/credit-cuts/${id}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const d = (await fetch(`/api/credit-cuts/${id}`).then((r) => r.json())) as CreditCutDetail;
        setCut(d);
        setEditOpen(false);
      } else {
        const err = (await res.json()) as { error?: string };
        alert(err.error ?? 'แก้ไขไม่ได้');
      }
    } finally {
      setLoading(false);
    }
  }

  if (!user || !cut) return null;

  const isDeleted = !!cut.deletedAt;

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <Link
          href="/credit-cuts"
          className="inline-flex items-center gap-2 text-sm text-[#9CA3AF] hover:text-[#D4AF37]"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับไปตัดเครดิต
        </Link>

        <Card className="border-[#1F2937] bg-[#0F172A]">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-[#E5E7EB]">
                ตัดเครดิต #{cut.id}
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
                <p className="text-[#E5E7EB]">{cut.websiteName}</p>
              </div>
              <div>
                <span className="text-sm text-[#9CA3AF]">ชื่อผู้ใช้เต็ม</span>
                <p className="text-[#E5E7EB]">{cut.userFull}</p>
              </div>
              <div>
                <span className="text-sm text-[#9CA3AF]">จำนวนที่ตัด</span>
                <p className="text-[#D4AF37] font-medium">
                  {formatMinorToDisplay(cut.amountMinor, cut.displayCurrency)} {cut.displayCurrency}
                </p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-sm text-[#9CA3AF]">หมายเหตุ (เหตุผลที่ตัด)</span>
                <p className="text-[#E5E7EB]">{cut.cutReason}</p>
              </div>
              <div>
                <span className="text-sm text-[#9CA3AF]">ผู้ดำเนินการ</span>
                <p className="text-[#E5E7EB]">{cut.createdByUsername}</p>
              </div>
              <div>
                <span className="text-sm text-[#9CA3AF]">สร้างเมื่อ</span>
                <p className="text-[#E5E7EB]">{formatDateTimeThailand(cut.createdAt)}</p>
              </div>
              {isDeleted && (
                <>
                  <div>
                    <span className="text-sm text-[#9CA3AF]">ลบโดย</span>
                    <p className="text-red-400/90">{cut.deletedByUsername ?? '-'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-[#9CA3AF]">เหตุผลที่ลบ</span>
                    <p className="text-[#E5E7EB]">{cut.deleteReason ?? '-'}</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {cut.edits && cut.edits.length > 0 && (
          <Card className="border-[#1F2937] bg-[#0F172A]">
            <CardHeader>
              <CardTitle className="text-[#E5E7EB]">ประวัติการแก้ไข</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cut.edits.map((e) => (
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
              <DialogTitle>ลบรายการตัดเครดิต</DialogTitle>
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
                    const res = await fetch(`/api/credit-cuts/${id}`, {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ deleteReason: deleteReason.trim() }),
                    });
                    const data = (await res.json()) as { error?: string };
                    if (res.ok) {
                      router.replace('/credit-cuts');
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
              <DialogTitle>แก้ไขรายการตัดเครดิต</DialogTitle>
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
                  <Label>จำนวนที่ตัด ({cut.displayCurrency})</Label>
                  <Input
                    type="text"
                    value={
                      editForm.amountMinor !== undefined
                        ? formatMinorToDisplay(editForm.amountMinor, cut.displayCurrency)
                        : ''
                    }
                    onChange={(e) => {
                      const v = parseDisplayToMinor(
                        e.target.value,
                        cut.displayCurrency
                      );
                      setEditForm({ ...editForm, amountMinor: v });
                    }}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>หมายเหตุ (เหตุผลที่ตัด)</Label>
                  <Input
                    value={editForm.cutReason || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, cutReason: e.target.value })
                    }
                    placeholder="ระบุเหตุผลที่ตัดเครดิต"
                  />
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
