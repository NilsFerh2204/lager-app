'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import {
  ShoppingCart,
  Package,
  MapPin,
  Check,
  X,
  ChevronRight,
  Clock,
  AlertCircle,
  Home,
  QrCode,
  Loader2,
  CheckCircle,
  Camera
} from 'lucide-react';
import toast from 'react-hot-toast';

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  picked_quantity?: number;
  product: {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    storage_location: string | null;
    current_stock: number;
    image_url: string | null;
  };
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  status: string;
  created_at: string;
  items: OrderItem[];
}

export default function MobilePickingPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanMode, setScanMode] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [pickedItems, setPickedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items(
            *,
            product:products(*)
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Fehler beim Laden der Bestellungen');
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeInput = async () => {
    if (!scannedBarcode.trim() || !selectedOrder) return;

    // Find item with this barcode
    const item = selectedOrder.items.find(
      item => item.product.barcode === scannedBarcode
    );

    if (!item) {
      toast.error('Produkt nicht in dieser Bestellung');
      setScannedBarcode('');
      return;
    }

    if (pickedItems.has(item.id)) {
      toast.info('Produkt bereits gepickt');
      setScannedBarcode('');
      return;
    }

    // Mark as picked
    setPickedItems(prev => new Set([...prev, item.id]));
    toast.success(`✓ ${item.product.name} gepickt`);
    setScannedBarcode('');

    // Check if all items are picked
    if (pickedItems.size + 1 === selectedOrder.items.length) {
      setTimeout(() => {
        completeOrder();
      }, 1000);
    }
  };

  const completeOrder = async () => {
    if (!selectedOrder) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'picked',
          picked_at: new Date().toISOString()
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      toast.success('Bestellung abgeschlossen!');
      setSelectedOrder(null);
      setPickedItems(new Set());
      setScanMode(false);
      fetchOrders();
    } catch (error) {
      console.error('Error completing order:', error);
      toast.error('Fehler beim Abschließen');
    }
  };

  const startPicking = (order: Order) => {
    setSelectedOrder(order);
    setScanMode(true);
    setPickedItems(new Set());
  };

  const cancelPicking = () => {
    setSelectedOrder(null);
    setScanMode(false);
    setPickedItems(new Set());
    setScannedBarcode('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-20">
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">
            {scanMode ? 'Produkte scannen' : 'Kommissionierung'}
          </h1>
          {scanMode && (
            <button
              onClick={cancelPicking}
              className="p-2 rounded-lg bg-gray-800"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {!scanMode ? (
          // Order List
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400">Keine offenen Bestellungen</p>
              </div>
            ) : (
              orders.map(order => (
                <div
                  key={order.id}
                  className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">
                        Bestellung #{order.order_number}
                      </h3>
                      <p className="text-gray-400">{order.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">
                        {order.items.length} Artikel
                      </p>
                      <p className="text-xs text-gray-500">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {new Date(order.created_at).toLocaleTimeString('de-DE', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => startPicking(order)}
                    className="w-full bg-orange-600 rounded-lg py-3 font-medium flex items-center justify-center gap-2"
                  >
                    <Package className="h-5 w-5" />
                    Kommissionierung starten
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          // Picking Mode
          <div className="space-y-4">
            {selectedOrder && (
              <>
                {/* Order Header */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="font-semibold">
                    Bestellung #{selectedOrder.order_number}
                  </h3>
                  <p className="text-gray-400">{selectedOrder.customer_name}</p>
                  <div className="mt-2 flex items-center gap-4">
                    <span className="text-sm">
                      Fortschritt: {pickedItems.size} / {selectedOrder.items.length}
                    </span>
                    <div className="flex-1 bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${(pickedItems.size / selectedOrder.items.length) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Barcode Scanner */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <label className="block text-sm font-medium mb-2">
                    Produkt-Barcode scannen
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={scannedBarcode}
                      onChange={(e) => setScannedBarcode(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleBarcodeInput();
                        }
                      }}
                      placeholder="Barcode scannen..."
                      className="flex-1 bg-gray-700 rounded-lg px-4 py-3 text-lg"
                      autoFocus
                    />
                    <button
                      onClick={handleBarcodeInput}
                      disabled={!scannedBarcode}
                      className="px-4 py-3 bg-orange-600 rounded-lg disabled:bg-gray-600"
                    >
                      <Camera className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                {/* Product List */}
                <div className="space-y-3">
                  <h3 className="font-medium text-gray-400">Zu pickende Produkte:</h3>
                  {selectedOrder.items.map(item => {
                    const isPicked = pickedItems.has(item.id);
                    
                    return (
                      <div
                        key={item.id}
                        className={`bg-gray-800 rounded-lg p-4 border ${
                          isPicked 
                            ? 'border-green-500 opacity-50' 
                            : 'border-gray-700'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            {isPicked ? (
                              <CheckCircle className="h-6 w-6 text-green-500" />
                            ) : (
                              <div className="h-6 w-6 rounded-full border-2 border-gray-600" />
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <h4 className={`font-semibold ${isPicked ? 'line-through' : ''}`}>
                              {item.product.name}
                            </h4>
                            <p className="text-sm text-gray-400">
                              SKU: {item.product.sku}
                            </p>
                            {item.product.barcode && (
                              <p className="text-xs text-gray-500">
                                Barcode: {item.product.barcode}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2">
                              <span className="text-sm">
                                Menge: <strong>{item.quantity}</strong>
                              </span>
                              {item.product.storage_location && (
                                <div className="flex items-center gap-1 text-sm text-blue-400">
                                  <MapPin className="h-4 w-4" />
                                  {item.product.storage_location}
                                </div>
                              )}
                            </div>
                          </div>

                          {item.product.image_url && (
                            <img
                              src={item.product.image_url}
                              alt={item.product.name}
                              className="w-16 h-16 rounded object-cover"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Complete Button */}
                {pickedItems.size === selectedOrder.items.length && (
                  <button
                    onClick={completeOrder}
                    className="w-full bg-green-600 rounded-lg py-4 font-semibold flex items-center justify-center gap-2"
                  >
                    <Check className="h-6 w-6" />
                    Kommissionierung abschließen
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-black bg-opacity-90 backdrop-blur-sm z-40 mobile-bottom-nav">
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
          <Link href="/mobile/products" className="flex flex-col items-center gap-1 py-2 text-gray-400">
            <Package className="h-6 w-6" />
            <span className="text-xs">Produkte</span>
          </Link>
        </div>
      </div>
    </div>
  );
}