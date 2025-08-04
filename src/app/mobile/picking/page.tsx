'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Package,
  MapPin,
  Check,
  Clock,
  User,
  ChevronRight,
  ArrowLeft,
  QrCode,
  AlertCircle,
  CheckCircle,
  Loader2,
  ShoppingCart,
  Filter,
  X,
  Home,
  ChevronLeft
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Order {
  id: string;
  shopify_id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  shipping_address: string;
  shipping_city: string;
  shipping_zip: string;
  total_price: number;
  fulfillment_status: string;
  financial_status: string;
  note: string | null;
  shopify_created_at: string;
  order_items: OrderItem[];
}

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  shopify_product_id: string;
  shopify_variant_id: string;
  title: string;
  variant_title: string | null;
  sku: string;
  quantity: number;
  price: number;
  product?: {
    storage_location: string | null;
    current_stock: number;
    image_url: string | null;
  };
}

interface PickingSession {
  orders: Order[];
  currentOrderIndex: number;
  pickedItems: Set<string>;
  startTime: Date;
}

export default function MobilePickingPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<PickingSession | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'unfulfilled' | 'fulfilled'>('unfulfilled');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            product:product_id (
              storage_location,
              current_stock,
              image_url
            )
          )
        `)
        .order('shopify_created_at', { ascending: true });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast.error('Fehler beim Laden der Bestellungen');
    } finally {
      setLoading(false);
    }
  };

  const startPicking = () => {
    if (selectedOrders.size === 0) {
      toast.error('Bitte Bestellungen auswählen');
      return;
    }

    const selectedOrdersList = orders.filter(o => selectedOrders.has(o.id));
    setActiveSession({
      orders: selectedOrdersList,
      currentOrderIndex: 0,
      pickedItems: new Set(),
      startTime: new Date()
    });
  };

  const toggleItemPicked = (itemId: string) => {
    if (!activeSession) return;

    const newPickedItems = new Set(activeSession.pickedItems);
    if (newPickedItems.has(itemId)) {
      newPickedItems.delete(itemId);
    } else {
      newPickedItems.add(itemId);
      // Vibration feedback
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    }

    setActiveSession({
      ...activeSession,
      pickedItems: newPickedItems
    });
  };

  const nextOrder = () => {
    if (!activeSession) return;

    if (activeSession.currentOrderIndex < activeSession.orders.length - 1) {
      setActiveSession({
        ...activeSession,
        currentOrderIndex: activeSession.currentOrderIndex + 1
      });
    } else {
      // All orders completed
      completePicking();
    }
  };

  const previousOrder = () => {
    if (!activeSession || activeSession.currentOrderIndex === 0) return;

    setActiveSession({
      ...activeSession,
      currentOrderIndex: activeSession.currentOrderIndex - 1
    });
  };

  const completeCurrentOrder = async () => {
    if (!activeSession) return;

    const currentOrder = activeSession.orders[activeSession.currentOrderIndex];
    const orderItems = currentOrder.order_items;
    const pickedOrderItems = orderItems.filter(item => activeSession.pickedItems.has(item.id));

    if (pickedOrderItems.length !== orderItems.length) {
      if (!confirm(`Nur ${pickedOrderItems.length} von ${orderItems.length} Artikeln gepickt. Trotzdem fortfahren?`)) {
        return;
      }
    }

    try {
      // Update order status
      await supabase
        .from('orders')
        .update({ 
          fulfillment_status: 'fulfilled',
          updated_at: new Date().toISOString()
        })
        .eq('id', currentOrder.id);

      toast.success(`Bestellung #${currentOrder.order_number} abgeschlossen`);
      
      // Move to next order or complete session
      if (activeSession.currentOrderIndex < activeSession.orders.length - 1) {
        nextOrder();
      } else {
        completePicking();
      }
    } catch (error) {
      toast.error('Fehler beim Abschließen der Bestellung');
    }
  };

  const completePicking = async () => {
    if (!activeSession) return;

    const duration = Math.round((Date.now() - activeSession.startTime.getTime()) / 1000 / 60);
    toast.success(`Kommissionierung abgeschlossen! ${activeSession.orders.length} Bestellungen in ${duration} Minuten`);
    
    setActiveSession(null);
    setSelectedOrders(new Set());
    fetchOrders();
  };

  const filteredOrders = orders.filter(order => {
    if (filterStatus === 'unfulfilled') return order.fulfillment_status !== 'fulfilled';
    if (filterStatus === 'fulfilled') return order.fulfillment_status === 'fulfilled';
    return true;
  });

  const currentOrder = activeSession ? activeSession.orders[activeSession.currentOrderIndex] : null;
  const currentOrderItems = currentOrder ? currentOrder.order_items : [];
  const groupedItemsByLocation = currentOrderItems.reduce((acc, item) => {
    const location = item.product?.storage_location || 'Kein Lagerplatz';
    if (!acc[location]) acc[location] = [];
    acc[location].push(item);
    return acc;
  }, {} as Record<string, OrderItem[]>);

  const currentOrderProgress = currentOrder ? {
    picked: currentOrderItems.filter(item => activeSession?.pickedItems.has(item.id)).length,
    total: currentOrderItems.length
  } : { picked: 0, total: 0 };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-20">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-black bg-opacity-80 backdrop-blur-sm z-50">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => activeSession ? setActiveSession(null) : window.history.back()}
            className="p-2 rounded-lg bg-gray-800"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold">
            {activeSession 
              ? `Bestellung ${activeSession.currentOrderIndex + 1}/${activeSession.orders.length}`
              : 'Kommissionierung'
            }
          </h1>
          {!activeSession && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-2 rounded-lg bg-gray-800"
            >
              <Filter className="h-6 w-6" />
            </button>
          )}
          {activeSession && (
            <div className="text-sm">
              {currentOrderProgress.picked}/{currentOrderProgress.total}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-20">
        {!activeSession ? (
          <>
            {/* Filters */}
            {showFilters && (
              <div className="bg-gray-800 p-4 border-b border-gray-700">
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={`px-4 py-2 rounded-lg ${
                      filterStatus === 'all' ? 'bg-orange-600' : 'bg-gray-700'
                    }`}
                  >
                    Alle
                  </button>
                  <button
                    onClick={() => setFilterStatus('unfulfilled')}
                    className={`px-4 py-2 rounded-lg ${
                      filterStatus === 'unfulfilled' ? 'bg-orange-600' : 'bg-gray-700'
                    }`}
                  >
                    Offen
                  </button>
                  <button
                    onClick={() => setFilterStatus('fulfilled')}
                    className={`px-4 py-2 rounded-lg ${
                      filterStatus === 'fulfilled' ? 'bg-orange-600' : 'bg-gray-700'
                    }`}
                  >
                    Erfüllt
                  </button>
                </div>
              </div>
            )}

            {/* Orders List */}
            <div className="p-4 space-y-3">
              {filteredOrders.map(order => (
                <div
                  key={order.id}
                  className={`bg-gray-800 rounded-lg p-4 ${
                    selectedOrders.has(order.id) ? 'ring-2 ring-orange-500' : ''
                  }`}
                  onClick={() => {
                    const newSelected = new Set(selectedOrders);
                    if (newSelected.has(order.id)) {
                      newSelected.delete(order.id);
                    } else {
                      newSelected.add(order.id);
                    }
                    setSelectedOrders(newSelected);
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                        selectedOrders.has(order.id) 
                          ? 'bg-orange-600 border-orange-600' 
                          : 'border-gray-600'
                      }`}>
                        {selectedOrders.has(order.id) && (
                          <Check className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">#{order.order_number}</p>
                        <p className="text-sm text-gray-400">{order.customer_name}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      order.fulfillment_status === 'fulfilled'
                        ? 'bg-green-900 text-green-300'
                        : 'bg-orange-900 text-orange-300'
                    }`}>
                      {order.fulfillment_status === 'fulfilled' ? 'Erfüllt' : 'Offen'}
                    </span>
                  </div>

                  <div className="text-sm text-gray-400 mb-2">
                    {order.order_items.length} Artikel • €{order.total_price.toFixed(2)}
                  </div>

                  {/* Item Preview */}
                  <div className="flex gap-2 overflow-x-auto">
                    {order.order_items.slice(0, 3).map(item => (
                      <div key={item.id} className="flex-shrink-0 bg-gray-700 rounded px-2 py-1 text-xs">
                        {item.quantity}x {item.title.substring(0, 20)}...
                      </div>
                    ))}
                    {order.order_items.length > 3 && (
                      <div className="flex-shrink-0 text-xs text-gray-500 px-2 py-1">
                        +{order.order_items.length - 3} mehr
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Active Picking Session - Current Order */
          <div className="p-4">
            {/* Order Header */}
            <div className="bg-blue-900 bg-opacity-50 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h2 className="text-xl font-bold">#{currentOrder?.order_number}</h2>
                  <p className="text-gray-300">{currentOrder?.customer_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">Bestellung</p>
                  <p className="font-bold">{activeSession.currentOrderIndex + 1} / {activeSession.orders.length}</p>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-3">
                <div className="flex justify-between text-sm mb-1">
                  <span>Fortschritt</span>
                  <span>{Math.round((currentOrderProgress.picked / currentOrderProgress.total) * 100)}%</span>
                </div>
                <div className="bg-gray-700 rounded-full h-3">
                  <div 
                    className="bg-orange-600 h-3 rounded-full transition-all"
                    style={{ 
                      width: `${(currentOrderProgress.picked / currentOrderProgress.total) * 100}%` 
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Items grouped by location */}
            {Object.entries(groupedItemsByLocation).map(([location, items]) => (
              <div key={location} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="h-5 w-5 text-blue-500" />
                  <h3 className="text-lg font-semibold">{location}</h3>
                </div>

                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`bg-gray-800 rounded-lg p-4 ${
                        activeSession.pickedItems.has(item.id) 
                          ? 'opacity-50' 
                          : ''
                      }`}
                      onClick={() => toggleItemPicked(item.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center flex-shrink-0 ${
                          activeSession.pickedItems.has(item.id)
                            ? 'bg-green-600 border-green-600'
                            : 'border-orange-500'
                        }`}>
                          {activeSession.pickedItems.has(item.id) ? (
                            <Check className="h-5 w-5" />
                          ) : (
                            <span className="text-sm font-bold">{item.quantity}</span>
                          )}
                        </div>

                        <div className="flex-1">
                          <p className={`font-medium ${
                            activeSession.pickedItems.has(item.id) ? 'line-through' : ''
                          }`}>
                            {item.title}
                          </p>
                          <p className="text-sm text-gray-400">
                            {item.sku}
                          </p>
                          {item.variant_title && (
                            <p className="text-sm text-gray-500">{item.variant_title}</p>
                          )}
                        </div>

                        {item.product?.image_url && (
                          <img
                            src={item.product.image_url}
                            alt={item.title}
                            className="w-16 h-16 rounded object-cover"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Navigation Buttons */}
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={previousOrder}
                disabled={activeSession.currentOrderIndex === 0}
                className="py-3 bg-gray-700 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ChevronLeft className="h-5 w-5" />
                Zurück
              </button>
              <button
                onClick={completeCurrentOrder}
                className={`py-3 rounded-lg font-semibold flex items-center justify-center gap-2 ${
                  currentOrderProgress.picked === currentOrderProgress.total
                    ? 'bg-green-600'
                    : 'bg-orange-600'
                }`}
              >
                {activeSession.currentOrderIndex < activeSession.orders.length - 1 ? 'Nächste' : 'Fertig'}
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      {!activeSession && selectedOrders.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 bg-black bg-opacity-90 backdrop-blur-sm p-4">
          <button
            onClick={startPicking}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-2"
          >
            <Package className="h-6 w-6" />
            Kommissionierung starten ({selectedOrders.size})
          </button>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-black bg-opacity-90 backdrop-blur-sm">
        <div className="grid grid-cols-4 py-2">
          <Link href="/mobile" className="flex flex-col items-center gap-1 py-2 text-gray-400">
            <Home className="h-6 w-6" />
            <span className="text-xs">Home</span>
          </Link>
          <Link href="/mobile/scan" className="flex flex-col items-center gap-1 py-2 text-gray-400">
            <QrCode className="h-6 w-6" />
            <span className="text-xs">Scan</span>
          </Link>
          <Link href="/mobile/picking" className="flex flex-col items-center gap-1 py-2 text-orange-500">
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