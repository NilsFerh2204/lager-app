'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  ShoppingCart,
  TrendingUp,
  AlertCircle,
  Users,
  DollarSign,
  BarChart,
  Clock,
  CheckCircle,
  XCircle,
  Warehouse,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Box
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import Image from 'next/image';

interface DashboardStats {
  totalProducts: number;
  lowStockProducts: number;
  totalOrders: number;
  pendingOrders: number;
  totalValue: number;
  criticalItems: any[];
  recentOrders: any[];
  topProducts: any[];
}

interface ShopInfo {
  name: string;
  email: string;
  domain: string;
  currency: string;
  shop_owner: string;
  image?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    lowStockProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalValue: 0,
    criticalItems: [],
    recentOrders: [],
    topProducts: []
  });
  const [loading, setLoading] = useState(true);
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    fetchDashboardData();
    fetchShopInfo();
  }, []);

  const fetchShopInfo = async () => {
    try {
      const response = await fetch('/api/shopify/shop-info');
      if (response.ok) {
        const data = await response.json();
        setShopInfo(data);
        
        // Shop-Info in localStorage speichern für andere Komponenten
        if (data.image) {
          localStorage.setItem('shop_logo', data.image);
        }
        localStorage.setItem('shop_name', data.name);
      }
    } catch (error) {
      console.error('Error fetching shop info:', error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      // Produkte abrufen
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*');

      if (productsError) throw productsError;

      // Bestellungen abrufen
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*, order_items(*)');

      if (ordersError) throw ordersError;

      // Statistiken berechnen
      const totalProducts = products?.length || 0;
      const lowStockProducts = products?.filter(p => p.current_stock <= p.min_stock).length || 0;
      const criticalItems = products?.filter(p => p.current_stock <= p.min_stock)
        .sort((a, b) => a.current_stock - b.current_stock)
        .slice(0, 5) || [];

      const totalOrders = orders?.length || 0;
      const pendingOrders = orders?.filter(o => o.fulfillment_status === 'unfulfilled').length || 0;
      
      const totalValue = products?.reduce((sum, product) => 
        sum + (product.current_stock * product.price), 0) || 0;

      const recentOrders = orders?.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ).slice(0, 5) || [];

      // Top Produkte nach Wert
      const topProducts = products?.map(p => ({
        ...p,
        totalValue: p.current_stock * p.price
      }))
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 5) || [];

      setStats({
        totalProducts,
        lowStockProducts,
        totalOrders,
        pendingOrders,
        totalValue,
        criticalItems,
        recentOrders,
        topProducts
      });

      // Last Sync Time
      const lastUpdate = products?.reduce((latest, product) => {
        const productDate = new Date(product.updated_at);
        return productDate > latest ? productDate : latest;
      }, new Date(0));
      
      if (lastUpdate && lastUpdate > new Date(0)) {
        setLastSync(lastUpdate);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Fehler beim Laden der Dashboard-Daten');
    } finally {
      setLoading(false);
    }
  };

  const syncWithShopify = async () => {
    toast.loading('Synchronisiere mit Shopify...', { id: 'sync' });
    try {
      const response = await fetch('/api/shopify/sync', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(data.message || 'Synchronisation erfolgreich!', { id: 'sync' });
        fetchDashboardData();
      } else {
        toast.error(data.error || 'Synchronisation fehlgeschlagen', { id: 'sync' });
      }
    } catch (error) {
      toast.error('Fehler bei der Synchronisation', { id: 'sync' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Lade Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Shop Info Header */}
        {shopInfo && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {shopInfo.image && (
                  <img
                    src={shopInfo.image}
                    alt={shopInfo.name}
                    className="h-16 w-auto object-contain"
                  />
                )}
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">{shopInfo.name}</h1>
                  <p className="text-sm text-gray-600">{shopInfo.domain}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Letzte Synchronisation</p>
                  <p className="text-sm font-medium">
                    {lastSync ? lastSync.toLocaleString('de-DE') : 'Nie'}
                  </p>
                </div>
                <button
                  onClick={syncWithShopify}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <RefreshCw size={20} />
                  Sync
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Products */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Produkte Gesamt</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalProducts}</p>
              </div>
              <Package className="h-12 w-12 text-blue-600" />
            </div>
          </div>

          {/* Low Stock */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Niedriger Bestand</p>
                <p className="text-3xl font-bold text-orange-600">{stats.lowStockProducts}</p>
              </div>
              <AlertCircle className="h-12 w-12 text-orange-600" />
            </div>
          </div>

          {/* Pending Orders */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Offene Bestellungen</p>
                <p className="text-3xl font-bold text-purple-600">{stats.pendingOrders}</p>
              </div>
              <ShoppingCart className="h-12 w-12 text-purple-600" />
            </div>
          </div>

          {/* Total Value */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Lagerwert</p>
                <p className="text-3xl font-bold text-green-600">
                  €{stats.totalValue.toFixed(2)}
                </p>
              </div>
              <DollarSign className="h-12 w-12 text-green-600" />
            </div>
          </div>
        </div>

        {/* Critical Items & Recent Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Critical Stock Items */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <AlertCircle className="text-red-600" size={20} />
                Kritischer Lagerbestand
              </h2>
            </div>
            <div className="p-6">
              {stats.criticalItems.length === 0 ? (
                <p className="text-gray-500">Alle Produkte haben ausreichend Bestand</p>
              ) : (
                <div className="space-y-3">
                  {stats.criticalItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{item.name}</p>
                        <p className="text-sm text-gray-600">SKU: {item.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">{item.current_stock} Stk</p>
                        <p className="text-xs text-gray-500">Min: {item.min_stock}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Clock className="text-blue-600" size={20} />
                Letzte Bestellungen
              </h2>
            </div>
            <div className="p-6">
              {stats.recentOrders.length === 0 ? (
                <p className="text-gray-500">Keine Bestellungen vorhanden</p>
              ) : (
                <div className="space-y-3">
                  {stats.recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">#{order.order_number}</p>
                        <p className="text-sm text-gray-600">{order.customer_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">€{order.total_price}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          order.fulfillment_status === 'fulfilled' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {order.fulfillment_status === 'fulfilled' ? 'Erfüllt' : 'Offen'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Top Products by Value */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp className="text-green-600" size={20} />
              Top Produkte nach Lagerwert
            </h2>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-sm font-medium text-gray-600">Produkt</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-600">Bestand</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-600">Preis</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-600">Gesamtwert</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topProducts.map((product) => (
                    <tr key={product.id} className="border-b hover:bg-gray-50">
                      <td className="py-3">
                        <div>
                          <p className="font-medium text-gray-800">{product.name}</p>
                          <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                        </div>
                      </td>
                      <td className="text-right py-3">{product.current_stock}</td>
                      <td className="text-right py-3">€{product.price.toFixed(2)}</td>
                      <td className="text-right py-3 font-bold text-green-600">
                        €{product.totalValue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}