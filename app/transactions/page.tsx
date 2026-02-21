'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatMinorToDisplay, parseDisplayToMinor, todayStr } from '@/lib/utils';
import { Copy } from 'lucide-react';

type Website = { id: number; name: string; prefix: string };
type Wallet = { id: number; name: string; currency: string };
type Txn = {
  id: number;
  txnDate: string;
  type: string;
  userFull: string;
  websiteName: string;
  walletName: string;
  walletCurrency: string;
  amountMinor: number;
  depositSlipTime: string | null;
  withdrawSlipTime: string | null;
  createdByUsername: string;
  displayCurrency: string;
};

export default function TransactionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [settings, setSettings] = useState<{
    displayCurrency: string;
    rates: Record<string, number>;
  } | null>(null);
  const [deposits, setDeposits] = useState<Txn[]>([]);
  const [withdraws, setWithdraws] = useState<Txn[]>([]);
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [filterWebsite, setFilterWebsite] = useState('__all__');
  const [filterUserFull, setFilterUserFull] = useState('');
  const [filterEdited, setFilterEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [depositForm, setDepositForm] = useState({
    txnDate: todayStr(),
    websiteId: 0,
    userIdInput: '',
    walletId: 0,
    amountMinor: 0,
    depositSlipTime: '00:00',
    depositSystemTime: '00:00',
  });
  const [withdrawForm, setWithdrawForm] = useState({
    txnDate: todayStr(),
    websiteId: 0,
    userIdInput: '',
    walletId: 0,
    withdrawInputAmountMinor: 0,
    withdrawSystemTime: '00:00',
    withdrawSlipTime: '00:00',
  });
  const canMutate = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const loadData = useCallback(async () => {
    const [wRes, walRes, setRes] = await Promise.all([
      fetch('/api/settings/websites'),
      fetch('/api/wallets'),
      fetch('/api/settings').then((r) => r.json() as Promise<{ DISPLAY_CURRENCY?: string; EXCHANGE_RATES?: Record<string, number> }>),
    ]);
    const wData = (await wRes.json()) as Website[];
    const walData = (await walRes.json()) as Wallet[];
    if (Array.isArray(wData)) setWebsites(wData);
    if (Array.isArray(walData)) setWallets(walData);
    if (setRes.DISPLAY_CURRENCY)
      setSettings({
        displayCurrency: setRes.DISPLAY_CURRENCY,
        rates: setRes.EXCHANGE_RATES || {},
      });
  }, []);

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
    loadData();
  }, [user, loadData]);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams({
      dateFrom,
      dateTo,
      ...(filterWebsite && filterWebsite !== '__all__' && { websiteId: filterWebsite }),
      ...(filterUserFull && { userFull: filterUserFull }),
      ...(filterEdited && { editedOnly: 'true' }),
    });
    fetch(`/api/transactions?${params}`)
      .then((r) => r.json() as Promise<Txn[]>)
      .then((list) => {
        setDeposits(list.filter((t) => t.type === 'DEPOSIT').sort((a, b) => (a.depositSlipTime || '').localeCompare(b.depositSlipTime || '')));
        setWithdraws(list.filter((t) => t.type === 'WITHDRAW').sort((a, b) => (a.withdrawSlipTime || '').localeCompare(b.withdrawSlipTime || '')));
      });
  }, [user, dateFrom, dateTo, filterWebsite, filterUserFull, filterEdited]);

  function getSelectedWebsite() {
    const id = depositForm.websiteId || withdrawForm.websiteId;
    return websites.find((w) => w.id === id);
  }

  function getUserFull() {
    const w = getSelectedWebsite();
    const input = depositForm.userIdInput || withdrawForm.userIdInput;
    return w ? `${w.prefix}${input}` : input || '';
  }

  function copyUserFull() {
    const full = getUserFull();
    if (full) navigator.clipboard.writeText(full);
  }

  function convertDepositToDisplay(amountMinor: number, walletCurrency: string): number {
    if (!settings?.rates) return amountMinor;
    const key = `${walletCurrency}_${settings.displayCurrency}`;
    const rate = settings.rates[key];
    if (typeof rate !== 'number') return amountMinor;
    const fromMajor = walletCurrency === 'LAK' ? amountMinor : amountMinor / 100;
    const toMajor = fromMajor * rate;
    return settings.displayCurrency === 'LAK' ? Math.round(toMajor) : Math.round(toMajor * 100);
  }

  function convertWithdrawFromDisplay(
    displayMinor: number,
    walletCurrency: string
  ): number {
    if (!settings?.rates) return displayMinor;
    const key = `${settings.displayCurrency}_${walletCurrency}`;
    const rate = settings.rates[key];
    if (typeof rate !== 'number') return displayMinor;
    const fromMajor = settings.displayCurrency === 'LAK' ? displayMinor : displayMinor / 100;
    const toMajor = fromMajor * rate;
    return walletCurrency === 'LAK' ? Math.round(toMajor) : Math.round(toMajor * 100);
  }

  async function submitDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!canMutate) return;
    setLoading(true);
    const w = getSelectedWebsite();
    const userFull = getUserFull();
    const body = {
      type: 'DEPOSIT',
      txnDate: depositForm.txnDate,
      websiteId: depositForm.websiteId,
      userIdInput: depositForm.userIdInput,
      userFull,
      walletId: depositForm.walletId,
      amountMinor: depositForm.amountMinor,
      depositSlipTime: `${depositForm.txnDate}T${depositForm.depositSlipTime}`,
      depositSystemTime: `${depositForm.txnDate}T${depositForm.depositSystemTime}`,
    };
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setDepositForm({ ...depositForm, amountMinor: 0, userIdInput: '' });
        const params = new URLSearchParams({ dateFrom, dateTo });
        const list = (await fetch(`/api/transactions?${params}`).then((r) => r.json())) as Txn[];
        setDeposits(list.filter((t) => t.type === 'DEPOSIT'));
        setWithdraws(list.filter((t) => t.type === 'WITHDRAW'));
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitWithdraw(e: React.FormEvent) {
    e.preventDefault();
    if (!canMutate) return;
    setLoading(true);
    const w = getSelectedWebsite();
    const userFull = getUserFull();
    const body = {
      type: 'WITHDRAW',
      txnDate: withdrawForm.txnDate,
      websiteId: withdrawForm.websiteId,
      userIdInput: withdrawForm.userIdInput,
      userFull,
      walletId: withdrawForm.walletId,
      withdrawInputAmountMinor: withdrawForm.withdrawInputAmountMinor,
      withdrawSystemTime: `${withdrawForm.txnDate}T${withdrawForm.withdrawSystemTime}`,
      withdrawSlipTime: `${withdrawForm.txnDate}T${withdrawForm.withdrawSlipTime}`,
    };
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setWithdrawForm({ ...withdrawForm, withdrawInputAmountMinor: 0, userIdInput: '' });
        const params = new URLSearchParams({ dateFrom, dateTo });
        const list = (await fetch(`/api/transactions?${params}`).then((r) => r.json())) as Txn[];
        setDeposits(list.filter((t) => t.type === 'DEPOSIT'));
        setWithdraws(list.filter((t) => t.type === 'WITHDRAW'));
      }
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    const params = new URLSearchParams({
      dateFrom,
      dateTo,
      ...(filterWebsite && filterWebsite !== '__all__' && { websiteId: filterWebsite }),
      ...(filterUserFull && { userFull: filterUserFull }),
      ...(filterEdited && { editedOnly: 'true' }),
    });
    window.open(`/api/transactions/export?${params}`, '_blank');
  }

  if (!user) return null;

  const dispCur = settings?.displayCurrency || 'THB';
  const depositWallet = wallets.find((w) => w.id === depositForm.walletId);
  const withdrawWallet = wallets.find((w) => w.id === withdrawForm.walletId);

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[#E5E7EB]">ธุรกรรม</h1>

        {canMutate && (
          <Card className="border-[#1F2937] bg-[#0F172A]">
            <CardHeader>
              <CardTitle className="text-[#E5E7EB]">สร้างธุรกรรม</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="deposit" className="w-full">
                <TabsList>
                  <TabsTrigger value="deposit">ฝาก</TabsTrigger>
                  <TabsTrigger value="withdraw">ถอน</TabsTrigger>
                </TabsList>
                <TabsContent value="deposit">
                  <form onSubmit={submitDeposit} className="mt-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label>วันที่</Label>
                        <Input
                          type="date"
                          value={depositForm.txnDate}
                          onChange={(e) =>
                            setDepositForm({
                              ...depositForm,
                              txnDate: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label>เว็บไซต์</Label>
                        <Select
                          value={depositForm.websiteId ? String(depositForm.websiteId) : ''}
                          onValueChange={(v) =>
                            setDepositForm({
                              ...depositForm,
                              websiteId: parseInt(v),
                            })
                          }
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
                          value={depositForm.userIdInput}
                          onChange={(e) =>
                            setDepositForm({
                              ...depositForm,
                              userIdInput: e.target.value,
                            })
                          }
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
                        <Label>กระเป๋าเงิน</Label>
                        <Select
                          value={depositForm.walletId ? String(depositForm.walletId) : ''}
                          onValueChange={(v) =>
                            setDepositForm({
                              ...depositForm,
                              walletId: parseInt(v),
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="เลือก" />
                          </SelectTrigger>
                          <SelectContent>
                            {wallets.map((w) => (
                              <SelectItem key={w.id} value={String(w.id)}>
                                {w.name} ({w.currency})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>จำนวน (สกุลเงินกระเป๋า)</Label>
                        <Input
                          type="text"
                          placeholder="0"
                          value={
                            depositForm.amountMinor
                              ? formatMinorToDisplay(
                                  depositForm.amountMinor,
                                  depositWallet?.currency || 'THB'
                                )
                              : ''
                          }
                          onChange={(e) => {
                            const v = parseDisplayToMinor(
                              e.target.value,
                              depositWallet?.currency || 'THB'
                            );
                            setDepositForm({ ...depositForm, amountMinor: v });
                          }}
                          required
                        />
                      </div>
                      <div>
                        <Label>แปลงเป็น ({dispCur})</Label>
                        <Input
                          readOnly
                          value={
                            depositWallet && depositForm.amountMinor
                              ? formatMinorToDisplay(
                                  convertDepositToDisplay(
                                    depositForm.amountMinor,
                                    depositWallet.currency
                                  ),
                                  dispCur
                                )
                              : '-'
                          }
                          className="bg-[#111827]"
                        />
                      </div>
                      <div>
                        <Label>เวลาสลิปฝาก</Label>
                        <Input
                          type="time"
                          value={depositForm.depositSlipTime}
                          onChange={(e) =>
                            setDepositForm({
                              ...depositForm,
                              depositSlipTime: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label>เวลาระบบฝาก</Label>
                        <Input
                          type="time"
                          value={depositForm.depositSystemTime}
                          onChange={(e) =>
                            setDepositForm({
                              ...depositForm,
                              depositSystemTime: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    </div>
                    <Button type="submit" disabled={loading}>
                      บันทึก
                    </Button>
                  </form>
                </TabsContent>
                <TabsContent value="withdraw">
                  <form onSubmit={submitWithdraw} className="mt-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label>วันที่</Label>
                        <Input
                          type="date"
                          value={withdrawForm.txnDate}
                          onChange={(e) =>
                            setWithdrawForm({
                              ...withdrawForm,
                              txnDate: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label>เว็บไซต์</Label>
                        <Select
                          value={withdrawForm.websiteId ? String(withdrawForm.websiteId) : ''}
                          onValueChange={(v) =>
                            setWithdrawForm({
                              ...withdrawForm,
                              websiteId: parseInt(v),
                            })
                          }
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
                          value={withdrawForm.userIdInput}
                          onChange={(e) =>
                            setWithdrawForm({
                              ...withdrawForm,
                              userIdInput: e.target.value,
                            })
                          }
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
                        <Label>จำนวนถอน ({dispCur})</Label>
                        <Input
                          type="text"
                          placeholder="0"
                          value={
                            withdrawForm.withdrawInputAmountMinor
                              ? formatMinorToDisplay(
                                  withdrawForm.withdrawInputAmountMinor,
                                  dispCur
                                )
                              : ''
                          }
                          onChange={(e) => {
                            const v = parseDisplayToMinor(e.target.value, dispCur);
                            setWithdrawForm({
                              ...withdrawForm,
                              withdrawInputAmountMinor: v,
                            });
                          }}
                          required
                        />
                      </div>
                      <div>
                        <Label>กระเป๋าเงิน</Label>
                        <Select
                          value={withdrawForm.walletId ? String(withdrawForm.walletId) : ''}
                          onValueChange={(v) =>
                            setWithdrawForm({
                              ...withdrawForm,
                              walletId: parseInt(v),
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="เลือก" />
                          </SelectTrigger>
                          <SelectContent>
                            {wallets.map((w) => (
                              <SelectItem key={w.id} value={String(w.id)}>
                                {w.name} ({w.currency})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>จำนวนถอนจริง (สกุลเงินกระเป๋า)</Label>
                        <Input
                          readOnly
                          value={
                            withdrawWallet && withdrawForm.withdrawInputAmountMinor
                              ? formatMinorToDisplay(
                                  convertWithdrawFromDisplay(
                                    withdrawForm.withdrawInputAmountMinor,
                                    withdrawWallet.currency
                                  ),
                                  withdrawWallet.currency
                                )
                              : '-'
                          }
                          className="bg-[#111827]"
                        />
                      </div>
                      <div>
                        <Label>เวลาระบบถอน</Label>
                        <Input
                          type="time"
                          value={withdrawForm.withdrawSystemTime}
                          onChange={(e) =>
                            setWithdrawForm({
                              ...withdrawForm,
                              withdrawSystemTime: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label>เวลาสลิปถอน</Label>
                        <Input
                          type="time"
                          value={withdrawForm.withdrawSlipTime}
                          onChange={(e) =>
                            setWithdrawForm({
                              ...withdrawForm,
                              withdrawSlipTime: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    </div>
                    <Button type="submit" disabled={loading}>
                      บันทึก
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        <Card className="border-[#1F2937] bg-[#0F172A]">
            <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <CardTitle className="text-[#E5E7EB]">รายการธุรกรรม</CardTitle>
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
                <Input
                  placeholder="ชื่อผู้ใช้เต็ม"
                  value={filterUserFull}
                  onChange={(e) => setFilterUserFull(e.target.value)}
                  className="w-40"
                />
                <label className="flex items-center gap-2 text-sm text-[#9CA3AF]">
                  <input
                    type="checkbox"
                    checked={filterEdited}
                    onChange={(e) => setFilterEdited(e.target.checked)}
                  />
                  แก้ไขแล้วเท่านั้น
                </label>
                <Button variant="outline" size="sm" onClick={exportCsv}>
                  ส่งออก CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="deposits">
              <TabsList>
                <TabsTrigger value="deposits">ฝาก</TabsTrigger>
                <TabsTrigger value="withdraws">ถอน</TabsTrigger>
              </TabsList>
              <TabsContent value="deposits">
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1F2937]">
                        <th className="py-2 text-left text-[#9CA3AF]">วันที่</th>
                        <th className="py-2 text-left text-[#9CA3AF]">ผู้ใช้</th>
                        <th className="py-2 text-left text-[#9CA3AF]">เว็บไซต์</th>
                        <th className="py-2 text-left text-[#9CA3AF]">กระเป๋า</th>
                        <th className="py-2 text-right text-[#9CA3AF]">จำนวน</th>
                        <th className="py-2 text-left text-[#9CA3AF]">เวลาสลิป</th>
                        <th className="py-2 text-left text-[#9CA3AF]">ผู้ดำเนินการ</th>
                        <th className="py-2 text-left text-[#9CA3AF]">ดำเนินการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deposits.map((t) => (
                        <tr key={t.id} className="border-b border-[#1F2937]">
                          <td className="py-2">{t.txnDate}</td>
                          <td className="py-2">{t.userFull}</td>
                          <td className="py-2">{t.websiteName}</td>
                          <td className="py-2">{t.walletName}</td>
                          <td className="py-2 text-right text-[#D4AF37]">
                            {formatMinorToDisplay(t.amountMinor, t.walletCurrency)}
                          </td>
                          <td className="py-2">{t.depositSlipTime || '-'}</td>
                          <td className="py-2">{t.createdByUsername}</td>
                          <td className="py-2">
                            <Link
                              href={`/transactions/${t.id}`}
                              className="text-[#D4AF37] hover:underline"
                            >
                              ดู
                            </Link>
                          </td>
                        </tr>
                      ))}
                      {deposits.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-[#9CA3AF]">
                            ไม่มีรายการฝาก
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
              <TabsContent value="withdraws">
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1F2937]">
                        <th className="py-2 text-left text-[#9CA3AF]">วันที่</th>
                        <th className="py-2 text-left text-[#9CA3AF]">ผู้ใช้</th>
                        <th className="py-2 text-left text-[#9CA3AF]">เว็บไซต์</th>
                        <th className="py-2 text-left text-[#9CA3AF]">กระเป๋า</th>
                        <th className="py-2 text-right text-[#9CA3AF]">จำนวน</th>
                        <th className="py-2 text-left text-[#9CA3AF]">เวลาสลิป</th>
                        <th className="py-2 text-left text-[#9CA3AF]">ผู้ดำเนินการ</th>
                        <th className="py-2 text-left text-[#9CA3AF]">ดำเนินการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {withdraws.map((t) => (
                        <tr key={t.id} className="border-b border-[#1F2937]">
                          <td className="py-2">{t.txnDate}</td>
                          <td className="py-2">{t.userFull}</td>
                          <td className="py-2">{t.websiteName}</td>
                          <td className="py-2">{t.walletName}</td>
                          <td className="py-2 text-right text-[#D4AF37]">
                            {formatMinorToDisplay(t.amountMinor, t.walletCurrency)}
                          </td>
                          <td className="py-2">{t.withdrawSlipTime || '-'}</td>
                          <td className="py-2">{t.createdByUsername}</td>
                          <td className="py-2">
                            <Link
                              href={`/transactions/${t.id}`}
                              className="text-[#D4AF37] hover:underline"
                            >
                              ดู
                            </Link>
                          </td>
                        </tr>
                      ))}
                      {withdraws.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-[#9CA3AF]">
                            ไม่มีรายการถอน
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
