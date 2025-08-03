'use client';

import { useState, useEffect } from 'react';
import { 
  Package, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle,
  Clock,
  ArrowRight,
  BarChart3,
  Users,
  ShoppingCart,
  DollarSign,
  Warehouse,
  AlertTriangle,
  Euro
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStock: 0,
    totalValue: 0,
    recentMovements: 0,
    totalOrders: 0,
    openOrders: 0,
    storageLocations: 0
  });
  const [recentProducts, setRecentProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch products
      const { data: products } = await supabase
        .from('products')
        .select('*');
      
      // Fetch orders
      const { data: orders } = await supabase
        .from('orders')
        .select('*');

      // Fetch storage locations
      const { data: locations } = await supabase
        .from('storage_locations')
        .select('*')
        .eq('is_active', true);

      if (products) {
        const lowStockCount = products.filter(p => p.current_stock <= p.min_stock).length;
        const totalValue = products.reduce((sum, p) => sum + (p.current_stock * p.price), 0);
        
        setStats({
          totalProducts: products.length,
          lowStock: lowStockCount,
          totalValue: totalValue,
          recentMovements: 0,
          totalOrders: orders?.length || 0,
          openOrders: orders?.filter(o => !o.fulfillment_status || o.fulfillment_status === 'unfulfilled').length || 0,
          storageLocations: locations?.length || 0
        });

        setRecentProducts(products.slice(0, 5));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, trend, onClick }) => (
    <div 
      className={`bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="text-white" size={24} />
        </div>
        {trend && (
          <span className={`text-sm font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <h3 className="text-gray-600 text-sm font-medium">{title}</h3>
      <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
    </div>
  );

  const QuickAction = ({ title, description, icon: Icon, href }) => (
    <button
      onClick={() => router.push(href)}
      className="flex items-center p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-all hover:scale-105 w-full text-left"
    >
      <div className="p-3 bg-blue-100 rounded-lg mr-4">
        <Icon className="text-blue-600" size={20} />
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-gray-800">{title}</h4>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      <ArrowRight className="text-gray-400" size={20} />
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Lade Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Willkommen zurück! 🎆
        </h1>
        <p className="text-gray-600">
          Hier ist deine Lagerübersicht vom {new Date().toLocaleDateString('de-DE', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Produkte Gesamt"
          value={stats.totalProducts}
          icon={Package}
          color="bg-blue-500"
          onClick={() => router.push('/products')}
        />
        <StatCard
          title="Kritische Bestände"
          value={stats.lowStock}
          icon={AlertTriangle}
          color="bg-red-500"
          onClick={() => router.push('/products')}
        />
        <StatCard
          title="Offene Bestellungen"
          value={stats.openOrders}
          icon={ShoppingCart}
          color="bg-orange-500"
          onClick={() => router.push('/order-picking')}
        />
        <StatCard
          title="Lagerwert"
          value={`€${stats.totalValue.toFixed(0)}`}
          icon={Euro}
          color="bg-green-500"
        />
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Schnellzugriff</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickAction
            title="Produkt hinzufügen"
            description="Neues Produkt anlegen"
            icon={Package}
            href="/products"
          />
          <QuickAction
            title="Kommissionierung"
            description="Bestellungen bearbeiten"
            icon={ShoppingCart}
            href="/order-picking"
          />
          <QuickAction
            title="Shopify Sync"
            description="Daten synchronisieren"
            icon={TrendingUp}
            href="/shopify-sync"
          />
          <QuickAction
            title="Lagerplätze"
            description="Plätze verwalten"
            icon={Warehouse}
            href="/storage-locations"
          />
        </div>
      </div>

      {/* Recent Products */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Aktuelle Produkte</h2>
          <button
            onClick={() => router.push('/products')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
          >
            Alle anzeigen
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produkt</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bestand</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{product.name}</td>
                  <td className="px-4 py-3 text-sm font-mono">{product.sku}</td>
                  <td className="px-4 py-3 text-sm">{product.current_stock}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      product.current_stock === 0
                        ? 'bg-red-100 text-red-800'
                        : product.current_stock <= product.min_stock
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {product.current_stock === 0
                        ? 'Ausverkauft'
                        : product.current_stock <= product.min_stock
                        ? 'Niedrig'
                        : 'Verfügbar'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}