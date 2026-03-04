'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  useEffect(() => {
    if (loading) return;
    if (user) router.replace('/dashboard');
    else router.replace('/login');
  }, [loading, user, router]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0F1A]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
    </div>
  );
}
