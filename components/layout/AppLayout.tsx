'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileDrawer } from './MobileDrawer';

export function AppLayout({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { username: string; role: string };
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const canAccessSettings = user.role === 'SUPER_ADMIN';
  const canAccessWallets = user.role === 'SUPER_ADMIN';

  return (
    <div className="min-h-screen bg-[#0B0F1A]">
      <Sidebar canAccessSettings={canAccessSettings} canAccessWallets={canAccessWallets} />
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        canAccessSettings={canAccessSettings}
        canAccessWallets={canAccessWallets}
      />
      <Header
        username={user.username}
        onMenuClick={() => setDrawerOpen(true)}
      />
      <main className="min-h-screen p-4 pt-20 pb-8 sm:p-6 sm:pt-24 lg:pl-64 lg:pt-24">
        {children}
      </main>
    </div>
  );
}
