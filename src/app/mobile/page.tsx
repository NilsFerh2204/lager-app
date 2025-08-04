'use client';

import { useState, useEffect } from 'react';
import { 
  Package, 
  QrCode, 
  MapPin, 
  ClipboardList, 
  ShoppingCart,
  Warehouse,
  Home,
  User,
  Settings,
  LogOut
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function MobileHomePage() {
  const [userName, setUserName] = useState('Lagerarbeiter');
  const router = useRouter();

  useEffect(() => {
    // Check if running as PWA
    const isPWA = window.matchMedia('(display-mode: standalone)').matches;
    if (isPWA) {
      console.log('Running as PWA');
    }
  }, []);

  const handleLogout = () => {
    toast.success('Ausgeloggt');
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-black bg-opacity-80 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Lagerverwaltung</h1>
            <p className="text-gray-400 text-sm">Mobile App</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 bg-orange-600 rounded-full flex items-center justify-center">
              <User className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Menu Grid */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Scanner */}
          <Link href="/mobile/scan" className="bg-gray-800 rounded-lg p-6 flex flex-col items-center gap-3 hover:bg-gray-700 transition-colors">
            <div className="h-16 w-16 bg-orange-600 rounded-full flex items-center justify-center">
              <QrCode className="h-10 w-10" />
            </div>
            <span className="font-semibold">Scanner</span>
            <span className="text-xs text-gray-400 text-center">Produkte scannen</span>
          </Link>

          {/* Kommissionierung */}
          <Link href="/mobile/picking" className="bg-gray-800 rounded-lg p-6 flex flex-col items-center gap-3 hover:bg-gray-700 transition-colors">
            <div className="h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center">
              <ShoppingCart className="h-10 w-10" />
            </div>
            <span className="font-semibold">Kommissionierung</span>
            <span className="text-xs text-gray-400 text-center">Bestellungen picken</span>
          </Link>

          {/* Lagerplätze */}
          <Link href="/mobile/locations" className="bg-gray-800 rounded-lg p-6 flex flex-col items-center gap-3 hover:bg-gray-700 transition-colors">
            <div className="h-16 w-16 bg-green-600 rounded-full flex items-center justify-center">
              <MapPin className="h-10 w-10" />
            </div>
            <span className="font-semibold">Lagerplätze</span>
            <span className="text-xs text-gray-400 text-center">Plätze verwalten</span>
          </Link>

          {/* Inventur */}
          <Link href="/mobile/inventory" className="bg-gray-800 rounded-lg p-6 flex flex-col items-center gap-3 hover:bg-gray-700 transition-colors">
            <div className="h-16 w-16 bg-purple-600 rounded-full flex items-center justify-center">
              <ClipboardList className="h-10 w-10" />
            </div>
            <span className="font-semibold">Inventur</span>
            <span className="text-xs text-gray-400 text-center">Bestand zählen</span>
          </Link>

          {/* Produkte */}
          <Link href="/mobile/products" className="bg-gray-800 rounded-lg p-6 flex flex-col items-center gap-3 hover:bg-gray-700 transition-colors">
            <div className="h-16 w-16 bg-yellow-600 rounded-full flex items-center justify-center">
              <Package className="h-10 w-10" />
            </div>
            <span className="font-semibold">Produkte</span>
            <span className="text-xs text-gray-400 text-center">Alle Produkte</span>
          </Link>

          {/* Umlagerung */}
          <Link href="/mobile/transfer" className="bg-gray-800 rounded-lg p-6 flex flex-col items-center gap-3 hover:bg-gray-700 transition-colors">
            <div className="h-16 w-16 bg-red-600 rounded-full flex items-center justify-center">
              <Warehouse className="h-10 w-10" />
            </div>
            <span className="font-semibold">Umlagerung</span>
            <span className="text-xs text-gray-400 text-center">Waren umlagern</span>
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="mt-6 bg-gray-800 rounded-lg p-4">
          <h2 className="font-semibold mb-3">Heute</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-500">0</p>
              <p className="text-xs text-gray-400">Gescannt</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-500">0</p>
              <p className="text-xs text-gray-400">Gepickt</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-500">0</p>
              <p className="text-xs text-gray-400">Umgelagert</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-black bg-opacity-90 backdrop-blur-sm">
        <div className="grid grid-cols-4 py-2">
          <Link href="/mobile" className="flex flex-col items-center gap-1 py-2 text-orange-500">
            <Home className="h-6 w-6" />
            <span className="text-xs">Home</span>
          </Link>
          <Link href="/mobile/scan" className="flex flex-col items-center gap-1 py-2 text-gray-400">
            <QrCode className="h-6 w-6" />
            <span className="text-xs">Scan</span>
          </Link>
          <Link href="/mobile/picking" className="flex flex-col items-center gap-1 py-2 text-gray-400">
            <ShoppingCart className="h-6 w-6" />
            <span className="text-xs">Picken</span>
          </Link>
          <button onClick={handleLogout} className="flex flex-col items-center gap-1 py-2 text-gray-400">
            <LogOut className="h-6 w-6" />
            <span className="text-xs">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}