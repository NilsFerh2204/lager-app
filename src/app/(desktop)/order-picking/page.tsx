'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ShoppingCart,
  User,
  MapPin,
  Calendar,
  CheckCircle,
  Printer,
  ClipboardList,
  Search,
  X,
  Loader2,
  RefreshCw,
  Check,
  Package,
  PlayCircle,
  AlertCircle,
  Warehouse,
  ArrowRight,
  Menu,
  ChevronDown,
  ChevronUp,
  Smartphone
} from 'lucide-react';
import toast from 'react-hot-toast';

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  title: string;
  variant_title: string | null;
  sku: string;
  quantity: number;
  price: number;
  product?: {
    id: string;
    name: string;
    storage_location: string | null;
    current_stock: number;
  } | null;
  picked?: boolean;
}

interface Order {
  id: string;
  shopify_id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  shipping_city: string;
  total_price: number;
  fulfillment_status: string;
  financial_status: string;
  shopify_created_at: string;
  order_items: OrderItem[];
  note?: string;
  tags?: string;
}

interface CommissioningItem {
  orderId: string;
  orderNumber: string;
  customerName: string;
  item: OrderItem;
  picked: boolean;
}

export default function OrderPickingPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unfulfilled' | 'fulfilled'>('unfulfilled');
  const [viewMode, setViewMode] = useState<'orders' | 'commissioning'>('orders');
  const [commissioningItems, setCommissioningItems] = useState<CommissioningItem[]>([]);
  const [selectedOrderForCommissioning, setSelectedOrderForCommissioning] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    // Mobile detection
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [filterStatus]);

  const fetchOrders = async () => {
    try {
      // Schritt 1: Orders laden
      let ordersQuery = supabase
        .from('orders')
        .select('*')
        .order('shopify_created_at', { ascending: false });

      if (filterStatus !== 'all') {
        ordersQuery = ordersQuery.eq('fulfillment_status', filterStatus);
      }

      const { data: ordersData, error: ordersError } = await ordersQuery;

      if (ordersError) {
        console.error('Orders fetch error:', ordersError);
        throw ordersError;
      }

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // Schritt 2: Order Items laden
      const orderIds = ordersData.map(o => o.id);
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);

      if (itemsError) {
        console.error('Items fetch error:', itemsError);
      }

      // Schritt 3: Produkte laden für Lagerplätze
      const productsMap = new Map();
      if (itemsData && itemsData.length > 0) {
        const productIds = itemsData
          .map(item => item.product_id)
          .filter((id): id is string => id !== null);
        
        if (productIds.length > 0) {
          const { data: productsData } = await supabase
            .from('products')
            .select('id, name, storage_location, current_stock')
            .in('id', productIds);
          
          if (productsData) {
            productsData.forEach(product => {
              productsMap.set(product.id, product);
            });
          }
        }
      }

      // Schritt 4: Alles zusammenführen
      const ordersWithItems = ordersData.map(order => {
        const orderItems = (itemsData || [])
          .filter(item => item.order_id === order.id)
          .map(item => ({
            ...item,
            product: item.product_id ? productsMap.get(item.product_id) || null : null
          }));

        return {
          ...order,
          order_items: orderItems
        };
      });

      setOrders(ordersWithItems);
      console.log(`Loaded ${ordersWithItems.length} orders`);
      
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast.error('Fehler beim Laden der Bestellungen');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const syncOrders = async () => {
    setSyncing(true);
    const loadingToast = toast.loading('Synchronisiere Bestellungen...');
    
    try {
      const response = await fetch('/api/shopify/sync-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast.success(data.message || 'Bestellungen synchronisiert!', { id: loadingToast });
        await fetchOrders();
      } else {
        toast.error(data.error || 'Synchronisation fehlgeschlagen', { id: loadingToast });
      }
    } catch (error) {
      toast.error('Fehler bei der Synchronisation', { id: loadingToast });
    } finally {
      setSyncing(false);
    }
  };

  const startCommissioning = (orderId?: string) => {
    const ordersToCommission = orderId 
      ? orders.filter(o => o.id === orderId && o.fulfillment_status === 'unfulfilled')
      : orders.filter(o => o.fulfillment_status === 'unfulfilled');

    if (ordersToCommission.length === 0) {
      toast.error('Keine offenen Bestellungen zum Kommissionieren');
      return;
    }

    // Erstelle Kommissionierungs-Liste
    const items: CommissioningItem[] = [];
    
    ordersToCommission.forEach(order => {
      order.order_items.forEach(item => {
        items.push({
          orderId: order.id,
          orderNumber: order.order_number,
          customerName: order.customer_name,
          item: { ...item, picked: false },
          picked: false
        });
      });
    });

    // Sortiere nach Lagerplatz, dann nach Bestellung
    items.sort((a, b) => {
      const locA = a.item.product?.storage_location || 'ZZZ';
      const locB = b.item.product?.storage_location || 'ZZZ';
      
      if (locA !== locB) {
        return locA.localeCompare(locB);
      }
      return a.orderNumber.localeCompare(b.orderNumber);
    });

    setCommissioningItems(items);
    setSelectedOrderForCommissioning(orderId || null);
    setViewMode('commissioning');
    
    toast.success(`Kommissionierung gestartet: ${items.length} Artikel aus ${ordersToCommission.length} Bestellung(en)`);
  };

  const togglePickedItem = (index: number) => {
    const updatedItems = [...commissioningItems];
    updatedItems[index].picked = !updatedItems[index].picked;
    setCommissioningItems(updatedItems);

    // Vibration feedback auf Mobile
    if (isMobile && navigator.vibrate) {
      navigator.vibrate(50);
    }

    const allPicked = updatedItems.every(item => item.picked);
    if (allPicked) {
      toast.success('Alle Artikel kommissioniert! Bereit zum Verpacken.');
      if (isMobile && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    }
  };

  const completeCommissioning = async () => {
    const unpickedItems = commissioningItems.filter(item => !item.picked);
    
    if (unpickedItems.length > 0) {
      const confirm = window.confirm(`Es sind noch ${unpickedItems.length} Artikel nicht kommissioniert. Trotzdem abschließen?`);
      if (!confirm) return;
    }

    const loadingToast = toast.loading('Aktualisiere Bestellstatus...');
    
    try {
      // Sammle alle betroffenen Order IDs
      const orderIds = new Set(commissioningItems.map(item => item.orderId));
      
      const updatePromises = Array.from(orderIds).map(orderId => 
        supabase
          .from('orders')
          .update({ 
            fulfillment_status: 'fulfilled',
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId)
      );

      await Promise.all(updatePromises);
      toast.success(`${orderIds.size} Bestellung(en) als erfüllt markiert!`, { id: loadingToast });
      
      setCommissioningItems([]);
      setViewMode('orders');
      setSelectedOrderForCommissioning(null);
      await fetchOrders();
      
    } catch (error) {
      toast.error('Fehler beim Aktualisieren', { id: loadingToast });
      console.error(error);
    }
  };

  const printCommissioningList = () => {
    const groupedByOrder = commissioningItems.reduce((acc, item) => {
      if (!acc[item.orderNumber]) {
        acc[item.orderNumber] = {
          customerName: item.customerName,
          items: []
        };
      }
      acc[item.orderNumber].items.push(item);
      return acc;
    }, {} as Record<string, { customerName: string; items: CommissioningItem[] }>);

    const printContent = `
      <html>
        <head>
          <title>Kommissionierliste - ${new Date().toLocaleDateString('de-DE')}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 24px; margin-bottom: 20px; }
            h2 { font-size: 18px; margin-top: 20px; margin-bottom: 10px; background: #f0f0f0; padding: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .location { font-weight: bold; font-size: 16px; color: #1e40af; }
            .checkbox { width: 30px; height: 30px; border: 2px solid #000; display: inline-block; }
            .order-header { background: #e0e7ff; padding: 10px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Kommissionierliste - ${new Date().toLocaleDateString('de-DE')} ${new Date().toLocaleTimeString('de-DE')}</h1>
          ${Object.entries(groupedByOrder).map(([orderNumber, data]) => `
            <div class="order-header">
              <h2>Bestellung #${orderNumber} - ${data.customerName}</h2>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 50px;">✓</th>
                  <th style="width: 150px;">Lagerplatz</th>
                  <th style="width: 120px;">SKU</th>
                  <th>Artikel</th>
                  <th style="width: 80px;">Menge</th>
                </tr>
              </thead>
              <tbody>
                ${data.items.map(item => `
                  <tr>
                    <td><div class="checkbox"></div></td>
                    <td class="location">${item.item.product?.storage_location || 'Kein Lagerplatz'}</td>
                    <td>${item.item.sku}</td>
                    <td>${item.item.title}</td>
                    <td style="text-align: center;"><strong>${item.item.quantity}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `).join('')}
          <div style="margin-top: 40px; border-top: 2px solid #000; padding-top: 20px;">
            <p><strong>Kommissioniert von:</strong> _________________________</p>
            <p><strong>Datum/Zeit:</strong> _________________________</p>
            <p><strong>Unterschrift:</strong> _________________________</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
    }
  };

  const toggleOrderExpansion = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className={`${isMobile ? 'pb-20' : ''} min-h-screen bg-gray-50`}>
      <div className={`container mx-auto ${isMobile ? 'px-2' : 'p-6'}`}>
        {/* Mobile-optimierter Header */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-4 md:mb-6">
          <div className={`${isMobile ? 'space-y-4' : 'flex justify-between items-center mb-6'}`}>
            <div className="flex items-center gap-3">
              <ShoppingCart className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} text-blue-600`} />
              <div>
                <h1 className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold`}>Kommissionierung</h1>
                <p className="text-sm md:text-base text-gray-600">
                  {viewMode === 'orders' ? 'Bestellübersicht' : `${commissioningItems.filter(i => i.picked).length}/${commissioningItems.length} Artikel`}
                </p>
              </div>
              {isMobile && (
                <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="ml-auto p-2"
                >
                  <Menu className="h-6 w-6" />
                </button>
              )}
            </div>
            
            {/* Desktop Buttons oder Mobile Menu */}
            <div className={`${isMobile ? (showMobileMenu ? 'block' : 'hidden') : 'flex'} gap-2 md:gap-3`}>
              {viewMode === 'orders' ? (
                <div className={`${isMobile ? 'space-y-2' : 'flex gap-3'}`}>
                  <button
                    onClick={() => startCommissioning()}
                    className={`${isMobile ? 'w-full' : ''} bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-semibold`}
                    disabled={orders.filter(o => o.fulfillment_status === 'unfulfilled').length === 0}
                  >
                    <PlayCircle className="h-5 w-5" />
                    <span className={isMobile ? 'text-sm' : ''}>Alle offenen kommissionieren</span>
                  </button>
                  <button
                    onClick={syncOrders}
                    disabled={syncing}
                    className={`${isMobile ? 'w-full' : ''} bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50`}
                  >
                    <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
                    <span className={isMobile ? 'text-sm' : ''}>{syncing ? 'Sync...' : 'Sync Orders'}</span>
                  </button>
                </div>
              ) : (
                <div className={`${isMobile ? 'space-y-2' : 'flex gap-3'}`}>
                  <button
                    onClick={printCommissioningList}
                    className={`${isMobile ? 'w-full' : ''} bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2`}
                  >
                    <Printer className="h-5 w-5" />
                    <span className={isMobile ? 'text-sm' : ''}>Drucken</span>
                  </button>
                  <button
                    onClick={completeCommissioning}
                    className={`${isMobile ? 'w-full' : ''} bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2`}
                  >
                    <CheckCircle className="h-5 w-5" />
                    <span className={isMobile ? 'text-sm' : ''}>Abschließen</span>
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('orders');
                      setCommissioningItems([]);
                      setSelectedOrderForCommissioning(null);
                    }}
                    className={`${isMobile ? 'w-full' : ''} bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2`}
                  >
                    <X className="h-5 w-5" />
                    <span className={isMobile ? 'text-sm' : ''}>Abbrechen</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Statistiken - Mobile optimiert */}
          <div className={`grid ${isMobile ? 'grid-cols-2 gap-2' : 'grid-cols-5 gap-4'} mt-4`}>
            <div className="bg-gray-50 p-3 md:p-4 rounded-lg">
              <p className="text-xs md:text-sm text-gray-600">Gesamt</p>
              <p className="text-xl md:text-2xl font-bold">{orders.length}</p>
            </div>
            <div className="bg-orange-50 p-3 md:p-4 rounded-lg">
              <p className="text-xs md:text-sm text-gray-600">Offen</p>
              <p className="text-xl md:text-2xl font-bold text-orange-600">
                {orders.filter(o => o.fulfillment_status === 'unfulfilled').length}
              </p>
            </div>
            {!isMobile && (
              <>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Erfüllt</p>
                  <p className="text-2xl font-bold text-green-600">
                    {orders.filter(o => o.fulfillment_status === 'fulfilled').length}
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Artikel gesamt</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {orders.reduce((sum, o) => sum + o.order_items.length, 0)}
                  </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Bereit zum Picken</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {orders.filter(o => o.fulfillment_status === 'unfulfilled').reduce((sum, o) => sum + o.order_items.length, 0)}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Commissioning View - Mobile optimiert */}
        {viewMode === 'commissioning' ? (
          <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
            <div className="mb-4">
              <h2 className="text-lg md:text-xl font-semibold mb-2">
                Kommissionierung läuft
              </h2>
              <div className="flex justify-between items-center">
                <p className="text-sm md:text-base text-gray-600">
                  {commissioningItems.filter(item => item.picked).length} von {commissioningItems.length} gepickt
                </p>
                <div className={`${isMobile ? 'w-32' : 'w-64'} bg-gray-200 rounded-full h-3 md:h-4`}>
                  <div 
                    className="bg-green-600 h-full rounded-full transition-all"
                    style={{ 
                      width: `${commissioningItems.length > 0 ? (commissioningItems.filter(item => item.picked).length / commissioningItems.length) * 100 : 0}%` 
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Gruppierte Artikel - Mobile Touch-optimiert */}
            {Object.entries(
              commissioningItems.reduce((acc, item) => {
                if (!acc[item.orderNumber]) {
                  acc[item.orderNumber] = [];
                }
                acc[item.orderNumber].push(item);
                return acc;
              }, {} as Record<string, CommissioningItem[]>)
            ).map(([orderNumber, items]) => (
              <div key={orderNumber} className="mb-4 md:mb-6">
                <div className="bg-blue-50 px-3 md:px-4 py-2 rounded-t-lg border border-blue-200">
                  <h3 className="font-semibold text-sm md:text-base text-blue-900">
                    #{orderNumber} - {items[0].customerName}
                  </h3>
                </div>
                <div className="border border-t-0 border-gray-200 rounded-b-lg">
                  {items.map((commItem, index) => {
                    const globalIndex = commissioningItems.findIndex(
                      ci => ci.orderId === commItem.orderId && ci.item.id === commItem.item.id
                    );
                    return (
                      <div 
                        key={`${commItem.item.id}-${index}`}
                        className={`p-3 md:p-4 border-b last:border-b-0 transition-all ${
                          commItem.picked ? 'bg-green-50' : 'bg-white'
                        }`}
                        onClick={() => isMobile && togglePickedItem(globalIndex)}
                      >
                        <div className={`flex items-center ${isMobile ? 'space-x-3' : 'justify-between'}`}>
                          <button
                            onClick={(e) => {
                              if (!isMobile) {
                                e.stopPropagation();
                                togglePickedItem(globalIndex);
                              }
                            }}
                            className={`${isMobile ? 'w-10 h-10' : 'w-8 h-8'} flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                              commItem.picked 
                                ? 'bg-green-600 border-green-600' 
                                : 'border-gray-300 hover:border-green-600'
                            }`}
                          >
                            {commItem.picked && <Check className="h-5 w-5 text-white" />}
                          </button>
                          
                          <div className="flex-1 flex items-center gap-2 md:gap-6">
                            <div className="bg-blue-100 px-2 md:px-3 py-1 rounded-lg">
                              <span className="font-bold text-xs md:text-sm text-blue-800">
                                {commItem.item.product?.storage_location || 'Kein Platz'}
                              </span>
                            </div>
                            
                            <div className="flex-1">
                              <p className="font-medium text-sm md:text-base">{commItem.item.title}</p>
                              <p className="text-xs md:text-sm text-gray-600">SKU: {commItem.item.sku}</p>
                            </div>

                            <div className="text-right">
                              <p className="text-xl md:text-2xl font-bold">{commItem.item.quantity}x</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Filter und Suche - Mobile optimiert */}
            <div className="bg-white rounded-lg shadow-md p-3 md:p-4 mb-4 md:mb-6">
              <div className={`${isMobile ? 'space-y-2' : 'flex gap-4'}`}>
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 md:h-5 md:w-5" />
                  <input
                    type="text"
                    placeholder="Suche..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 md:pl-10 pr-3 md:pr-4 py-2 border rounded-lg text-sm md:text-base"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-3 md:px-4 py-2 border rounded-lg text-sm md:text-base"
                >
                  <option value="all">Alle</option>
                  <option value="unfulfilled">Offen</option>
                  <option value="fulfilled">Erfüllt</option>
                </select>
              </div>
            </div>

            {/* Orders List - Mobile optimiert */}
            <div className="space-y-3 md:space-y-4">
              {filteredOrders.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-8 md:p-12 text-center">
                  <Package className="h-12 md:h-16 w-12 md:w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg md:text-xl font-semibold text-gray-600 mb-2">Keine Bestellungen</h3>
                  <p className="text-sm md:text-base text-gray-500">
                    {searchTerm ? 'Andere Suche versuchen' : 'Orders synchronisieren'}
                  </p>
                </div>
              ) : (
                filteredOrders.map(order => (
                  <div 
                    key={order.id}
                    className="bg-white rounded-lg shadow-md overflow-hidden"
                  >
                    <div className="p-4 md:p-6">
                      <div className={`${isMobile ? 'space-y-3' : 'flex justify-between items-start'}`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 md:gap-4 mb-2 md:mb-3">
                            <h3 className="text-lg md:text-xl font-bold">
                              #{order.order_number}
                            </h3>
                            <span className={`px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-medium ${
                              order.fulfillment_status === 'fulfilled'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {order.fulfillment_status === 'fulfilled' ? 'Erfüllt' : 'Offen'}
                            </span>
                          </div>
                          
                          <div className={`${isMobile ? 'space-y-1' : 'flex items-center gap-6'} text-xs md:text-sm text-gray-600`}>
                            <span className="flex items-center gap-1">
                              <User className="h-3 md:h-4 w-3 md:w-4" />
                              {order.customer_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 md:h-4 w-3 md:w-4" />
                              {order.shipping_city || 'Keine Adresse'}
                            </span>
                            {!isMobile && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {new Date(order.shopify_created_at).toLocaleDateString('de-DE')}
                              </span>
                            )}
                            <span className="font-bold text-base md:text-lg text-gray-900">
                              €{Number(order.total_price).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className={`${isMobile ? 'flex justify-between mt-3' : 'flex gap-2'}`}>
                          {order.fulfillment_status === 'unfulfilled' && (
                            <button
                              onClick={() => startCommissioning(order.id)}
                              className="bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm md:text-base"
                            >
                              <PlayCircle className="h-4 md:h-5 w-4 md:w-5" />
                              Kommissionieren
                            </button>
                          )}
                          <button
                            onClick={() => toggleOrderExpansion(order.id)}
                            className="bg-gray-100 text-gray-700 px-3 md:px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1 text-sm md:text-base"
                          >
                            {expandedOrders.has(order.id) ? (
                              <>
                                <ChevronUp className="h-4 w-4" />
                                Weniger
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4" />
                                Details
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Artikel anzeigen */}
                      <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t">
                        <div className="flex items-center justify-between mb-2 md:mb-3">
                          <h4 className="font-semibold text-sm md:text-base text-gray-700">
                            {order.order_items.length} Artikel
                          </h4>
                          {order.order_items.some(item => !item.product?.storage_location) && (
                            <span className="text-xs md:text-sm text-orange-600 flex items-center gap-1">
                              <AlertCircle className="h-3 md:h-4 w-3 md:w-4" />
                              <span className="hidden md:inline">Einige ohne Lagerplatz</span>
                              <span className="md:hidden">Ohne Platz</span>
                            </span>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          {order.order_items.map(item => (
                            <div key={item.id} className="flex items-center justify-between py-2 md:py-3 px-3 md:px-4 bg-gray-50 rounded-lg">
                              <div className={`flex-1 flex items-center ${isMobile ? 'gap-2' : 'gap-4'}`}>
                                <div className={`px-2 md:px-3 py-1 rounded text-xs md:text-sm font-bold ${isMobile ? 'min-w-[60px]' : 'min-w-[100px]'} text-center ${
                                  item.product?.storage_location 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {isMobile && <Warehouse className="h-3 w-3 inline mr-1" />}
                                  {item.product?.storage_location || 'Kein'}
                                </div>
                                
                                <div className="flex-1">
                                  <p className="font-medium text-sm md:text-base">{item.title}</p>
                                  <p className="text-xs md:text-sm text-gray-600">SKU: {item.sku}</p>
                                </div>
                                
                                <div className="text-right">
                                  <p className="font-bold text-base md:text-lg">{item.quantity}x</p>
                                  <p className="text-xs md:text-sm text-gray-600">€{Number(item.price).toFixed(2)}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Erweiterte Details */}
                      {expandedOrders.has(order.id) && (
                        <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t">
                          {order.note && (
                            <div className="p-2 md:p-3 bg-yellow-50 rounded-lg mb-2">
                              <p className="text-xs md:text-sm text-yellow-800">
                                <strong>Notiz:</strong> {order.note}
                              </p>
                            </div>
                          )}
                          <div className="text-xs md:text-sm text-gray-600 space-y-1">
                            <p><strong>Email:</strong> {order.customer_email}</p>
                            <p><strong>Zahlungsstatus:</strong> {order.financial_status}</p>
                            <p><strong>Datum:</strong> {new Date(order.shopify_created_at).toLocaleString('de-DE')}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Mobile Bottom Navigation für Kommissionierung */}
        {isMobile && viewMode === 'commissioning' && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 flex justify-around">
            <button
              onClick={printCommissioningList}
              className="flex flex-col items-center p-2"
            >
              <Printer className="h-6 w-6 text-gray-600" />
              <span className="text-xs mt-1">Drucken</span>
            </button>
            <button
              onClick={completeCommissioning}
              className="flex flex-col items-center p-2 text-green-600"
            >
              <CheckCircle className="h-6 w-6" />
              <span className="text-xs mt-1">Fertig</span>
            </button>
            <button
              onClick={() => {
                setViewMode('orders');
                setCommissioningItems([]);
              }}
              className="flex flex-col items-center p-2 text-red-600"
            >
              <X className="h-6 w-6" />
              <span className="text-xs mt-1">Abbruch</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}