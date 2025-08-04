'use client';

import { usePathname } from 'next/navigation';
import Navigation from '@/components/Navigation';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isMobilePage = pathname.startsWith('/mobile');

  return (
    <>
      {!isMobilePage && <Navigation />}
      <main className="min-h-screen">
        {children}
      </main>
    </>
  );
}