'use client';

import { useEffect } from 'react';
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
  X,
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

export function MobileDrawer({
  open,
  onClose,
  canAccessSettings,
  canAccessWallets,
}: {
  open: boolean;
  onClose: () => void;
  canAccessSettings: boolean;
  canAccessWallets?: boolean;
}) {
  const pathname = usePathname();
  const items = navAll.filter((n) => {
    if (n.href === '/settings' && !canAccessSettings) return false;
    if (n.href === '/wallets' && !canAccessWallets) return false;
    return true;
  });

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-72 max-w-[85vw] flex-col border-r border-[#1F2937] bg-[#0F172A] shadow-2xl transition-transform duration-300 ease-out lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="เมนูนำทาง"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#1F2937] px-4">
          <span className="text-lg font-semibold text-[#D4AF37]">
            9arm Ledger
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#9CA3AF] transition-colors hover:bg-[#111827] hover:text-[#E5E7EB]"
            aria-label="ปิดเมนู"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                pathname?.startsWith(item.href + '/');
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-4 py-3 text-base transition-all',
                      isActive
                        ? 'bg-[#D4AF37]/15 text-[#D4AF37]'
                        : 'text-[#9CA3AF] hover:bg-[#111827] hover:text-[#E5E7EB]'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-5 w-5 shrink-0',
                        isActive ? 'text-[#D4AF37]' : 'text-[#6B7280]'
                      )}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-[#1F2937] p-4">
          <p className="text-xs text-[#6B7280]">แตะด้านนอกเพื่อปิดเมนู</p>
        </div>
      </aside>
    </>
  );
}
