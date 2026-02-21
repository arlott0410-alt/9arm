'use client';

export const runtime = 'edge';

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
import { formatMinorToDisplay, parseDisplayToMinor } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';

type TxnDetail = {
  id: number;
  txnDate: string;
  type: string;
  websiteId: number;
  websiteName: string;
  websitePrefix: string;
  userIdInput: string;
  userFull: string;
  walletId: number;
  walletName: string;
  walletCurrency: string;
  displayCurrency: string;
  amountMinor: number;
  depositSlipTime: string | null;
  depositSystemTime: string | null;
  withdrawInputAmountMinor: number | null;
  withdrawSystemTime: string | null;
  withdrawSlipTime: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUsername: string;
  edits: {
    id: number;
    editedByUsername: string;
    editReason: string;
    beforeSnapshot: Record<string, unknown>;
    afterSnapshot: Record<string, unknown>;
    editedAt: string;
  }[];
};

export default function TransactionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [user, setUser] = useState<{ username: string; role: string } | null>(
    null
  );
  const [txn, setTxn] = useState<TxnDetail | null>(null);
  const [websites, setWebsites] = useState<{ id: number; name: string; prefix: string }[]>([]);
  const [wallets, setWallets] = useState<{ id: number; name: string; currency: string }[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [editForm, setEditForm] = useState<Partial<{
    txnDate: string;
    websiteId: number;
    userIdInput: string;
    userFull: string;
    walletId: number;
    amountMinor: number;
    depositSlipTime: string;
    depositSystemTime: string;
    withdrawInputAmountMinor: number;
    withdrawSystemTime: string;
    withdrawSlipTime: string;
  }>>({});
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
    fetch(`/api/transactions/${id}`)
      .then((r) => r.json() as Promise<TxnDetail & { error?: string }>)
      .then((d) => {
        if (d.error) return;
        setTxn(d);
        setEditForm({
          txnDate: d.txnDate,
          websiteId: d.websiteId,
          userIdInput: d.userIdInput,
          userFull: d.userFull,
          walletId: d.walletId,
          amountMinor: d.amountMinor,
          depositSlipTime: d.depositSlipTime?.slice(-5) || '',
          depositSystemTime: d.depositSystemTime?.slice(-5) || '',
          withdrawInputAmountMinor: d.withdrawInputAmountMinor ?? d.amountMinor,
          withdrawSystemTime: d.withdrawSystemTime?.slice(-5) || '',
          withdrawSlipTime: d.withdrawSlipTime?.slice(-5) || '',
        });
      });
    Promise.all([
      fetch('/api/settings/websites').then((r) => r.json() as Promise<{ id: number; name: string; prefix: string }[]>),
      fetch('/api/wallets').then((r) => r.json() as Promise<{ id: number; name: string; currency: string }[]>),
    ]).then(([w, wal]) => {
      setWebsites(Array.isArray(w) ? w : []);
      setWallets(Array.isArray(wal) ? wal : []);
    });
  }, [user, id]);

  function openEdit() {
    if (!txn) return;
    setEditForm({
      txnDate: txn.txnDate,
      websiteId: txn.websiteId,
      userIdInput: txn.userIdInput,
      userFull: txn.userFull,
      walletId: txn.walletId,
      amountMinor: txn.amountMinor,
      depositSlipTime: txn.depositSlipTime?.slice(-5) || '',
      depositSystemTime: txn.depositSystemTime?.slice(-5) || '',
      withdrawInputAmountMinor: txn.withdrawInputAmountMinor ?? txn.amountMinor,
      withdrawSystemTime: txn.withdrawSystemTime?.slice(-5) || '',
      withdrawSlipTime: txn.withdrawSlipTime?.slice(-5) || '',
    });
    setEditReason('');
    setEditOpen(true);
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !editReason.trim()) return;
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { editReason: editReason.trim() };
      if (editForm.txnDate) payload.txnDate = editForm.txnDate;
      if (editForm.websiteId) payload.websiteId = editForm.websiteId;
      if (editForm.userIdInput) payload.userIdInput = editForm.userIdInput;
      if (editForm.userFull) payload.userFull = editForm.userFull;
      if (editForm.walletId) payload.walletId = editForm.walletId;
      if (editForm.amountMinor !== undefined) payload.amountMinor = editForm.amountMinor;
      if (editForm.depositSlipTime)
        payload.depositSlipTime = `${editForm.txnDate}T${editForm.depositSlipTime}`;
      if (editForm.depositSystemTime)
        payload.depositSystemTime = `${editForm.txnDate}T${editForm.depositSystemTime}`;
      if (editForm.withdrawInputAmountMinor !== undefined)
        payload.withdrawInputAmountMinor = editForm.withdrawInputAmountMinor;
      if (editForm.withdrawSystemTime)
        payload.withdrawSystemTime = `${editForm.txnDate}T${editForm.withdrawSystemTime}`;
      if (editForm.withdrawSlipTime)
        payload.withdrawSlipTime = `${editForm.txnDate}T${editForm.withdrawSlipTime}`;

      const res = await fetch(`/api/transactions/${id}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const d = (await fetch(`/api/transactions/${id}`).then((r) => r.json())) as TxnDetail;
        setTxn(d);
        setEditOpen(false);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!user || !txn) return null;

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <Link
          href="/transactions"
          className="inline-flex items-center gap-2 text-sm text-[#9CA3AF] hover:text-[#D4AF37]"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับไปธุรกรรม
        </Link>

        <Card className="border-[#1F2937] bg-[#0F172A]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[#E5E7EB]">
                ธุรกรรม #{txn.id} ({txn.type === 'DEPOSIT' ? 'ฝาก' : 'ถอน'})
              </CardTitle>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={openEdit}>
                  แก้ไข
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="text-sm text-[#9CA3AF]">วันที่</span>
                <p className="text-[#E5E7EB]">{txn.txnDate}</p>
              </div>
              <div>
                <span className="text-sm text-[#9CA3AF]">เว็บไซต์</span>
                <p className="text-[#E5E7EB]">{txn.websiteName}</p>
              </div>
              <div>
                <span className="text-sm text-[#9CA3AF]">ชื่อผู้ใช้เต็ม</span>
                <p className="text-[#E5E7EB]">{txn.userFull}</p>
              </div>
              <div>
                <span className="text-sm text-[#9CA3AF]">กระเป๋าเงิน</span>
                <p className="text-[#E5E7EB]">{txn.walletName} ({txn.walletCurrency})</p>
              </div>
              <div>
                <span className="text-sm text-[#9CA3AF]">จำนวน</span>
                <p className="text-[#D4AF37] font-medium">
                  {formatMinorToDisplay(txn.amountMinor, txn.walletCurrency)}{' '}
                  {txn.walletCurrency}
                </p>
              </div>
              <div>
                <span className="text-sm text-[#9CA3AF]">ผู้ดำเนินการ</span>
                <p className="text-[#E5E7EB]">{txn.createdByUsername}</p>
              </div>
              {txn.type === 'DEPOSIT' && (
                <>
                  <div>
                    <span className="text-sm text-[#9CA3AF]">เวลาสลิปฝาก</span>
                    <p className="text-[#E5E7EB]">{txn.depositSlipTime || '-'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-[#9CA3AF]">เวลาระบบฝาก</span>
                    <p className="text-[#E5E7EB]">{txn.depositSystemTime || '-'}</p>
                  </div>
                </>
              )}
              {txn.type === 'WITHDRAW' && (
                <>
                  <div>
                    <span className="text-sm text-[#9CA3AF]">เวลาระบบถอน</span>
                    <p className="text-[#E5E7EB]">{txn.withdrawSystemTime || '-'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-[#9CA3AF]">เวลาสลิปถอน</span>
                    <p className="text-[#E5E7EB]">{txn.withdrawSlipTime || '-'}</p>
                  </div>
                </>
              )}
              <div>
                <span className="text-sm text-[#9CA3AF]">สร้างเมื่อ</span>
                <p className="text-[#E5E7EB]">{txn.createdAt}</p>
              </div>
              <div>
                <span className="text-sm text-[#9CA3AF]">อัปเดตเมื่อ</span>
                <p className="text-[#E5E7EB]">{txn.updatedAt}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {txn.edits && txn.edits.length > 0 && (
          <Card className="border-[#1F2937] bg-[#0F172A]">
            <CardHeader>
              <CardTitle className="text-[#E5E7EB]">ประวัติการแก้ไข</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {txn.edits.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-lg border border-[#1F2937] bg-[#111827] p-4"
                  >
                    <div className="flex justify-between text-sm text-[#9CA3AF]">
                      <span>{e.editedByUsername}</span>
                      <span>{e.editedAt}</span>
                    </div>
                    <p className="mt-2 text-[#E5E7EB]">{e.editReason}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>แก้ไขธุรกรรม</DialogTitle>
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
                  <Label>วันที่</Label>
                  <Input
                    type="date"
                    value={editForm.txnDate || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, txnDate: e.target.value })
                    }
                  />
                </div>
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
                    value={editForm.userFull || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, userFull: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>กระเป๋าเงิน</Label>
                  <Select
                    value={editForm.walletId ? String(editForm.walletId) : ''}
                    onValueChange={(v) =>
                      setEditForm({ ...editForm, walletId: parseInt(v) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {wallets.map((w) => (
                        <SelectItem key={w.id} value={String(w.id)}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {txn.type === 'DEPOSIT' ? (
                  <>
                    <div>
                      <Label>จำนวน</Label>
                      <Input
                        type="text"
                        value={
                          editForm.amountMinor !== undefined
                            ? formatMinorToDisplay(
                                editForm.amountMinor,
                                txn.walletCurrency
                              )
                            : ''
                        }
                        onChange={(e) => {
                          const v = parseDisplayToMinor(
                            e.target.value,
                            txn.walletCurrency
                          );
                          setEditForm({ ...editForm, amountMinor: v });
                        }}
                      />
                    </div>
                    <div>
                      <Label>เวลาสลิปฝาก</Label>
                      <Input
                        type="time"
                        value={editForm.depositSlipTime || ''}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            depositSlipTime: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>เวลาระบบฝาก</Label>
                      <Input
                        type="time"
                        value={editForm.depositSystemTime || ''}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            depositSystemTime: e.target.value,
                          })
                        }
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label>จำนวนถอน (สกุลเงินแสดงผล)</Label>
                      <Input
                        type="text"
                        value={
                          editForm.withdrawInputAmountMinor !== undefined
                            ? formatMinorToDisplay(
                                editForm.withdrawInputAmountMinor,
                                txn.displayCurrency
                              )
                            : ''
                        }
                        onChange={(e) => {
                          const v = parseDisplayToMinor(
                            e.target.value,
                            txn.displayCurrency
                          );
                          setEditForm({
                            ...editForm,
                            withdrawInputAmountMinor: v,
                          });
                        }}
                      />
                    </div>
                    <div>
                      <Label>เวลาระบบถอน</Label>
                      <Input
                        type="time"
                        value={editForm.withdrawSystemTime || ''}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            withdrawSystemTime: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>เวลาสลิปถอน</Label>
                      <Input
                        type="time"
                        value={editForm.withdrawSlipTime || ''}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            withdrawSlipTime: e.target.value,
                          })
                        }
                      />
                    </div>
                  </>
                )}
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
