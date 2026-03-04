'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/providers/AuthProvider';

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
  }, [authLoading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านใหม่กับยืนยันไม่ตรงกัน');
      return;
    }
    if (newPassword.length < 8) {
      setError('รหัสผ่านใหม่อย่างน้อย 8 ตัว');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (res.ok) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccess(true);
      } else {
        setError(typeof data.error === 'string' ? data.error : 'เกิดข้อผิดพลาด');
      }
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || !user) return null;

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[#E5E7EB]">โปรไฟล์</h1>

        <Card className="border-[#1F2937] bg-[#0F172A] max-w-md">
          <CardHeader>
            <CardTitle className="text-[#E5E7EB]">เปลี่ยนรหัสผ่าน</CardTitle>
            <p className="text-sm text-[#9CA3AF]">
              กรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}
              {success && (
                <p className="text-sm text-green-400">เปลี่ยนรหัสผ่านสำเร็จ</p>
              )}
              <div>
                <Label htmlFor="current">รหัสผ่านปัจจุบัน</Label>
                <Input
                  id="current"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  minLength={1}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="new">รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)</Label>
                <Input
                  id="new"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="confirm">ยืนยันรหัสผ่านใหม่</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="mt-1"
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
