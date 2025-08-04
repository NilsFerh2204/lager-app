import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from 'react-hot-toast';

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
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ea580c" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        
        <script dangerouslySetInnerHTML={{
          __html: `
            // Register service worker
            if ('serviceWorker' in navigator && window.location.hostname !== 'localhost') {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js');
              });
            }
            
            // Redirect mobile users to mobile version
            if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && 
                !window.location.pathname.startsWith('/mobile') &&
                window.location.pathname !== '/') {
              window.location.href = '/mobile';
            }
          `
        }} />
      </head>
      <body className="antialiased bg-gray-50">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}