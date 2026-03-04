'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar } from 'lucide-react';

type Employee = {
  id: number;
  username: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export default function EmployeesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [holidayHeadUserId, setHolidayHeadUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json() as Promise<{ user?: { username: string; role: string } }>)
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
    setLoading(true);
    fetch('/api/employees')
      .then((r) => r.json() as Promise<{ employees: Employee[]; holidayHeadUserId: number | null }>)
      .then((data) => {
        setEmployees(data.employees ?? []);
        setHolidayHeadUserId(data.holidayHeadUserId ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[#E5E7EB]">จัดการพนักงาน</h1>
        <p className="text-sm text-[#9CA3AF]">
          รายชื่อผู้ใช้ role ADMIN (พนักงาน) — ใช้สำหรับตารางวันหยุดและเงินเดือน. การเปิด/ปิดใช้งาน และเปลี่ยนรหัสผ่าน ทำได้ที่{' '}
          <Link href="/settings" className="text-[#D4AF37] hover:underline">
            ตั้งค่า → ผู้ใช้
          </Link>
        </p>

        <Card className="border-[#1F2937] bg-[#0F172A]">
          <CardHeader>
            <CardTitle className="text-[#E5E7EB] flex items-center gap-2">
              <Users className="h-5 w-5" />
              รายชื่อพนักงาน (ADMIN)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-6 text-center text-[#9CA3AF]">กำลังโหลด...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1F2937]">
                      <th className="py-2 text-left text-[#9CA3AF]">ชื่อผู้ใช้</th>
                      <th className="py-2 text-left text-[#9CA3AF]">สถานะ</th>
                      <th className="py-2 text-left text-[#9CA3AF]">หมายเหตุ</th>
                      <th className="py-2 text-left text-[#9CA3AF]">ล็อกอินล่าสุด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id} className="border-b border-[#1F2937]">
                        <td className="py-2 text-[#E5E7EB] font-medium">{emp.username}</td>
                        <td className="py-2">
                          <span
                            className={
                              emp.isActive
                                ? 'text-green-400'
                                : 'text-red-400/90'
                            }
                          >
                            {emp.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                          </span>
                        </td>
                        <td className="py-2 text-[#9CA3AF]">
                          {holidayHeadUserId === emp.id && (
                            <span className="inline-flex items-center gap-1 rounded bg-[#D4AF37]/20 px-2 py-0.5 text-xs text-[#D4AF37]">
                              <Calendar className="h-3 w-3" />
                              หัวหน้าวันหยุด
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-[#9CA3AF]">
                          {emp.lastLoginAt
                            ? new Date(emp.lastLoginAt).toLocaleString('th-TH')
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {employees.length === 0 && (
                  <p className="py-6 text-center text-[#9CA3AF]">ไม่มีพนักงาน (ADMIN) ในระบบ</p>
                )}
              </div>
            )}
            <p className="mt-4 text-xs text-[#6B7280]">
              ตั้งค่าหัวหน้าวันหยุดได้ที่{' '}
              <Link href="/settings" className="text-[#D4AF37] hover:underline">
                ตั้งค่า → หัวหน้าวันหยุด
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
