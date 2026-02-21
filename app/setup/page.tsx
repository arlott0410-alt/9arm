'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { safeJson } from '@/lib/fetch-json';

export default function SetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'setup' | 'redirect'>('loading');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/needs-setup')
      .then((r) => safeJson<{ needsSetup?: boolean }>(r))
      .then((d) => {
        if (d?.needsSetup) {
          setStatus('setup');
        } else {
          setStatus('redirect');
          router.replace('/login');
        }
      })
      .catch(() => {
        setStatus('setup');
      });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password || password.length < 8) {
      setError('กรุณาใส่ชื่อผู้ใช้ และรหัสผ่านอย่างน้อย 8 ตัว');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await safeJson<{ error?: string; code?: string }>(res);
      if (!res.ok) {
        setError(data?.error || 'สร้างบัญชีไม่สำเร็จ');
        return;
      }
      router.replace('/dashboard');
    } finally {
      setLoading(false);
    }
  }

  if (status === 'loading' || status === 'redirect') {
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
          <CardTitle className="text-[#D4AF37]">สร้างบัญชีแรก (Superadmin)</CardTitle>
          <p className="text-sm text-[#9CA3AF]">
            สร้างบัญชี Superadmin ได้เพียงครั้งเดียวเท่านั้น
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <div>
              <Label htmlFor="password">รหัสผ่าน (อย่างน้อย 8 ตัว)</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="mt-1"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? '...' : 'สร้างบัญชี'}
            </Button>
            <p className="text-center text-sm text-[#9CA3AF]">
              มีบัญชีแล้ว?{' '}
              <a href="/login" className="text-[#D4AF37] hover:underline">
                เข้าสู่ระบบ
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
