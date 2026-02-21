'use client';

import { useRouter } from 'next/navigation';
import { LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Header({
  username,
  onMenuClick,
}: {
  username: string;
  onMenuClick?: () => void;
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  return (
    <header className="fixed right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-[#1F2937] bg-[#0F172A] px-4 sm:px-6 lg:left-56">
      <div />
      <div className="flex items-center gap-2 sm:gap-4">
        <span className="truncate text-sm text-[#9CA3AF] max-w-[120px] sm:max-w-none">{username}</span>
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#9CA3AF] transition-colors hover:bg-[#111827] hover:text-[#E5E7EB] lg:hidden"
            aria-label="เปิดเมนู"
          >
            <Menu className="h-6 w-6" />
          </button>
        )}
        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
