'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import {
  Package,
  ShoppingCart,
  MapPin,
  QrCode,
  TrendingUp,
  AlertCircle,
  Clock,
  Users,
  Home,
  ClipboardList,
  ArrowUpDown,
  Database,
  Sparkles
} from 'lucide-react';

interface DashboardStats {
  totalProducts: number;
  lowStockProducts: number;
  pendingOrders: number;
  totalLocations: number;
  productsWithBarcode: number;
  unknownBarcodes: number;
}

export default function MobileHomePage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    lowStockProducts: 0,
    pendingOrders: 0,
    totalLocations: 0,
    productsWithBarcode: 0,
    unknownBarcodes: 0
  });
  const [loading, setLoading] = useState(true);
  const [userName] = useState('Lager Team');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch products stats
      const { data: products } = await supabase
        .from('products')
        .select('current_stock, minimum_stock, barcode');
      
      const lowStock = products?.filter(p => p.current_stock <= p.minimum_stock).length || 0;
      const withBarcode = products?.filter(p => p.barcode).length || 0;

      // Fetch orders
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .neq('fulfillment_status', 'fulfilled');

      // Fetch locations
      const { data: locations } = await supabase
        .from('storage_locations')
        .select('id');

      // Fetch unknown barcodes
      const { data: unknownBarcodes } = await supabase
        .from('unknown_barcodes')
        .select('barcode');

      setStats({
        totalProducts: products?.length || 0,
        lowStockProducts: lowStock,
        pendingOrders: orders?.length || 0,
        totalLocations: locations?.length || 0,
        productsWithBarcode: withBarcode,
        unknownBarcodes: unknownBarcodes?.length || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Guten Morgen' : currentHour < 18 ? 'Guten Tag' : 'Guten Abend';

 return (
  <div className="min-h-screen bg-gray-900 text-white pb-20" data-mobile-page="true">
    {/* Rest des Codes bleibt gleich */}
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6 pb-12">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-orange-200 text-sm">{greeting}</p>
            <h1 className="text-2xl font-bold">{userName}</h1>
          </div>
          <div className="bg-white bg-opacity-20 rounded-full p-3">
            <Users className="h-6 w-6" />
          </div>
        </div>
        
        <div className="text-sm text-orange-200">
          <Clock className="inline h-4 w-4 mr-1" />
          {new Date().toLocaleString('de-DE', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long' 
          })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-4 -mt-6">
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <Package className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{stats.totalProducts}</span>
            </div>
            <p className="text-sm text-gray-400">Produkte</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-bold">{stats.lowStockProducts}</span>
            </div>
            <p className="text-sm text-gray-400">Niedriger Bestand</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <ShoppingCart className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{stats.pendingOrders}</span>
            </div>
            <p className="text-sm text-gray-400">Offene Bestellungen</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <MapPin className="h-5 w-5 text-purple-500" />
              <span className="text-2xl font-bold">{stats.totalLocations}</span>
            </div>
            <p className="text-sm text-gray-400">Lagerplätze</p>
          </div>
        </div>

        {/* Barcode Status Alert */}
        {stats.unknownBarcodes > 0 && (
          <Link href="/mobile/barcode-learning">
            <div className="bg-orange-900 bg-opacity-50 border border-orange-700 rounded-lg p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="h-6 w-6 text-orange-400" />
                <div>
                  <p className="font-medium">{stats.unknownBarcodes} unbekannte Barcodes</p>
                  <p className="text-sm text-gray-300">Tippen zum Zuordnen</p>
                </div>
              </div>
              <Sparkles className="h-5 w-5 text-orange-400" />
            </div>
          </Link>
        )}

        {/* Quick Actions */}
        <h2 className="text-lg font-semibold mb-3">Schnellaktionen</h2>
        
        <div className="grid grid-cols-2 gap-3">
          <Link href="/mobile/scan" className="bg-gray-800 rounded-lg p-4 flex flex-col items-center gap-2 border border-gray-700 hover:border-orange-500 transition-colors">
            <QrCode className="h-8 w-8 text-orange-500" />
            <span className="font-medium">Scanner</span>
            <span className="text-xs text-gray-400">Bestand anpassen</span>
          </Link>

          <Link href="/mobile/picking" className="bg-gray-800 rounded-lg p-4 flex flex-col items-center gap-2 border border-gray-700 hover:border-green-500 transition-colors">
            <ShoppingCart className="h-8 w-8 text-green-500" />
            <span className="font-medium">Kommissionierung</span>
            <span className="text-xs text-gray-400">{stats.pendingOrders} offen</span>
          </Link>

          <Link href="/mobile/inventory" className="bg-gray-800 rounded-lg p-4 flex flex-col items-center gap-2 border border-gray-700 hover:border-blue-500 transition-colors">
            <ClipboardList className="h-8 w-8 text-blue-500" />
            <span className="font-medium">Inventur</span>
            <span className="text-xs text-gray-400">Bestand prüfen</span>
          </Link>

          <Link href="/mobile/transfer" className="bg-gray-800 rounded-lg p-4 flex flex-col items-center gap-2 border border-gray-700 hover:border-purple-500 transition-colors">
            <ArrowUpDown className="h-8 w-8 text-purple-500" />
            <span className="font-medium">Umlagerung</span>
            <span className="text-xs text-gray-400">Produkte verschieben</span>
          </Link>

          <Link href="/mobile/locations" className="bg-gray-800 rounded-lg p-4 flex flex-col items-center gap-2 border border-gray-700 hover:border-indigo-500 transition-colors">
            <MapPin className="h-8 w-8 text-indigo-500" />
            <span className="font-medium">Lagerplätze</span>
            <span className="text-xs text-gray-400">{stats.totalLocations} Plätze</span>
          </Link>

          <Link href="/mobile/barcode-learning" className="bg-gray-800 rounded-lg p-4 flex flex-col items-center gap-2 border border-gray-700 hover:border-yellow-500 transition-colors relative">
            <Database className="h-8 w-8 text-yellow-500" />
            <span className="font-medium">Barcodes</span>
            <span className="text-xs text-gray-400">Verwalten</span>
            {stats.unknownBarcodes > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center">
                {stats.unknownBarcodes}
              </span>
            )}
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="mt-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Barcode Status
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Produkte mit Barcode</span>
              <span className="font-medium">{stats.productsWithBarcode} / {stats.totalProducts}</span>
            </div>
            <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-green-500 h-full transition-all"
                style={{ width: `${stats.totalProducts > 0 ? (stats.productsWithBarcode / stats.totalProducts * 100) : 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-right">
              {stats.totalProducts > 0 ? Math.round(stats.productsWithBarcode / stats.totalProducts * 100) : 0}% zugeordnet
            </p>
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
          <Link href="/mobile/locations" className="flex flex-col items-center gap-1 py-2 text-gray-400">
            <MapPin className="h-6 w-6" />
            <span className="text-xs">Plätze</span>
          </Link>
        </div>
      </div>
    </div>
  );
}