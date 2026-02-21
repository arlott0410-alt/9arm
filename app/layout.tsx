import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '9arm Ledger',
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
      <body className="min-h-screen bg-[#0B0F1A] text-[#E5E7EB] antialiased">
        {children}
      </body>
    </html>
  );
}
