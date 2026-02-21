'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMinorToDisplay } from '@/lib/utils';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(
    null
  );
  const [data, setData] = useState<{
    displayCurrency: string;
    today: { deposits: number; withdraws: number; net: number };
    month: { deposits: number; withdraws: number; net: number };
    wallets: { id: number; name: string; currency: string; balance: number }[];
  } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) {
          router.replace('/login');
          return;
        }
        setUser(d.user);
      });
  }, [router]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, [user]);

  if (!user) return null;

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[#E5E7EB]">แดชบอร์ด</h1>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <Card className="border-[#1F2937] bg-[#0F172A]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#9CA3AF]">
                ฝากวันนี้
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-[#D4AF37]">
                {data
                  ? formatMinorToDisplay(data.today.deposits, data.displayCurrency || 'THB')
                  : '-'}
              </span>
            </CardContent>
          </Card>
          <Card className="border-[#1F2937] bg-[#0F172A]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#9CA3AF]">
                ถอนวันนี้
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-[#D4AF37]">
                {data
                  ? formatMinorToDisplay(data.today.withdraws, data.displayCurrency || 'THB')
                  : '-'}
              </span>
            </CardContent>
          </Card>
          <Card className="border-[#1F2937] bg-[#0F172A]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#9CA3AF]">
                สุทธิวันนี้
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span
                className={`text-2xl font-bold ${
                  data && data.today.net >= 0 ? 'text-[#D4AF37]' : 'text-red-400'
                }`}
              >
                {data
                  ? formatMinorToDisplay(Math.abs(data.today.net), data.displayCurrency || 'THB') +
                    (data.today.net < 0 ? ' (ถอนออก)' : '')
                  : '-'}
              </span>
            </CardContent>
          </Card>
          <Card className="border-[#1F2937] bg-[#0F172A]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#9CA3AF]">
                ฝากเดือนนี้
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-[#D4AF37]">
                {data
                  ? formatMinorToDisplay(data.month.deposits, data.displayCurrency || 'THB')
                  : '-'}
              </span>
            </CardContent>
          </Card>
          <Card className="border-[#1F2937] bg-[#0F172A]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#9CA3AF]">
                ถอนเดือนนี้
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-[#D4AF37]">
                {data
                  ? formatMinorToDisplay(data.month.withdraws, data.displayCurrency || 'THB')
                  : '-'}
              </span>
            </CardContent>
          </Card>
          <Card className="border-[#1F2937] bg-[#0F172A]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#9CA3AF]">
                สุทธิเดือนนี้
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span
                className={`text-2xl font-bold ${
                  data && data.month.net >= 0 ? 'text-[#D4AF37]' : 'text-red-400'
                }`}
              >
                {data
                  ? formatMinorToDisplay(Math.abs(data.month.net), data.displayCurrency || 'THB') +
                    (data.month.net < 0 ? ' (ถอนออก)' : '')
                  : '-'}
              </span>
            </CardContent>
          </Card>
        </div>

        <Card className="border-[#1F2937] bg-[#0F172A]">
          <CardHeader>
            <CardTitle className="text-[#E5E7EB]">ยอดกระเป๋าเงิน</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1F2937]">
                    <th className="py-3 text-left font-medium text-[#9CA3AF]">
                      กระเป๋าเงิน
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
                  {data?.wallets.map((w) => (
                    <tr
                      key={w.id}
                      className="border-b border-[#1F2937] last:border-0"
                    >
                      <td className="py-3 text-[#E5E7EB]">{w.name}</td>
                      <td className="py-3 text-[#9CA3AF]">{w.currency}</td>
                      <td className="py-3 text-right font-medium text-[#D4AF37]">
                        {formatMinorToDisplay(w.balance, w.currency)}
                      </td>
                    </tr>
                  ))}
                  {(!data?.wallets || data.wallets.length === 0) && (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-[#9CA3AF]">
                        ไม่มีกระเป๋าเงิน
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
