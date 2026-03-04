'use client';

import { AuthProvider } from './AuthProvider';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
