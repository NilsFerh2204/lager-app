import type { Metadata } from "next";
import { Toaster } from 'react-hot-toast';
import MobileNavigation from '@/components/MobileNavigation';
import "../globals.css";

export const metadata: Metadata = {
  title: "Lager App - Mobile",
  description: "Mobile Lagerverwaltung",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
  themeColor: "#ea580c",
};

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-900">
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