'use client';

import { useState } from 'react';
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
  BarChart3,
  Settings,
  HelpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/products', label: 'Produkte', icon: Package },
  { href: '/bulk-edit', label: 'Bulk Edit', icon: Edit3 },
  { href: '/order-picking', label: 'Kommissionierung', icon: ShoppingCart },
  { href: '/storage-locations', label: 'Lagerplätze', icon: Warehouse },
  { href: '/shopify-sync', label: 'Shopify Sync', icon: RefreshCw },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(3); // Example notification count

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Erfolgreich ausgeloggt');
        router.push('/login');
      }
    } catch (error) {
      toast.error('Fehler beim Ausloggen');
    }
  };

  // Don't show navigation on login page
  if (pathname === '/login') return null;

  return (
    <nav className="bg-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Desktop Navigation */}
          <div className="flex">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link href="/dashboard" className="flex items-center gap-2">
                <div className="flex items-center justify-center h-10 w-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg">
                  <Flame className="h-6 w-6 text-white" />
                </div>
                <span className="font-bold text-xl text-gray-800 hidden lg:block">
                  Lichtenrader Feuerwerk
                </span>
                <span className="text-sm text-gray-500 hidden lg:block ml-2">
                  Lagerverwaltung
                </span>
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:ml-6 md:flex md:space-x-4 lg:space-x-6">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                      isActive
                        ? 'bg-orange-100 text-orange-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="mr-2" size={18} />
                    <span className="hidden lg:inline">{item.label}</span>
                    <span className="lg:hidden">{item.label.split(' ')[0]}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right side items */}
          <div className="hidden md:ml-6 md:flex md:items-center gap-2 lg:gap-4">
            {/* Quick Actions */}
            <button className="p-2 rounded-lg text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors">
              <BarChart3 size={20} />
            </button>
            
            {/* Notifications */}
            <button className="relative p-2 rounded-lg text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors">
              <Bell size={20} />
              {notificationCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
                  {notificationCount}
                </span>
              )}
            </button>

            {/* Help */}
            <button className="p-2 rounded-lg text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors hidden lg:block">
              <HelpCircle size={20} />
            </button>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
                  <span className="text-white font-medium text-sm">MA</span>
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-sm font-medium text-gray-700">Max Admin</p>
                  <p className="text-xs text-gray-500">Administrator</p>
                </div>
              </button>

              {/* Dropdown */}
              {userMenuOpen && (
                <>
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setUserMenuOpen(false)}
                  />
                  
                  {/* Menu */}
                  <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
                    <div className="p-2">
                      <div className="px-3 py-2 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-700">Max Admin</p>
                        <p className="text-xs text-gray-500">admin@lichtenrader.de</p>
                      </div>
                      
                      <Link
                        href="/profile"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md mt-2 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <User size={16} />
                        Mein Profil
                      </Link>
                      
                      <Link
                        href="/settings"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Settings size={16} />
                        Einstellungen
                      </Link>
                      
                      <div className="border-t border-gray-100 mt-2 pt-2">
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md w-full text-left transition-colors"
                        >
                          <LogOut size={16} />
                          Ausloggen
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="-mr-2 flex items-center md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {/* Mobile User Info */}
            <div className="px-3 py-3 border-b border-gray-100 mb-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
                  <span className="text-white font-medium">MA</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Max Admin</p>
                  <p className="text-xs text-gray-500">Administrator</p>
                </div>
              </div>
            </div>
            
            {/* Mobile Navigation Items */}
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-3 py-2 text-base font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-orange-100 text-orange-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon className="mr-3" size={20} />
                  {item.label}
                </Link>
              );
            })}
            
            {/* Mobile Additional Items */}
            <div className="border-t border-gray-100 pt-2 mt-2">
              <Link
                href="/profile"
                className="flex items-center px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <User className="mr-3" size={20} />
                Mein Profil
              </Link>
              
              <Link
                href="/settings"
                className="flex items-center px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Settings className="mr-3" size={20} />
                Einstellungen
              </Link>
              
              <button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center w-full px-3 py-2 text-base font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="mr-3" size={20} />
                Ausloggen
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}