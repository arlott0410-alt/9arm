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
import { formatMinorToDisplay, parseDisplayToMinor } from '@/lib/utils';

type Wallet = { id: number; name: string; currency: string; balance?: number };

export default function WalletsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(
    null
  );
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [balances, setBalances] = useState<Map<number, number>>(new Map());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    currency: 'THB' as 'LAK' | 'THB' | 'USD',
    openingBalanceMinor: 0,
  });
  const [loading, setLoading] = useState(false);
  const canMutate = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) router.replace('/login');
        else setUser(d.user);
      });
  }, [router]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/wallets')
      .then((r) => r.json())
      .then((list: Wallet[]) => {
        setWallets(list);
        return Promise.all(
          list.map((w) =>
            fetch(`/api/wallets/${w.id}`)
              .then((r) => r.json())
              .then((d: { balance: number }) => ({ id: w.id, balance: d.balance }))
          )
        );
      })
      .then((results) => {
        const m = new Map<number, number>();
        results.forEach((r) => m.set(r.id, r.balance));
        setBalances(m);
      });
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canMutate) return;
    setLoading(true);
    try {
      const res = await fetch('/api/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          currency: form.currency,
          openingBalanceMinor: form.openingBalanceMinor,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setWallets((prev) => [...prev, created]);
        const balRes = await fetch(`/api/wallets/${created.id}`);
        const balData = await balRes.json();
        setBalances((prev) => new Map(prev).set(created.id, balData.balance));
        setForm({ name: '', currency: 'THB', openingBalanceMinor: 0 });
        setOpen(false);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[#E5E7EB]">กระเป๋าเงิน</h1>
          {canMutate && (
            <Button onClick={() => setOpen(true)}>เพิ่มกระเป๋าเงิน</Button>
          )}
        </div>

        <Card className="border-[#1F2937] bg-[#0F172A]">
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1F2937]">
                    <th className="py-3 text-left font-medium text-[#9CA3AF]">
                      ชื่อ
                    </th>
                    <th className="py-3 text-left font-medium text-[#9CA3AF]">
                      สกุลเงิน
                    </th>
                    <th className="py-3 text-right font-medium text-[#9CA3AF]">
                      ยอดคงเหลือ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.map((w) => (
                    <tr
                      key={w.id}
                      className="border-b border-[#1F2937] last:border-0"
                    >
                      <td className="py-3 text-[#E5E7EB]">{w.name}</td>
                      <td className="py-3 text-[#9CA3AF]">{w.currency}</td>
                      <td className="py-3 text-right font-medium text-[#D4AF37]">
                        {formatMinorToDisplay(
                          balances.get(w.id) ?? 0,
                          w.currency
                        )}
                      </td>
                    </tr>
                  ))}
                  {wallets.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-6 text-center text-[#9CA3AF]"
                      >
                        ไม่มีกระเป๋าเงิน
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่มกระเป๋าเงิน</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>ชื่อ</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>สกุลเงิน</Label>
                <Select
                  value={form.currency}
                  onValueChange={(v: 'LAK' | 'THB' | 'USD') =>
                    setForm({ ...form, currency: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LAK">LAK</SelectItem>
                    <SelectItem value="THB">THB</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ยอดเปิดตัว</Label>
                <Input
                  type="text"
                  placeholder="0"
                  value={
                    form.openingBalanceMinor
                      ? formatMinorToDisplay(
                          form.openingBalanceMinor,
                          form.currency
                        )
                      : ''
                  }
                  onChange={(e) => {
                    const v = parseDisplayToMinor(
                      e.target.value,
                      form.currency
                    );
                    setForm({ ...form, openingBalanceMinor: v });
                  }}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={loading}>
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
