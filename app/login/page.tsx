'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/needs-setup')
      .then((r) => r.json() as Promise<{ needsSetup?: boolean }>)
      .then((d) => setNeedsSetup(d.needsSetup ?? false))
      .catch(() => setNeedsSetup(false));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
        return;
      }
      router.replace('/dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !setupPassword || setupPassword.length < 8) {
      setError('กรุณาใส่ชื่อผู้ใช้ และรหัสผ่านอย่างน้อย 8 ตัว');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: setupPassword }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || 'สร้างบัญชีไม่สำเร็จ');
        return;
      }
      router.replace('/dashboard');
    } finally {
      setLoading(false);
    }
  }

  if (needsSetup === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0F1A]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0F1A] p-4">
      <Card className="w-full max-w-md border-[#1F2937] bg-[#0F172A]">
        <CardHeader>
          <CardTitle className="text-[#D4AF37]">
            {needsSetup ? 'สร้าง Superadmin' : 'เข้าสู่ระบบ'}
          </CardTitle>
          {needsSetup && (
            <p className="text-sm text-[#9CA3AF]">
              การตั้งค่าครั้งแรก สร้างบัญชี Superadmin ได้เพียงครั้งเดียวเท่านั้น
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form
            onSubmit={needsSetup ? handleSetup : handleLogin}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="username">ชื่อผู้ใช้</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="mt-1"
              />
            </div>
            {needsSetup ? (
              <div>
                <Label htmlFor="setupPassword">รหัสผ่าน (อย่างน้อย 8 ตัว)</Label>
                <Input
                  id="setupPassword"
                  type="password"
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="mt-1"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="password">รหัสผ่าน</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="mt-1"
                />
              </div>
            )}
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? '...' : needsSetup ? 'สร้าง Superadmin' : 'เข้าสู่ระบบ'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
