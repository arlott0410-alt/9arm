'use client';

import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppLayout({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { username: string; role: string };
}) {
  const canAccessSettings = user.role === 'SUPER_ADMIN';
  return (
    <div className="min-h-screen bg-[#0B0F1A]">
      <Sidebar canAccessSettings={canAccessSettings} />
      <Header username={user.username} />
      <main className="p-6 pt-24 lg:pl-64">{children}</main>
    </div>
  );
}
