'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Home, 
  Package, 
  ShoppingCart, 
  Warehouse, 
  LayoutGrid, 
  RefreshCw, 
  Menu, 
  X, 
  Bell, 
  User, 
  LogOut, 
  Flame, 
  Edit3,
  ChevronDown,
  Settings,
  HelpCircle,
  BarChart
} from 'lucide-react';

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationCount] = useState(3);
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
    
    // Check if mobile device
    const checkMobile = () => {
      const mobile = window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Don't render until client-side
  if (!isClient) {
    return null;
  }

  // Don't render navigation on mobile devices or mobile pages
  if (isMobile || pathname.startsWith('/mobile')) {
    return null;
  }

  const isActive = (path: string) => pathname === path;

  const handleLogout = () => {
    router.push('/login');
  };

  return (
    <nav className="bg-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Main Nav */}
          <div className="flex">
            <Link href="/" className="flex items-center">
              <div className="flex items-center gap-2 px-4">
                <div className="w-10 h-10 bg-gradient-to-r from-orange-600 to-red-600 rounded-lg flex items-center justify-center">
                  <Flame className="h-6 w-6 text-white" />
                </div>
                <span className="font-bold text-xl text-gray-900">Lagerverwaltung</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1 ml-6">
              <Link
                href="/dashboard"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/dashboard') 
                    ? 'bg-orange-100 text-orange-700' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Home className="inline h-4 w-4 mr-2" />
                Dashboard
              </Link>
              <Link
                href="/products"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/products') 
                    ? 'bg-orange-100 text-orange-700' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Package className="inline h-4 w-4 mr-2" />
                Produkte
              </Link>
              <Link
                href="/orders"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/orders') 
                    ? 'bg-orange-100 text-orange-700' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <ShoppingCart className="inline h-4 w-4 mr-2" />
                Bestellungen
              </Link>
              <Link
                href="/storage-locations"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/storage-locations') 
                    ? 'bg-orange-100 text-orange-700' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Warehouse className="inline h-4 w-4 mr-2" />
                Lagerplätze
              </Link>
              <Link
                href="/order-picking"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/order-picking') 
                    ? 'bg-orange-100 text-orange-700' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <LayoutGrid className="inline h-4 w-4 mr-2" />
                Kommissionierung
              </Link>
              <Link
                href="/bulk-edit"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/bulk-edit') 
                    ? 'bg-orange-100 text-orange-700' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Edit3 className="inline h-4 w-4 mr-2" />
                Bulk Edit
              </Link>
              <Link
                href="/shopify-sync"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/shopify-sync') 
                    ? 'bg-orange-100 text-orange-700' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <RefreshCw className="inline h-4 w-4 mr-2" />
                Sync
              </Link>
            </div>
          </div>

          {/* Right side items */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Quick Actions */}
            <button className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">
              <BarChart className="h-5 w-5" />
            </button>
            
            {/* Notifications */}
            <button className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">
              <Bell className="h-5 w-5" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {notificationCount}
                </span>
              )}
            </button>

            {/* Help */}
            <button className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">
              <HelpCircle className="h-5 w-5" />
            </button>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-orange-600 to-red-600 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-700 hidden lg:block">Max Admin</span>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </button>

              {/* User Dropdown */}
              {userMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-20">
                    <div className="px-4 py-2 border-b">
                      <p className="text-sm font-medium text-gray-900">Max Admin</p>
                      <p className="text-xs text-gray-500">admin@lager.de</p>
                    </div>
                    <Link
                      href="/profile"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <User className="inline h-4 w-4 mr-2" />
                      Profil
                    </Link>
                    <Link
                      href="/settings"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Settings className="inline h-4 w-4 mr-2" />
                      Einstellungen
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <LogOut className="inline h-4 w-4 mr-2" />
                      Abmelden
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              href="/dashboard"
              className="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Home className="inline h-4 w-4 mr-2" />
              Dashboard
            </Link>
            <Link
              href="/products"
              className="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Package className="inline h-4 w-4 mr-2" />
              Produkte
            </Link>
            <Link
              href="/orders"
              className="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              <ShoppingCart className="inline h-4 w-4 mr-2" />
              Bestellungen
            </Link>
            <Link
              href="/storage-locations"
              className="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Warehouse className="inline h-4 w-4 mr-2" />
              Lagerplätze
            </Link>
            <div className="border-t pt-2 mt-2">
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-gray-900">Max Admin</p>
                <p className="text-xs text-gray-500">admin@lager.de</p>
              </div>
              <button
                onClick={handleLogout}
                className="block w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <LogOut className="inline h-4 w-4 mr-2" />
                Abmelden
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}