'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CreditCard,
  Gift,
  ArrowLeftRight,
  Wallet,
  FileText,
  Settings,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navAll = [
  { href: '/dashboard', label: 'แดชบอร์ด', icon: LayoutDashboard },
  { href: '/transactions', label: 'ธุรกรรม', icon: CreditCard },
  { href: '/bonuses', label: 'โบนัส', icon: Gift },
  { href: '/wallets', label: 'กระเป๋าเงิน', icon: Wallet },
  { href: '/transfers', label: 'โอนเงิน', icon: ArrowLeftRight },
  { href: '/reports', label: 'รายงาน', icon: FileText },
  { href: '/profile', label: 'โปรไฟล์', icon: User },
  { href: '/settings', label: 'ตั้งค่า', icon: Settings },
];

export function Sidebar({
  canAccessSettings,
  canAccessWallets,
}: {
  canAccessSettings: boolean;
  canAccessWallets?: boolean;
}) {
  const pathname = usePathname();
  const items = navAll.filter((n) => {
    if (n.href === '/settings' && !canAccessSettings) return false;
    if (n.href === '/wallets' && !canAccessWallets) return false;
    return true;
  });

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-56 border-r border-[#1F2937] bg-[#0F172A] lg:block">
      <div className="flex h-16 items-center border-b border-[#1F2937] px-6">
        <span className="text-lg font-semibold text-[#D4AF37]">9arm Ledger</span>
      </div>
      <nav className="space-y-1 p-4">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-[#111827] text-[#D4AF37]'
                  : 'text-[#9CA3AF] hover:bg-[#111827] hover:text-[#E5E7EB]'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
