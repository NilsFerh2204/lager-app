import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from 'react-hot-toast';
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
  title: "Lagerverwaltung - Feuerwerk Management",
  description: "Professionelles Lagerverwaltungssystem für Feuerwerk",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="antialiased bg-gray-50">
        <Navigation />
        <main className="min-h-screen">
          {children}
        </main>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}