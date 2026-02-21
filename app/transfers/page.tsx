'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  formatMinorToDisplay,
  parseDisplayToMinor,
  todayStr,
} from '@/lib/utils';
import { TimeInput24 } from '@/components/ui/time-input-24';
import { safeJson } from '@/lib/fetch-json';
import {
  convertBetween,
  type Currency,
} from '@/lib/rates';

type Wallet = { id: number; name: string; currency: string };
type Transfer = {
  id: number;
  txnDate: string;
  txnTime: string | null;
  type: string;
  fromWalletName: string | null;
  toWalletName: string | null;
  inputAmountMinor: number;
  fromWalletAmountMinor: number | null;
  toWalletAmountMinor: number | null;
  note: string | null;
  createdByUsername: string;
  displayCurrency: string;
};

export default function TransfersPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(
    null
  );
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [settings, setSettings] = useState<{
    displayCurrency: string;
    rates: Record<string, number>;
  } | null>(null);
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    txnDate: todayStr(),
    txnTime: '00:00',
    type: 'INTERNAL' as 'INTERNAL' | 'EXTERNAL_OUT' | 'EXTERNAL_IN',
    fromWalletId: 0 as number | null,
    toWalletId: 0 as number | null,
    inputAmountMinor: 0,
    note: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balances, setBalances] = useState<Map<number, number>>(new Map());
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
      fetch('/api/wallets').then((r) => r.json() as Promise<Wallet[]>),
      fetch('/api/settings').then(
        (r) =>
          r.json() as Promise<{
            DISPLAY_CURRENCY?: string;
            EXCHANGE_RATES?: Record<string, number>;
          }>
      ),
    ]).then(async ([wal, set]) => {
      setWallets(Array.isArray(wal) ? wal : []);
      setSettings({
        displayCurrency: set.DISPLAY_CURRENCY || 'THB',
        rates: set.EXCHANGE_RATES || {},
      });
      const list = Array.isArray(wal) ? wal : [];
      const results = await Promise.all(
        list.map((w) =>
          fetch(`/api/wallets/${w.id}`)
            .then((r) => r.json() as Promise<{ balance?: number }>)
            .then((d) => ({ id: w.id, balance: typeof d?.balance === 'number' ? d.balance : 0 }))
            .catch(() => ({ id: w.id, balance: 0 }))
        )
      );
      const m = new Map<number, number>();
      results.forEach((r) => m.set(r.id, r.balance));
      setBalances(m);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams({ dateFrom, dateTo });
    fetch(`/api/transfers?${params}`)
      .then((r) => r.json() as Promise<Transfer[]>)
      .then(setTransfers);
  }, [user, dateFrom, dateTo]);

  const sameWallet =
    form.type === 'INTERNAL' &&
    form.fromWalletId &&
    form.toWalletId &&
    form.fromWalletId === form.toWalletId;
  const fromBalance = form.fromWalletId
    ? balances.get(form.fromWalletId) ?? 0
    : 0;
  const insufficientBalance =
    (form.type === 'INTERNAL' || form.type === 'EXTERNAL_OUT') &&
    form.fromWalletId &&
    form.inputAmountMinor > 0 &&
    fromBalance < form.inputAmountMinor;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canMutate) return;
    if (sameWallet) {
      setError('ไม่สามารถโอนไปยังกระเป๋าเดียวกันได้');
      return;
    }
    if (insufficientBalance) {
      setError('ยอดเงินคงเหลือไม่เพียงพอ');
      return;
    }
    if (form.inputAmountMinor <= 0) {
      setError('กรุณาระบุจำนวนที่มากกว่า 0');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txnDate: form.txnDate,
          txnTime: form.txnTime || undefined,
          type: form.type,
          fromWalletId: form.type === 'EXTERNAL_IN' ? null : form.fromWalletId,
          toWalletId: form.type === 'EXTERNAL_OUT' ? null : form.toWalletId,
          inputAmountMinor: form.inputAmountMinor,
          note: form.note || undefined,
        }),
      });
      const data = (await safeJson(res)) as { error?: string };
      if (res.ok) {
        setForm({
          txnDate: todayStr(),
          txnTime: '00:00',
          type: 'INTERNAL',
          fromWalletId: null,
          toWalletId: null,
          inputAmountMinor: 0,
          note: '',
        });
        setOpen(false);
        const params = new URLSearchParams({ dateFrom, dateTo });
        const list = (await fetch(`/api/transfers?${params}`).then((r) => r.json())) as Transfer[];
        setTransfers(list);
        setError(null);
      } else {
        setError(typeof data.error === 'string' ? data.error : 'เกิดข้อผิดพลาด');
      }
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    const params = new URLSearchParams({ dateFrom, dateTo });
    window.open(`/api/transfers/export?${params}`, '_blank');
  }

  const dispCur = (settings?.displayCurrency || 'THB') as Currency;
  const rates = settings?.rates || {};
  const fromWallet =
    form.type !== 'EXTERNAL_IN' && form.fromWalletId
      ? wallets.find((w) => w.id === form.fromWalletId)
      : null;
  const toWallet =
    form.type !== 'EXTERNAL_OUT' && form.toWalletId
      ? wallets.find((w) => w.id === form.toWalletId)
      : null;
  const inputCurrency: Currency =
    form.type === 'EXTERNAL_IN'
      ? (toWallet?.currency as Currency) || 'THB'
      : (fromWallet?.currency as Currency) || 'THB';
  const toAmountMinor =
    form.type === 'INTERNAL' &&
    fromWallet &&
    toWallet &&
    fromWallet.currency !== toWallet.currency &&
    form.inputAmountMinor
      ? convertBetween(
          form.inputAmountMinor,
          fromWallet.currency as Currency,
          toWallet.currency as Currency,
          rates
        )
      : form.inputAmountMinor;

  if (!user) return null;

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-[#E5E7EB]">โอนเงิน</h1>
          <div className="flex gap-2">
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
            {canMutate && (
              <Button onClick={() => setOpen(true)}>โอนเงินใหม่</Button>
            )}
            <Button variant="outline" onClick={exportCsv}>
              ส่งออก CSV
            </Button>
          </div>
        </div>

        <Card className="border-[#1F2937] bg-[#0F172A]">
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1F2937]">
                    <th className="py-3 text-left font-medium text-[#9CA3AF]">
                      วันที่ / เวลา
                    </th>
                    <th className="py-3 text-left font-medium text-[#9CA3AF]">
                      ประเภท
                    </th>
                    <th className="py-3 text-left font-medium text-[#9CA3AF]">
                      จาก
                    </th>
                    <th className="py-3 text-left font-medium text-[#9CA3AF]">
                      ไปยัง
                    </th>
                    <th className="py-3 text-right font-medium text-[#9CA3AF]">
                      จำนวน
                    </th>
                    <th className="py-3 text-left font-medium text-[#9CA3AF]">
                      หมายเหตุ
                    </th>
                    <th className="py-3 text-left font-medium text-[#9CA3AF]">
                      โดย
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-[#1F2937] last:border-0"
                    >
                      <td className="py-3 text-[#E5E7EB]">
                        {t.txnDate}
                        {t.txnTime && (
                          <span className="ml-2 text-[#9CA3AF]">{t.txnTime}</span>
                        )}
                      </td>
                      <td className="py-3 text-[#9CA3AF]">{t.type}</td>
                      <td className="py-3 text-[#E5E7EB]">
                        {t.fromWalletName || '-'}
                      </td>
                      <td className="py-3 text-[#E5E7EB]">
                        {t.toWalletName || '-'}
                      </td>
                      <td className="py-3 text-right font-medium text-[#D4AF37]">
                        {formatMinorToDisplay(t.inputAmountMinor, dispCur)}
                      </td>
                      <td className="py-3 text-[#9CA3AF]">
                        {t.note || '-'}
                      </td>
                      <td className="py-3 text-[#9CA3AF]">
                        {t.createdByUsername}
                      </td>
                    </tr>
                  ))}
                  {transfers.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-6 text-center text-[#9CA3AF]"
                      >
                        ไม่มีรายการโอนเงิน
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>โอนเงินใหม่</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded bg-red-500/20 px-4 py-2 text-sm text-red-400">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>วันที่</Label>
                  <Input
                    type="date"
                    value={form.txnDate}
                    onChange={(e) =>
                      setForm({ ...form, txnDate: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>เวลา</Label>
                  <TimeInput24
                    value={form.txnTime}
                    onChange={(v) => setForm({ ...form, txnTime: v })}
                  />
                </div>
              </div>
              <div>
                <Label>ประเภท</Label>
                <Select
                  value={form.type}
                  onValueChange={(
                    v: 'INTERNAL' | 'EXTERNAL_OUT' | 'EXTERNAL_IN'
                  ) =>
                    setForm({
                      ...form,
                      type: v,
                      fromWalletId: v === 'EXTERNAL_IN' ? null : form.fromWalletId,
                      toWalletId: v === 'EXTERNAL_OUT' ? null : form.toWalletId,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INTERNAL">ภายใน</SelectItem>
                    <SelectItem value="EXTERNAL_OUT">โอนออกภายนอก</SelectItem>
                    <SelectItem value="EXTERNAL_IN">โอนเข้ามาภายนอก</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.type !== 'EXTERNAL_IN' && (
                <div>
                  <Label>จากกระเป๋า</Label>
                  <Select
                    value={form.fromWalletId ? String(form.fromWalletId) : ''}
                    onValueChange={(v) => {
                      const fid = v ? parseInt(v) : null;
                      setForm({
                        ...form,
                        fromWalletId: fid,
                        toWalletId:
                          form.toWalletId === fid ? null : form.toWalletId,
                      });
                    }}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือก" />
                    </SelectTrigger>
                    <SelectContent>
                      {wallets.map((w) => (
                        <SelectItem key={w.id} value={String(w.id)}>
                          {w.name} ({w.currency}) — ยอดคงเหลือ:{' '}
                          {formatMinorToDisplay(balances.get(w.id) ?? 0, w.currency)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.type !== 'EXTERNAL_OUT' && (
                <div>
                  <Label>ไปยังกระเป๋า</Label>
                  <Select
                    value={form.toWalletId ? String(form.toWalletId) : ''}
                    onValueChange={(v) =>
                      setForm({ ...form, toWalletId: v ? parseInt(v) : null })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือก" />
                    </SelectTrigger>
                    <SelectContent>
                      {wallets
                        .filter((w) =>
                          form.type !== 'INTERNAL' ||
                          !form.fromWalletId ||
                          w.id !== form.fromWalletId
                        )
                        .map((w) => (
                          <SelectItem key={w.id} value={String(w.id)}>
                            {w.name} ({w.currency}) — ยอดคงเหลือ:{' '}
                            {formatMinorToDisplay(balances.get(w.id) ?? 0, w.currency)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {form.type === 'INTERNAL' &&
                    wallets.filter(
                      (w) =>
                        !form.fromWalletId || w.id !== form.fromWalletId
                    ).length === 0 && (
                      <p className="mt-1 text-sm text-[#9CA3AF]">
                        ต้องมีอย่างน้อย 2 กระเป๋าในการโอนภายใน
                      </p>
                    )}
                  {form.type === 'INTERNAL' && sameWallet && (
                    <p className="mt-1 text-sm text-red-400">
                      ไม่สามารถโอนไปยังกระเป๋าเดียวกันได้
                    </p>
                  )}
                </div>
              )}
              <div>
                <Label>จำนวน ({inputCurrency})</Label>
                <Input
                  type="text"
                  placeholder="0"
                  value={
                    form.inputAmountMinor
                      ? formatMinorToDisplay(
                          form.inputAmountMinor,
                          inputCurrency
                        )
                      : ''
                  }
                  onChange={(e) => {
                    const v = parseDisplayToMinor(e.target.value, inputCurrency);
                    setForm({ ...form, inputAmountMinor: v });
                  }}
                  required
                />
                {form.type === 'INTERNAL' &&
                  fromWallet &&
                  toWallet &&
                  fromWallet.currency !== toWallet.currency &&
                  form.inputAmountMinor > 0 && (
                    <p className="mt-1 text-xs text-[#9CA3AF]">
                      ≈ {formatMinorToDisplay(toAmountMinor, toWallet.currency)}{' '}
                      {toWallet.currency} (ตามอัตราแลกเปลี่ยนที่ตั้งไว้)
                    </p>
                  )}
                {insufficientBalance && fromWallet && (
                  <p className="mt-1 text-sm text-red-400">
                    ยอดคงเหลือในกระเป๋า {fromWallet.name} ไม่เพียงพอ
                    (คงเหลือ:{' '}
                    {formatMinorToDisplay(fromBalance, fromWallet.currency)})
                  </p>
                )}
              </div>
              <div>
                <Label>หมายเหตุ</Label>
                <Input
                  value={form.note}
                  onChange={(e) =>
                    setForm({ ...form, note: e.target.value })
                  }
                  placeholder="ไม่บังคับ"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  disabled={
                    loading ||
                    sameWallet ||
                    insufficientBalance ||
                    form.inputAmountMinor <= 0
                  }
                >
                  สร้าง
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
