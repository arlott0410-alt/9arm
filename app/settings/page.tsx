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
import { getAllRateKeys } from '@/lib/rates';

type Website = { id: number; name: string; prefix: string };
type AppUser = {
  id: number;
  username: string;
  role: string;
  isActive: boolean;
};

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(
    null
  );
  const [websites, setWebsites] = useState<Website[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState('THB');
  const [rates, setRates] = useState<Record<string, number>>({});
  const [websiteOpen, setWebsiteOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [websiteForm, setWebsiteForm] = useState({ name: '', prefix: '' });
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    role: 'ADMIN' as 'ADMIN' | 'AUDIT',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) {
          router.replace('/login');
          return;
        }
        if (d.user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        setUser(d.user);
      });
  }, [router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch('/api/settings/websites').then((r) => r.json()),
      fetch('/api/settings/users').then((r) => r.json()),
      fetch('/api/settings').then((r) => r.json()),
      fetch('/api/settings/exchange-rates').then((r) => r.json()),
    ]).then(([w, u, s, r]) => {
      setWebsites(Array.isArray(w) ? w : []);
      setUsers(Array.isArray(u) ? u : []);
      setDisplayCurrency(s.DISPLAY_CURRENCY || 'THB');
      setRates(r.rates || {});
    });
  }, [user]);

  async function saveDisplayCurrency() {
    setLoading(true);
    try {
      await fetch('/api/settings/display-currency', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayCurrency }),
      });
    } finally {
      setLoading(false);
    }
  }

  async function saveRates() {
    setLoading(true);
    try {
      await fetch('/api/settings/exchange-rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rates }),
      });
    } finally {
      setLoading(false);
    }
  }

  async function addWebsite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/settings/websites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(websiteForm),
      });
      if (res.ok) {
        const created = await res.json();
        setWebsites((prev) => [...prev, created]);
        setWebsiteForm({ name: '', prefix: '' });
        setWebsiteOpen(false);
      }
    } finally {
      setLoading(false);
    }
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/settings/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      });
      if (res.ok) {
        const created = await res.json();
        setUsers((prev) => [...prev, created]);
        setUserForm({ username: '', password: '', role: 'ADMIN' });
        setUserOpen(false);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  const rateKeys = getAllRateKeys();

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[#E5E7EB]">ตั้งค่า</h1>

        <Card className="border-[#1F2937] bg-[#0F172A]">
          <CardHeader>
            <CardTitle className="text-[#E5E7EB]">สกุลเงินแสดงผล</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end gap-4">
            <div className="w-40">
              <Label>สกุลเงิน</Label>
              <Select
                value={displayCurrency}
                onValueChange={setDisplayCurrency}
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
            <Button onClick={saveDisplayCurrency} disabled={loading}>
              บันทึก
            </Button>
          </CardContent>
        </Card>

        <Card className="border-[#1F2937] bg-[#0F172A]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[#E5E7EB]">เว็บไซต์</CardTitle>
              <Button size="sm" onClick={() => setWebsiteOpen(true)}>
                เพิ่มเว็บไซต์
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {websites.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded border border-[#1F2937] px-4 py-2"
                >
                  <span className="text-[#E5E7EB]">{w.name}</span>
                  <span className="text-sm text-[#9CA3AF]">คำนำหน้า: {w.prefix}</span>
                </div>
              ))}
              {websites.length === 0 && (
                <p className="py-4 text-center text-[#9CA3AF]">ไม่มีเว็บไซต์</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#1F2937] bg-[#0F172A]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[#E5E7EB]">ผู้ใช้</CardTitle>
              <Button size="sm" onClick={() => setUserOpen(true)}>
                เพิ่มผู้ใช้
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1F2937]">
                    <th className="py-2 text-left text-[#9CA3AF]">ชื่อผู้ใช้</th>
                    <th className="py-2 text-left text-[#9CA3AF]">บทบาท</th>
                    <th className="py-2 text-left text-[#9CA3AF]">ใช้งาน</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-[#1F2937] last:border-0"
                    >
                      <td className="py-2 text-[#E5E7EB]">{u.username}</td>
                      <td className="py-2 text-[#9CA3AF]">{u.role}</td>
                      <td className="py-2 text-[#9CA3AF]">
                        {u.isActive ? 'ใช่' : 'ไม่'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#1F2937] bg-[#0F172A]">
          <CardHeader>
            <CardTitle className="text-[#E5E7EB]">อัตราแลกเปลี่ยน</CardTitle>
            <p className="text-sm text-[#9CA3AF]">
              ทุกคู่ (เช่น LAK_THB = 0.0025 คือ 1 LAK = 0.0025 THB)
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rateKeys.map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <Label className="w-24 shrink-0 text-[#9CA3AF]">{key}</Label>
                  <Input
                    type="number"
                    step="any"
                    value={rates[key] ?? ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setRates((prev) => ({
                        ...prev,
                        [key]: isNaN(v) ? 0 : v,
                      }));
                    }}
                  />
                </div>
              ))}
            </div>
            <Button className="mt-4" onClick={saveRates} disabled={loading}>
              บันทึกอัตรา
            </Button>
          </CardContent>
        </Card>

        <Dialog open={websiteOpen} onOpenChange={setWebsiteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่มเว็บไซต์</DialogTitle>
            </DialogHeader>
            <form onSubmit={addWebsite} className="space-y-4">
              <div>
                <Label>ชื่อ</Label>
                <Input
                  value={websiteForm.name}
                  onChange={(e) =>
                    setWebsiteForm({ ...websiteForm, name: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>คำนำหน้า (ไม่ซ้ำ)</Label>
                <Input
                  value={websiteForm.prefix}
                  onChange={(e) =>
                    setWebsiteForm({ ...websiteForm, prefix: e.target.value })
                  }
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setWebsiteOpen(false)}>
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={loading}>
                  เพิ่ม
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={userOpen} onOpenChange={setUserOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่มผู้ใช้</DialogTitle>
            </DialogHeader>
            <form onSubmit={addUser} className="space-y-4">
              <div>
                <Label>ชื่อผู้ใช้</Label>
                <Input
                  value={userForm.username}
                  onChange={(e) =>
                    setUserForm({ ...userForm, username: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>รหัสผ่าน (อย่างน้อย 8 ตัว)</Label>
                <Input
                  type="password"
                  value={userForm.password}
                  onChange={(e) =>
                    setUserForm({ ...userForm, password: e.target.value })
                  }
                  required
                  minLength={8}
                />
              </div>
              <div>
                <Label>บทบาท</Label>
                <Select
                  value={userForm.role}
                  onValueChange={(v: 'ADMIN' | 'AUDIT') =>
                    setUserForm({ ...userForm, role: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                    <SelectItem value="AUDIT">AUDIT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setUserOpen(false)}>
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={loading}>
                  เพิ่ม
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
