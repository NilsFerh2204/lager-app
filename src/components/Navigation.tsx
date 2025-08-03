'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Package, 
  LayoutDashboard, 
  Warehouse, 
  ScanLine, 
  TrendingUp, 
  ShoppingBag, 
  FileText,
  Bell,
  User,
  Menu,
  X,
  Box
} from 'lucide-react';
import { useState, useEffect } from 'react';

const navigationItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Produkte', href: '/products', icon: Package },
  { name: 'Lagerplätze', href: '/storage-locations', icon: Warehouse },
  { name: 'Scanner', href: '/scanner', icon: ScanLine },
  { name: 'Bewegungen', href: '/movements', icon: TrendingUp },
  { name: 'Shopify', href: '/shopify-sync', icon: ShoppingBag },
  { name: 'Berichte', href: '/reports', icon: FileText },
  { name: 'Kommissionierung', href: '/order-picking', icon: Box },
];

export default function Navigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    // Lade Benutzername aus localStorage
    const savedName = localStorage.getItem('userName');
    if (savedName) {
      setUserName(savedName);
    } else {
      setUserName('Administrator');
    }
  }, []);

  return (
    <nav className="bg-white shadow-md sticky top-0 z-40">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo und Titel */}
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="bg-orange-500 p-2 rounded-lg">
                <Package className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800">Lagerverwaltung</h1>
                <p className="text-xs text-gray-600">Feuerwerk Management</p>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    isActive
                      ? 'bg-orange-100 text-orange-600'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon size={18} />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* User Profile */}
            <div className="flex items-center gap-2">
              <span className="hidden md:block text-sm text-gray-700">{userName}</span>
              <div className="w-9 h-9 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                {userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'NF'}
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t">
          <div className="container mx-auto px-4 py-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    isActive
                      ? 'bg-orange-100 text-orange-600'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon size={18} />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}