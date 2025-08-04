'use client';

import { usePathname } from 'next/navigation';
import type { Metadata } from "next";
import { Toaster } from 'react-hot-toast';
import MobileNavigation from '@/components/MobileNavigation';
import "../globals.css";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  return (
    <div className="min-h-screen bg-gray-900" data-pathname={pathname}>
      <style jsx global>{`
        nav:not(.mobile-bottom-nav) {
          display: none !important;
        }
      `}</style>
      <MobileNavigation />
      <main className="pb-20">
        {children}
      </main>
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: '#1f2937',
            color: '#fff',
            borderRadius: '0.5rem',
            padding: '1rem',
          },
          duration: 3000,
        }}
      />
    </div>
  );
}