'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, ShoppingCart, MapPin, QrCode } from 'lucide-react';

export default function MobileNavigation() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/mobile') {
      return pathname === path;
    }
    return pathname.startsWith(path);
  };

  return (
    <>
      {/* Bottom Navigation Only - No Header */}
      <div className="fixed bottom-0 left-0 right-0 bg-black bg-opacity-90 backdrop-blur-sm z-40 mobile-bottom-nav">
        <div className="grid grid-cols-4 py-2">
          <Link 
            href="/mobile" 
            className={`flex flex-col items-center gap-1 py-2 ${
              isActive('/mobile') ? 'text-orange-500' : 'text-gray-400'
            }`}
          >
            <Home className="h-6 w-6" />
            <span className="text-xs">Home</span>
          </Link>
          <Link 
            href="/mobile/scan" 
            className={`flex flex-col items-center gap-1 py-2 ${
              isActive('/mobile/scan') ? 'text-orange-500' : 'text-gray-400'
            }`}
          >
            <QrCode className="h-6 w-6" />
            <span className="text-xs">Scan</span>
          </Link>
          <Link 
            href="/mobile/picking" 
            className={`flex flex-col items-center gap-1 py-2 ${
              isActive('/mobile/picking') ? 'text-orange-500' : 'text-gray-400'
            }`}
          >
            <ShoppingCart className="h-6 w-6" />
            <span className="text-xs">Picken</span>
          </Link>
          <Link 
            href="/mobile/products" 
            className={`flex flex-col items-center gap-1 py-2 ${
              isActive('/mobile/products') ? 'text-orange-500' : 'text-gray-400'
            }`}
          >
            <Package className="h-6 w-6" />
            <span className="text-xs">Produkte</span>
          </Link>
        </div>
      </div>
    </>
  );
}