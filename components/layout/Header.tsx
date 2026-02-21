'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Header({ username }: { username: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  return (
    <header className="fixed right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-[#1F2937] bg-[#0F172A] px-6 lg:left-56">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-[#9CA3AF]">{username}</span>
        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
