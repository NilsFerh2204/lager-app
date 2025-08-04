'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, ShoppingCart, MapPin, Menu, X, QrCode, ArrowLeft, ClipboardList, ArrowUpDown, Database } from 'lucide-react';

export default function MobileNavigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/mobile') {
      return pathname === path;
    }
    return pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 bg-black bg-opacity-90 backdrop-blur-sm z-50 md:hidden">
        <div className="flex items-center justify-between p-4">
          <Link href="/mobile" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-600 to-red-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">LV</span>
            </div>
            <span className="font-bold text-white">Lager App</span>
          </Link>
          
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-gray-800 text-white"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-95 z-50 md:hidden pt-16">
          <nav className="p-4">
            <Link
              href="/mobile"
              className="block px-4 py-3 text-white hover:bg-gray-800 rounded-lg mb-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Home className="inline h-5 w-5 mr-3" />
              Übersicht
            </Link>
            <Link
              href="/mobile/scan"
              className="block px-4 py-3 text-white hover:bg-gray-800 rounded-lg mb-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              <QrCode className="inline h-5 w-5 mr-3" />
              Scanner
            </Link>
            <Link
              href="/mobile/picking"
              className="block px-4 py-3 text-white hover:bg-gray-800 rounded-lg mb-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              <ShoppingCart className="inline h-5 w-5 mr-3" />
              Kommissionierung
            </Link>
            <Link
              href="/mobile/inventory"
              className="block px-4 py-3 text-white hover:bg-gray-800 rounded-lg mb-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              <ClipboardList className="inline h-5 w-5 mr-3" />
              Inventur
            </Link>
            <Link
              href="/mobile/transfer"
              className="block px-4 py-3 text-white hover:bg-gray-800 rounded-lg mb-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              <ArrowUpDown className="inline h-5 w-5 mr-3" />
              Umlagerung
            </Link>
            <Link
              href="/mobile/locations"
              className="block px-4 py-3 text-white hover:bg-gray-800 rounded-lg mb-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              <MapPin className="inline h-5 w-5 mr-3" />
              Lagerplätze
            </Link>
            <Link
              href="/mobile/barcode-learning"
              className="block px-4 py-3 text-white hover:bg-gray-800 rounded-lg mb-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Database className="inline h-5 w-5 mr-3" />
              Barcode Verwaltung
            </Link>
          </nav>
        </div>
      )}

      {/* Bottom Navigation - Always visible on mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-black bg-opacity-90 backdrop-blur-sm md:hidden z-40">
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
            href="/mobile/locations" 
            className={`flex flex-col items-center gap-1 py-2 ${
              isActive('/mobile/locations') ? 'text-orange-500' : 'text-gray-400'
            }`}
          >
            <MapPin className="h-6 w-6" />
            <span className="text-xs">Plätze</span>
          </Link>
        </div>
      </div>
    </>
  );
}