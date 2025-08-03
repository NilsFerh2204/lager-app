'use client';

import { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  User,
  MapPin,
  Calendar,
  DollarSign,
  RefreshCw,
  Search,
  Box,
  AlertCircle,
  Eye,
  ChevronRight,
  Warehouse,
  TrendingUp,
  Info,
  Route,
  ArrowRight,
  Printer,
  Check,
  X,
  Barcode,
  Euro
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function OrderPickingPage() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filterStatus, setFilterStatus] = useState('unfulfilled'); // Default auf unfulfilled
  const [searchTerm, setSearchTerm] = useState('');
  const [pickerName, setPickerName] = useState('');
  const [showPickingModal, setShowPickingModal] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [products, setProducts] = useState({});
  const [sortBy, setSortBy] = useState('date_desc'); // Neue State für Sortierung
  const [dateFilter, setDateFilter] = useState('today'); // Neue State für Datumsfilter

  useEffect(() => {
    fetchOrders(); // fetchOrders lädt jetzt auch Products
    const savedPicker = localStorage.getItem('pickerName');
    if (savedPicker) setPickerName(savedPicker);
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, current_stock, storage_location, price');
      
      if (!error && data) {
        const productMap = {};
        data.forEach(p => {
          productMap[p.id] = p;
          if (p.sku) productMap[p.sku] = p;
        });
        setProducts(productMap);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchOrders = async () => {
    console.log('Fetching orders...');
    
    try {
      // Erst Products laden wenn noch nicht vorhanden
      if (Object.keys(products).length === 0) {
        await fetchProducts();
      }

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Orders error:', ordersError);
        throw ordersError;
      }

      console.log(`Found ${ordersData?.length} orders`);

      if (ordersData && ordersData.length > 0) {
        const orderIds = ordersData.map(o => o.id);
        
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds);

        if (itemsError) {
          console.error('Items error:', itemsError);
        }

        console.log(`Found ${itemsData?.length} items`);

        // Lade aktuelle Produktdaten
        const { data: productsData } = await supabase
          .from('products')
          .select('id, name, sku, current_stock, storage_location, price');
        
        const productMap = {};
        if (productsData) {
          productsData.forEach(p => {
            productMap[p.id] = p;
            if (p.sku) {
              // Speichere SKU in verschiedenen Varianten für besseres Matching
              productMap[p.sku] = p;
              productMap[p.sku.toUpperCase()] = p;
              productMap[p.sku.toLowerCase()] = p;
              // Entferne Leerzeichen für flexibleres Matching
              productMap[p.sku.replace(/\s+/g, '')] = p;
            }
          });
        }
        
        console.log('Product Map loaded:', Object.keys(productMap).length, 'products');

        const ordersWithItems = ordersData.map(order => {
          const items = (itemsData || []).filter(item => item.order_id === order.id);
          return {
            ...order,
            order_items: items.map(item => {
              // Versuche Produkt über verschiedene Methoden zu finden
              let product = null;
              
              // 1. Versuche über product_id
              if (item.product_id) {
                product = productMap[item.product_id];
              }
              
              // 2. Falls nicht gefunden, versuche über SKU
              if (!product && item.sku) {
                product = productMap[item.sku] || 
                         productMap[item.sku.toUpperCase()] || 
                         productMap[item.sku.toLowerCase()] ||
                         productMap[item.sku.replace(/\s+/g, '')];
              }
              
              // Debug-Log für fehlende Zuordnungen
              if (!product && item.sku) {
                console.warn(`Produkt nicht gefunden für SKU: ${item.sku}`);
              }
              
              return {
                ...item,
                picked: false,
                location: product?.storage_location || 'Nicht zugeordnet',
                stock: product?.current_stock || 0,
                product_name: product?.name || item.title,
                product_price: product?.price || item.price || 0
              };
            })
          };
        });

        setOrders(ordersWithItems);
        setProducts(productMap);
        console.log('Orders with items:', ordersWithItems);
      } else {
        setOrders([]);
      }
      
    } catch (error) {
      console.error('Error:', error);
      toast.error('Fehler beim Laden der Bestellungen');
    } finally {
      setLoading(false);
    }
  };

  const syncOrdersFromShopify = async () => {
    setSyncing(true);
    
    try {
      const response = await fetch('/api/shopify/sync-orders');
      const data = await response.json();
      
      if (data.success) {
        const message = `${data.ordersCount} unfulfilled Bestellungen synchronisiert!
        ${data.totalOrders ? `(${data.totalOrders} geprüft, nur unfulfilled importiert)` : ''}`;
        toast.success(message, { duration: 5000 });
        setTimeout(() => fetchOrders(), 1000);
      } else {
        toast.error(data.error || 'Fehler bei der Synchronisation');
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Fehler bei der Synchronisation');
    } finally {
      setSyncing(false);
    }
  };

  const viewOrderDetails = (order) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  const startPicking = (order) => {
    if (!pickerName) {
      toast.error('Bitte geben Sie Ihren Namen ein');
      return;
    }
    localStorage.setItem('pickerName', pickerName);
    
    // Sortiere Artikel nach Lagerplatz für optimale Route
    const sortedItems = [...(order.order_items || [])].sort((a, b) => {
      const locA = a.location || 'ZZZ';
      const locB = b.location || 'ZZZ';
      return locA.localeCompare(locB);
    });
    
    setSelectedOrder({
      ...order,
      order_items: sortedItems
    });
    setShowOrderDetails(false);
    setShowPickingModal(true);
  };

  const toggleItemPicked = (orderId, itemId) => {
    setOrders(prevOrders => 
      prevOrders.map(order => {
        if (order.id === orderId) {
          return {
            ...order,
            order_items: order.order_items.map(item =>
              item.id === itemId ? { ...item, picked: !item.picked } : item
            )
          };
        }
        return order;
      })
    );

    if (selectedOrder?.id === orderId) {
      setSelectedOrder(prev => ({
        ...prev,
        order_items: prev.order_items.map(item =>
          item.id === itemId ? { ...item, picked: !item.picked } : item
        )
      }));
    }
  };

  const completeOrder = async (orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const allPicked = order.order_items?.every(item => item.picked);
    if (!allPicked) {
      toast.error('Bitte alle Artikel kommissionieren');
      return;
    }

    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          fulfillment_status: 'fulfilled',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast.success('Bestellung abgeschlossen!');
      setShowPickingModal(false);
      fetchOrders();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Fehler beim Abschließen');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'unfulfilled': return 'bg-yellow-100 text-yellow-800';
      case 'fulfilled': return 'bg-green-100 text-green-800';
      case 'partial': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'unfulfilled': return 'Offen';
      case 'fulfilled': return 'Erfüllt';
      case 'partial': return 'Teilweise';
      default: return status || 'Offen';
    }
  };

  const calculateOrderValue = (items) => {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const getOptimizedRoute = (items) => {
    if (!items || items.length === 0) return [];
    
    // Gruppiere nach Lagerplatz
    const locationGroups = {};
    items.forEach(item => {
      const loc = item.location || 'Nicht zugeordnet';
      if (!locationGroups[loc]) {
        locationGroups[loc] = [];
      }
      locationGroups[loc].push(item);
    });

    // Sortiere Lagerplätze alphabetisch/numerisch
    const sortedLocations = Object.keys(locationGroups).sort();
    
    return sortedLocations.map(location => ({
      location,
      items: locationGroups[location],
      totalItems: locationGroups[location].reduce((sum, item) => sum + item.quantity, 0)
    }));
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      (order.order_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customer_email || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      filterStatus === 'all' || 
      (filterStatus === 'unfulfilled' && (!order.fulfillment_status || order.fulfillment_status === 'unfulfilled')) ||
      (filterStatus === 'fulfilled' && order.fulfillment_status === 'fulfilled') ||
      (filterStatus === 'partial' && order.fulfillment_status === 'partial');
    
    // Datumsfilter
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const orderDate = new Date(order.shopify_created_at || order.created_at);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      switch(dateFilter) {
        case 'today':
          matchesDate = orderDate.toDateString() === today.toDateString();
          break;
        case 'yesterday':
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          matchesDate = orderDate.toDateString() === yesterday.toDateString();
          break;
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          matchesDate = orderDate >= weekAgo;
          break;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          matchesDate = orderDate >= monthAgo;
          break;
      }
    }
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  // Sortierung
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    switch(sortBy) {
      case 'date_desc':
        return new Date(b.shopify_created_at || b.created_at).getTime() - 
               new Date(a.shopify_created_at || a.created_at).getTime();
      case 'date_asc':
        return new Date(a.shopify_created_at || a.created_at).getTime() - 
               new Date(b.shopify_created_at || b.created_at).getTime();
      case 'order_number':
        return (a.order_number || '').localeCompare(b.order_number || '');
      case 'customer':
        return (a.customer_name || '').localeCompare(b.customer_name || '');
      case 'value_desc':
        return parseFloat(b.total_price || 0) - parseFloat(a.total_price || 0);
      case 'value_asc':
        return parseFloat(a.total_price || 0) - parseFloat(b.total_price || 0);
      case 'items':
        return (b.order_items?.length || 0) - (a.order_items?.length || 0);
      default:
        return 0;
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Lade Bestellungen...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <Box className="text-orange-600" />
              Kommissionierung & Bestellverwaltung
            </h1>
            <button
              onClick={syncOrdersFromShopify}
              disabled={syncing}
              className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 ${
                syncing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
              Shopify Sync
            </button>
          </div>

          {/* Picker Name */}
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kommissionierer Name
            </label>
            <input
              type="text"
              value={pickerName}
              onChange={(e) => setPickerName(e.target.value)}
              placeholder="Ihr Name..."
              className="w-full md:w-64 px-3 py-2 border rounded-lg"
            />
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col gap-4">
            {/* Erste Zeile: Suche und Hauptfilter */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Suche nach Bestellnummer, Kunde oder Email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="unfulfilled">🟡 Offene Bestellungen</option>
                <option value="partial">🟠 Teilweise erfüllt</option>
                <option value="fulfilled">✅ Erfüllte Bestellungen</option>
                <option value="all">Alle Bestellungen</option>
              </select>
            </div>

            {/* Zweite Zeile: Datum und Sortierung */}
            <div className="flex flex-col md:flex-row gap-4">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="all">📅 Alle Zeiträume</option>
                <option value="today">Heute</option>
                <option value="yesterday">Gestern</option>
                <option value="week">Letzte 7 Tage</option>
                <option value="month">Letzter Monat</option>
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="date_desc">↓ Neueste zuerst</option>
                <option value="date_asc">↑ Älteste zuerst</option>
                <option value="order_number">🔢 Bestellnummer</option>
                <option value="customer">👤 Kundenname</option>
                <option value="value_desc">💰 Höchster Wert</option>
                <option value="value_asc">💰 Niedrigster Wert</option>
                <option value="items">📦 Anzahl Artikel</option>
              </select>

              {/* Quick Actions */}
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => {
                    setFilterStatus('unfulfilled');
                    setDateFilter('today');
                    setSortBy('date_asc');
                  }}
                  className="px-3 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 text-sm font-medium"
                >
                  📋 Heutige Picks
                </button>
                <button
                  onClick={() => {
                    setFilterStatus('unfulfilled');
                    setDateFilter('all');
                    setSortBy('value_desc');
                  }}
                  className="px-3 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 text-sm font-medium"
                >
                  💎 High Value
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-yellow-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Offen</div>
              <div className="text-2xl font-bold text-yellow-600">
                {orders.filter(o => !o.fulfillment_status || o.fulfillment_status === 'unfulfilled').length}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Erfüllt</div>
              <div className="text-2xl font-bold text-green-600">
                {orders.filter(o => o.fulfillment_status === 'fulfilled').length}
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Gesamtwert</div>
              <div className="text-2xl font-bold text-blue-600">
                €{orders.reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0).toFixed(0)}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Gesamt</div>
              <div className="text-2xl font-bold">{orders.length}</div>
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {/* Anzahl der Ergebnisse */}
          {sortedOrders.length > 0 && (
            <div className="text-sm text-gray-600 px-2">
              Zeige {sortedOrders.length} von {orders.length} Bestellungen
              {searchTerm && ` (gefiltert nach "${searchTerm}")`}
            </div>
          )}
          
          {sortedOrders.map((order) => (
            <div key={order.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    #{order.order_number || order.shopify_id || 'Keine Nummer'}
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(order.fulfillment_status)}`}>
                      {getStatusText(order.fulfillment_status)}
                    </span>
                  </h3>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <User size={14} />
                      {order.customer_name || 'Kein Name'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {new Date(order.created_at).toLocaleDateString('de-DE')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Euro size={14} />
                      {parseFloat(order.total_price || 0).toFixed(2)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Package size={14} />
                      {order.order_items?.length || 0} Artikel
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => viewOrderDetails(order)}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Eye size={18} />
                    Details
                  </button>
                  {(!order.fulfillment_status || order.fulfillment_status === 'unfulfilled') && (
                    <button
                      onClick={() => startPicking(order)}
                      className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2"
                    >
                      <Package size={18} />
                      Kommissionieren
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Info */}
              {order.order_items && order.order_items.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Artikel-Übersicht: </span>
                    {order.order_items.slice(0, 3).map((item, idx) => (
                      <span key={idx} className="ml-2">
                        {item.quantity}x {item.title || 'Artikel'}
                        {idx < 2 && idx < order.order_items.length - 1 && ','}
                      </span>
                    ))}
                    {order.order_items.length > 3 && ` +${order.order_items.length - 3} weitere`}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Order Details Modal */}
        {showOrderDetails && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Info className="text-blue-600" />
                  Bestelldetails #{selectedOrder.order_number}
                </h2>
                <button
                  onClick={() => setShowOrderDetails(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Customer & Order Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Kundeninformationen
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-600">Name:</span> <span className="font-medium">{selectedOrder.customer_name || 'N/A'}</span></div>
                    <div><span className="text-gray-600">Email:</span> <span className="font-medium">{selectedOrder.customer_email || 'N/A'}</span></div>
                    <div><span className="text-gray-600">Telefon:</span> <span className="font-medium">{selectedOrder.customer_phone || 'N/A'}</span></div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Lieferadresse
                  </h3>
                  <div className="space-y-1 text-sm">
                    <div>{selectedOrder.shipping_name || selectedOrder.customer_name}</div>
                    <div>{selectedOrder.shipping_address1}</div>
                    {selectedOrder.shipping_address2 && <div>{selectedOrder.shipping_address2}</div>}
                    <div>{selectedOrder.shipping_zip} {selectedOrder.shipping_city}</div>
                    <div>{selectedOrder.shipping_country}</div>
                  </div>
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Bestellwert</div>
                    <div className="text-xl font-bold text-blue-600">€{parseFloat(selectedOrder.total_price || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Artikel</div>
                    <div className="text-xl font-bold">{selectedOrder.order_items?.length || 0}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Gesamtmenge</div>
                    <div className="text-xl font-bold">
                      {selectedOrder.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Status</div>
                    <div className={`inline-block px-2 py-1 rounded text-sm font-bold ${getStatusColor(selectedOrder.fulfillment_status)}`}>
                      {getStatusText(selectedOrder.fulfillment_status)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Products Table */}
              <div className="mb-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Bestellte Produkte
                </h3>
                {selectedOrder.order_items && selectedOrder.order_items.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full bg-white border rounded-lg">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produkt</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Menge</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Preis</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gesamt</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Lagerplatz</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Bestand</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {selectedOrder.order_items.map((item, idx) => (
                            <tr key={item.id || idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm">{item.title || item.product_name}</td>
                              <td className="px-4 py-3 text-sm font-mono">{item.sku || 'N/A'}</td>
                              <td className="px-4 py-3 text-sm text-center font-medium">{item.quantity}</td>
                              <td className="px-4 py-3 text-sm text-right">€{parseFloat(item.price || 0).toFixed(2)}</td>
                              <td className="px-4 py-3 text-sm text-right font-medium">€{(item.quantity * parseFloat(item.price || 0)).toFixed(2)}</td>
                              <td className="px-4 py-3 text-sm text-center">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  item.location && item.location !== 'Nicht zugeordnet' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {item.location || 'Nicht zugeordnet'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-center">
                                <span className={`font-medium ${item.stock < item.quantity ? 'text-red-600' : 'text-green-600'}`}>
                                  {item.stock || 0}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t-2">
                          <tr>
                            <td colSpan={2} className="px-4 py-3 text-sm font-semibold">Gesamt</td>
                            <td className="px-4 py-3 text-sm text-center font-bold">
                              {selectedOrder.order_items.reduce((sum, item) => sum + item.quantity, 0)}
                            </td>
                            <td className="px-4 py-3"></td>
                            <td className="px-4 py-3 text-right font-bold text-lg">
                              €{selectedOrder.order_items.reduce((sum, item) => sum + (item.quantity * parseFloat(item.price || 0)), 0).toFixed(2)}
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
                    Keine Artikel in dieser Bestellung vorhanden
                  </div>
                )}
              </div>

              {/* Other Open Orders from Same Customer */}
              {(() => {
                const otherOpenOrders = orders.filter(o => 
                  o.customer_email === selectedOrder.customer_email && 
                  o.id !== selectedOrder.id &&
                  (!o.fulfillment_status || o.fulfillment_status === 'unfulfilled')
                );
                
                if (otherOpenOrders.length > 0) {
                  return (
                    <div className="mb-6">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                        Weitere offene Bestellungen von {selectedOrder.customer_name}
                      </h3>
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="space-y-3">
                          {otherOpenOrders.map(order => (
                            <div key={order.id} className="flex justify-between items-center bg-white rounded-lg p-3">
                              <div>
                                <span className="font-medium">#{order.order_number}</span>
                                <span className="ml-3 text-sm text-gray-600">
                                  vom {new Date(order.created_at).toLocaleDateString('de-DE')}
                                </span>
                                <span className="ml-3 text-sm">
                                  {order.order_items?.length || 0} Artikel - €{parseFloat(order.total_price || 0).toFixed(2)}
                                </span>
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedOrder(order);
                                }}
                                className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
                              >
                                Anzeigen
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 text-sm text-orange-800">
                          <strong>Tipp:</strong> Kombinieren Sie die Kommissionierung für effizientere Abläufe
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Optimized Route */}
              <div className="mb-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Route className="w-4 h-4" />
                  Optimierte Kommissionier-Route
                </h3>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex flex-wrap gap-2 items-center">
                    {getOptimizedRoute(selectedOrder.order_items).map((location, idx) => (
                      <div key={idx} className="flex items-center">
                        <div className="bg-white rounded-lg px-3 py-2 border border-yellow-300">
                          <div className="font-medium text-sm">{location.location}</div>
                          <div className="text-xs text-gray-600">
                            {location.items.length} Artikel ({location.totalItems} Stück)
                          </div>
                        </div>
                        {idx < getOptimizedRoute(selectedOrder.order_items).length - 1 && (
                          <ArrowRight className="w-4 h-4 mx-2 text-yellow-600" />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-sm text-yellow-800">
                    <strong>Tipp:</strong> Folgen Sie dieser Route für effizientes Kommissionieren
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowOrderDetails(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Schließen
                </button>
                {(!selectedOrder.fulfillment_status || selectedOrder.fulfillment_status === 'unfulfilled') && (
                  <button
                    onClick={() => startPicking(selectedOrder)}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2"
                  >
                    <Package size={18} />
                    Kommissionierung starten
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Picking Modal */}
        {showPickingModal && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Box className="text-orange-600" />
                  Kommissionierung #{selectedOrder.order_number}
                </h2>
                <button
                  onClick={() => setShowPickingModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Picker Info */}
              <div className="bg-blue-50 rounded-lg p-3 mb-4">
                <div className="text-sm">
                  <span className="text-gray-600">Kommissionierer:</span> 
                  <span className="font-medium ml-2">{pickerName}</span>
                  <span className="text-gray-600 ml-4">Start:</span> 
                  <span className="font-medium ml-2">{new Date().toLocaleString('de-DE')}</span>
                </div>
              </div>

              {/* Route Info */}
              <div className="bg-yellow-50 rounded-lg p-3 mb-4">
                <div className="text-sm font-medium text-yellow-800">
                  Optimierte Route: 
                  {getOptimizedRoute(selectedOrder.order_items).map((loc, idx) => (
                    <span key={idx}>
                      {idx > 0 && ' → '}
                      <span className="font-bold">{loc.location}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Items grouped by location */}
              <div className="space-y-6 mb-6">
                {getOptimizedRoute(selectedOrder.order_items).map((locationGroup, groupIdx) => (
                  <div key={groupIdx}>
                    <h4 className="font-semibold mb-3 flex items-center gap-2 text-lg">
                      <Warehouse className="w-5 h-5 text-gray-600" />
                      Lagerplatz: {locationGroup.location}
                    </h4>
                    <div className="space-y-3 ml-7">
                      {locationGroup.items.map((item) => (
                        <div
                          key={item.id}
                          className={`border rounded-lg p-4 ${
                            item.picked ? 'bg-green-50 border-green-300' : 'bg-white hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <input
                                type="checkbox"
                                checked={item.picked || false}
                                onChange={() => toggleItemPicked(selectedOrder.id, item.id)}
                                className="w-6 h-6 text-green-600 rounded focus:ring-green-500"
                              />
                              <div className="flex-1">
                                <div className="font-medium text-base">{item.title || item.product_name}</div>
                                <div className="text-sm text-gray-600 mt-1">
                                  <span className="inline-flex items-center gap-1">
                                    <BarCode className="w-3 h-3" />
                                    SKU: {item.sku || 'N/A'}
                                  </span>
                                  <span className="ml-4">Bestand: {item.stock || 0}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-orange-600">
                                {item.quantity}x
                              </div>
                              <div className="text-sm text-gray-600">entnehmen</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress */}
              {selectedOrder.order_items && selectedOrder.order_items.length > 0 && (
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">Fortschritt</span>
                    <span>
                      {selectedOrder.order_items.filter(i => i.picked).length} / {selectedOrder.order_items.length} Artikel
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-green-600 h-3 rounded-full transition-all duration-300"
                      style={{
                        width: `${(selectedOrder.order_items.filter(i => i.picked).length / selectedOrder.order_items.length) * 100}%`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between">
                <button
                  onClick={() => {
                    // Print picking list
                    window.print();
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
                >
                  <Printer size={18} />
                  Pickliste drucken
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPickingModal(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Pausieren
                  </button>
                  <button
                    onClick={() => completeOrder(selectedOrder.id)}
                    disabled={!selectedOrder.order_items?.every(i => i.picked)}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      selectedOrder.order_items?.every(i => i.picked)
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {selectedOrder.order_items?.every(i => i.picked) ? (
                      <>
                        <CheckCircle className="inline w-4 h-4 mr-2" />
                        Kommissionierung abschließen
                      </>
                    ) : (
                      'Bitte alle Artikel kommissionieren'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {sortedOrders.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
            <ShoppingCart size={48} className="mx-auto mb-4 text-gray-300" />
            {orders.length === 0 ? (
              <div>
                <p className="mb-2">Keine Bestellungen vorhanden</p>
                <button
                  onClick={syncOrdersFromShopify}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Jetzt synchronisieren
                </button>
              </div>
            ) : (
              <p>Keine Bestellungen gefunden für Ihre Suche</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}