import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ClientLayout } from '@/components/providers/ClientLayout';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Admin',
  description: 'Internal gambling ledger',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  themeColor: '#D4AF37',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className="dark">
      <body className="min-h-screen min-h-[100dvh] bg-[#0B0F1A] text-[#E5E7EB] antialiased">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
