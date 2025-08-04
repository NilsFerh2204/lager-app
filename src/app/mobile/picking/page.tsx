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
  Camera,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  storage_location: string | null;
  current_stock: number;
  image_url: string | null;
}

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  picked_quantity?: number;
  product?: Product;
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  status: string;
  created_at: string;
  order_items?: OrderItem[];
}

export default function MobilePickingPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanMode, setScanMode] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [pickedItems, setPickedItems] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      console.log('Fetching orders...');
      
      // First fetch all pending orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (ordersError) {
        console.error('Orders error:', ordersError);
        throw ordersError;
      }

      console.log('Found orders:', ordersData);

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // For each order, fetch the complete data
      const ordersWithFullData = await Promise.all(
        ordersData.map(async (order) => {
          try {
            // Get order items for this order
            const { data: itemsData, error: itemsError } = await supabase
              .from('order_items')
              .select('*')
              .eq('order_id', order.id);

            if (itemsError) {
              console.error(`Error fetching items for order ${order.id}:`, itemsError);
              return { ...order, order_items: [] };
            }

            console.log(`Order ${order.id} items:`, itemsData);

            if (!itemsData || itemsData.length === 0) {
              return { ...order, order_items: [] };
            }

            // Get all unique product IDs from the order items
            const productIds = [...new Set(itemsData.map(item => item.product_id))];
            console.log('Product IDs to fetch:', productIds);

            // Fetch all products for these IDs
            const { data: productsData, error: productsError } = await supabase
              .from('products')
              .select('*')
              .in('id', productIds);

            if (productsError) {
              console.error('Products error:', productsError);
            }

            console.log('Fetched products:', productsData);

            // Create a map of products by ID for easy lookup
            const productsMap = new Map<string, Product>();
            (productsData || []).forEach(product => {
              productsMap.set(product.id, product);
            });

            // Combine items with their products
            const itemsWithProducts = itemsData.map(item => {
              const product = productsMap.get(item.product_id);
              if (!product) {
                console.warn(`Product not found for ID: ${item.product_id}`);
              }
              return {
                ...item,
                product: product || null
              };
            });

            console.log(`Order ${order.id} with products:`, itemsWithProducts);

            return {
              ...order,
              order_items: itemsWithProducts
            };
          } catch (error) {
            console.error(`Error processing order ${order.id}:`, error);
            return { ...order, order_items: [] };
          }
        })
      );

      console.log('Final orders with data:', ordersWithFullData);
      setOrders(ordersWithFullData);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Fehler beim Laden der Bestellungen');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await fetchOrders();
  };

  const handleBarcodeInput = async () => {
    if (!scannedBarcode.trim() || !selectedOrder || !selectedOrder.order_items) return;

    // Find item with this barcode
    const item = selectedOrder.order_items.find(
      item => item.product && item.product.barcode === scannedBarcode
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
    toast.success(`✓ ${item.product?.name || 'Produkt'} gepickt`);
    setScannedBarcode('');

    // Check if all items are picked
    if (pickedItems.size + 1 === selectedOrder.order_items.length) {
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
    console.log('Starting picking for order:', order);
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

  // Manual pick for items without barcodes or when clicking
  const toggleItemPicked = (itemId: string) => {
    if (pickedItems.has(itemId)) {
      setPickedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    } else {
      setPickedItems(prev => new Set([...prev, itemId]));
      
      // Check if all items are picked
      if (selectedOrder && selectedOrder.order_items && 
          pickedItems.size + 1 === selectedOrder.order_items.length) {
        setTimeout(() => {
          completeOrder();
        }, 1000);
      }
    }
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
          <div className="flex items-center gap-2">
            {!scanMode && (
              <button
                onClick={refreshData}
                disabled={refreshing}
                className="p-2 rounded-lg bg-gray-800"
              >
                <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
            {scanMode && (
              <button
                onClick={cancelPicking}
                className="p-2 rounded-lg bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {!scanMode ? (
          // Order List
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400">Keine offenen Bestellungen</p>
                <button
                  onClick={refreshData}
                  className="mt-4 text-orange-500 underline"
                >
                  Daten aktualisieren
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-400">
                  {orders.length} offene Bestellung{orders.length !== 1 ? 'en' : ''}
                </p>
                {orders.map(order => (
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
                          {order.order_items?.length || 0} Artikel
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

                    {order.order_items && order.order_items.length > 0 && (
                      <div className="mb-3 text-xs text-gray-500">
                        Produkte: {order.order_items.map(item => 
                          item.product?.name || 'Unbekannt'
                        ).join(', ')}
                      </div>
                    )}

                    <button
                      onClick={() => startPicking(order)}
                      className="w-full bg-orange-600 rounded-lg py-3 font-medium flex items-center justify-center gap-2"
                    >
                      <Package className="h-5 w-5" />
                      Kommissionierung starten
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          // Picking Mode
          <div className="space-y-4">
            {selectedOrder && selectedOrder.order_items && (
              <>
                {/* Order Header */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="font-semibold">
                    Bestellung #{selectedOrder.order_number}
                  </h3>
                  <p className="text-gray-400">{selectedOrder.customer_name}</p>
                  <div className="mt-2 flex items-center gap-4">
                    <span className="text-sm">
                      Fortschritt: {pickedItems.size} / {selectedOrder.order_items.length}
                    </span>
                    <div className="flex-1 bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${(pickedItems.size / selectedOrder.order_items.length) * 100}%`
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
                  <p className="text-xs text-gray-400 mt-2">
                    Tipp: Klicken Sie auf Produkte zum manuellen Abhaken
                  </p>
                </div>

                {/* Product List */}
                <div className="space-y-3">
                  <h3 className="font-medium text-gray-400">
                    Zu pickende Produkte: ({selectedOrder.order_items.length})
                  </h3>
                  {selectedOrder.order_items.map((item, index) => {
                    const isPicked = pickedItems.has(item.id);
                    const hasProduct = !!item.product;
                    
                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleItemPicked(item.id)}
                        className={`bg-gray-800 rounded-lg p-4 border cursor-pointer transition-all ${
                          isPicked 
                            ? 'border-green-500 opacity-70' 
                            : 'border-gray-700 hover:border-gray-600'
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
                            {hasProduct ? (
                              <>
                                <h4 className={`font-semibold ${isPicked ? 'line-through' : ''}`}>
                                  {item.product!.name}
                                </h4>
                                <p className="text-sm text-gray-400">
                                  SKU: {item.product!.sku}
                                </p>
                                {item.product!.barcode && (
                                  <p className="text-xs text-gray-500">
                                    Barcode: {item.product!.barcode}
                                  </p>
                                )}
                                <div className="flex items-center gap-4 mt-2">
                                  <span className="text-sm">
                                    Menge: <strong>{item.quantity}</strong>
                                  </span>
                                  {item.product!.storage_location && (
                                    <div className="flex items-center gap-1 text-sm text-blue-400">
                                      <MapPin className="h-4 w-4" />
                                      {item.product!.storage_location}
                                    </div>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <h4 className={`font-semibold text-red-400 ${isPicked ? 'line-through' : ''}`}>
                                  Produkt #{index + 1} (Daten fehlen)
                                </h4>
                                <p className="text-sm text-gray-400">
                                  Produkt ID: {item.product_id}
                                </p>
                                <p className="text-xs text-red-400">
                                  <AlertCircle className="inline h-3 w-3 mr-1" />
                                  Produktdaten konnten nicht geladen werden
                                </p>
                                <div className="mt-2">
                                  <span className="text-sm">
                                    Menge: <strong>{item.quantity}</strong>
                                  </span>
                                </div>
                              </>
                            )}
                          </div>

                          {hasProduct && item.product!.image_url && (
                            <img
                              src={item.product!.image_url}
                              alt={item.product!.name}
                              className="w-16 h-16 rounded object-cover"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Debug Info */}
                {selectedOrder.order_items.some(item => !item.product) && (
                  <div className="bg-red-900 bg-opacity-30 rounded-lg p-3 text-sm">
                    <AlertCircle className="inline h-4 w-4 mr-1" />
                    Einige Produktdaten fehlen. Bitte Datenbank prüfen.
                  </div>
                )}

                {/* Complete Button */}
                {pickedItems.size === selectedOrder.order_items.length && (
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