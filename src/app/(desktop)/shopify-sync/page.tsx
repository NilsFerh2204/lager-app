'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  ShoppingBag, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Package,
  ShoppingCart,
  Clock,
  TrendingUp,
  Download,
  Upload,
  Eye,
  DollarSign,
  Users,
  Truck
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function ShopifySyncPage() {
  const [syncing, setSyncing] = useState(false)
  const [syncingOrders, setSyncingOrders] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [stats, setStats] = useState({
    totalProducts: 0,
    syncedProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    fulfilledOrders: 0,
    totalRevenue: 0
  })
  const [orders, setOrders] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products')

  useEffect(() => {
    loadStats()
    loadOrders()
  }, [])

  const loadStats = async () => {
    try {
      // Produkte Stats
      const { data: products } = await supabase
        .from('products')
        .select('shopify_id')
      
      const syncedProducts = products?.filter(p => p.shopify_id).length || 0
      
      // Orders Stats
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
      
      const pending = ordersData?.filter(o => o.fulfillment_status === 'unfulfilled').length || 0
      const fulfilled = ordersData?.filter(o => o.fulfillment_status === 'fulfilled').length || 0
      const revenue = ordersData?.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0) || 0
      
      setStats({
        totalProducts: products?.length || 0,
        syncedProducts,
        totalOrders: ordersData?.length || 0,
        pendingOrders: pending,
        fulfilledOrders: fulfilled,
        totalRevenue: revenue
      })
    } catch (error) {
      console.error('Fehler beim Laden der Statistiken:', error)
    }
  }

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (
              name,
              sku
            )
          )
        `)
        .order('shopify_created_at', { ascending: false })
        .limit(50)
      
      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('Fehler beim Laden der Bestellungen:', error)
    }
  }

  const syncProducts = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/shopify/sync')
      const data = await response.json()
      
      if (data.success) {
        toast.success(`${data.productsCount} Produkte synchronisiert!`)
        setLastSync(new Date())
        loadStats()
      } else {
        toast.error('Fehler beim Synchronisieren')
      }
    } catch (error) {
      console.error('Sync error:', error)
      toast.error('Synchronisierung fehlgeschlagen')
    } finally {
      setSyncing(false)
    }
  }

  const syncOrders = async () => {
    setSyncingOrders(true)
    try {
      const response = await fetch('/api/shopify/sync-orders')
      const data = await response.json()
      
      if (data.success) {
        toast.success(`${data.ordersCount} Bestellungen synchronisiert!`)
        setLastSync(new Date())
        loadStats()
        loadOrders()
      } else {
        toast.error('Fehler beim Synchronisieren der Bestellungen')
      }
    } catch (error) {
      console.error('Orders sync error:', error)
      toast.error('Bestellungs-Synchronisierung fehlgeschlagen')
    } finally {
      setSyncingOrders(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-br from-green-400 to-green-600 p-3 rounded-lg">
                <ShoppingBag className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Shopify Synchronisation</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Synchronisiere Produkte und Bestellungen mit deinem Shopify Store
                </p>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={syncProducts}
                disabled={syncing}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
                <span>Produkte sync</span>
              </button>
              
              <button
                onClick={syncOrders}
                disabled={syncingOrders}
                className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Download className={`w-5 h-5 ${syncingOrders ? 'animate-spin' : ''}`} />
                <span>Bestellungen sync</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <Package className="w-8 h-8 text-blue-500" />
              <span className="text-sm text-gray-500">Produkte</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalProducts}</p>
            <p className="text-sm text-gray-500">
              {stats.syncedProducts} synchronisiert
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <ShoppingCart className="w-8 h-8 text-green-500" />
              <span className="text-sm text-gray-500">Bestellungen</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalOrders}</p>
            <p className="text-sm text-gray-500">Gesamt</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <Clock className="w-8 h-8 text-orange-500" />
              <span className="text-sm text-gray-500">Offen</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">{stats.pendingOrders}</p>
            <p className="text-sm text-gray-500">Zu bearbeiten</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <span className="text-sm text-gray-500">Erfüllt</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.fulfilledOrders}</p>
            <p className="text-sm text-gray-500">Abgeschlossen</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8 text-green-600" />
              <span className="text-sm text-gray-500">Umsatz</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
            <p className="text-sm text-gray-500">Gesamtumsatz</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b">
            <div className="flex">
              <button
                onClick={() => setActiveTab('products')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'products'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Produkte
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'orders'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Bestellungen
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'products' ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Produkt-Synchronisation
                </h3>
                <p className="text-gray-500 mb-6">
                  {stats.syncedProducts} von {stats.totalProducts} Produkten sind mit Shopify synchronisiert
                </p>
                <button
                  onClick={syncProducts}
                  disabled={syncing}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {syncing ? 'Synchronisiere...' : 'Jetzt synchronisieren'}
                </button>
              </div>
            ) : (
              <div>
                {/* Orders Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Bestellung
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Kunde
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Datum
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Artikel
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Betrag
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Aktionen
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {orders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                            <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                            <p>Keine Bestellungen gefunden</p>
                            <button
                              onClick={syncOrders}
                              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                            >
                              Bestellungen synchronisieren
                            </button>
                          </td>
                        </tr>
                      ) : (
                        orders.map((order) => (
                          <tr key={order.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {order.order_number}
                                </p>
                                <p className="text-xs text-gray-500">
                                  #{order.shopify_id}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm text-gray-900">
                                  {order.customer_name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {order.customer_email}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {formatDate(order.shopify_created_at)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                order.fulfillment_status === 'fulfilled'
                                  ? 'bg-green-100 text-green-700'
                                  : order.fulfillment_status === 'partial'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {order.fulfillment_status === 'fulfilled' ? 'Erfüllt' :
                                 order.fulfillment_status === 'partial' ? 'Teilweise' : 'Offen'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-sm">
                              {order.order_items?.length || 0}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="font-medium text-gray-900">
                                {formatCurrency(order.total_price)}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => {
                                  // Hier könntest du eine Detail-Ansicht öffnen
                                  console.log('View order:', order)
                                }}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Last Sync Info */}
        {lastSync && (
          <div className="mt-6 text-center text-sm text-gray-500">
            Letzte Synchronisation: {formatDate(lastSync.toISOString())}
          </div>
        )}
      </div>
    </div>
  )
}