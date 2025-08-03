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
  Package
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

interface PicklistItem {
  sku: string;
  title: string;
  storage_location: string;
  total_quantity: number;
  orders: {
    order_number: string;
    quantity: number;
    customer_name: string;
  }[];
  picked: boolean;
}

export default function OrderPickingPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unfulfilled' | 'fulfilled'>('unfulfilled');
  const [viewMode, setViewMode] = useState<'orders' | 'picklist'>('orders');
  const [picklist, setPicklist] = useState<PicklistItem[]>([]);

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

  const generatePicklist = () => {
    if (selectedOrders.size === 0) {
      toast.error('Bitte wählen Sie mindestens eine Bestellung aus');
      return;
    }

    const itemsMap = new Map<string, PicklistItem>();
    
    orders
      .filter(order => selectedOrders.has(order.id))
      .forEach(order => {
        order.order_items.forEach(item => {
          const key = item.sku || item.title;
          
          if (!itemsMap.has(key)) {
            itemsMap.set(key, {
              sku: item.sku || '',
              title: item.title,
              storage_location: item.product?.storage_location || 'Kein Lagerplatz',
              total_quantity: 0,
              orders: [],
              picked: false
            });
          }
          
          const picklistItem = itemsMap.get(key)!;
          picklistItem.total_quantity += item.quantity;
          picklistItem.orders.push({
            order_number: order.order_number,
            quantity: item.quantity,
            customer_name: order.customer_name
          });
        });
      });

    const sortedItems = Array.from(itemsMap.values()).sort((a, b) => {
      if (a.storage_location === 'Kein Lagerplatz' && b.storage_location !== 'Kein Lagerplatz') return 1;
      if (a.storage_location !== 'Kein Lagerplatz' && b.storage_location === 'Kein Lagerplatz') return -1;
      if (a.storage_location < b.storage_location) return -1;
      if (a.storage_location > b.storage_location) return 1;
      return a.sku.localeCompare(b.sku);
    });

    setPicklist(sortedItems);
    setViewMode('picklist');
    toast.success(`Pickliste mit ${sortedItems.length} Positionen erstellt`);
  };

  const togglePickedItem = (index: number) => {
    const updatedPicklist = [...picklist];
    updatedPicklist[index].picked = !updatedPicklist[index].picked;
    setPicklist(updatedPicklist);

    const allPicked = updatedPicklist.every(item => item.picked);
    if (allPicked) {
      toast.success('Alle Artikel gepickt! Bereit zum Verpacken.');
    }
  };

  const completePicklist = async () => {
    const unpickedItems = picklist.filter(item => !item.picked);
    
    if (unpickedItems.length > 0) {
      const confirm = window.confirm(`Es sind noch ${unpickedItems.length} Artikel nicht gepickt. Trotzdem abschließen?`);
      if (!confirm) return;
    }

    const loadingToast = toast.loading('Aktualisiere Bestellstatus...');
    
    try {
      const updatePromises = Array.from(selectedOrders).map(orderId => 
        supabase
          .from('orders')
          .update({ 
            fulfillment_status: 'fulfilled',
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId)
      );

      await Promise.all(updatePromises);
      toast.success('Bestellungen als erfüllt markiert!', { id: loadingToast });
      
      setSelectedOrders(new Set());
      setPicklist([]);
      setViewMode('orders');
      await fetchOrders();
      
    } catch (error) {
      toast.error('Fehler beim Aktualisieren', { id: loadingToast });
      console.error(error);
    }
  };

  const printPicklist = () => {
    const printContent = `
      <html>
        <head>
          <title>Pickliste - ${new Date().toLocaleDateString('de-DE')}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 24px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .location { font-weight: bold; font-size: 16px; color: #1e40af; }
            .checkbox { width: 30px; height: 30px; border: 2px solid #000; display: inline-block; }
            @media print { 
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Pickliste - ${new Date().toLocaleDateString('de-DE')} ${new Date().toLocaleTimeString('de-DE')}</h1>
          <p><strong>Anzahl Bestellungen:</strong> ${Array.from(selectedOrders).length}</p>
          <p><strong>Anzahl Positionen:</strong> ${picklist.length}</p>
          <table>
            <thead>
              <tr>
                <th style="width: 50px;">✓</th>
                <th style="width: 150px;">Lagerplatz</th>
                <th style="width: 120px;">SKU</th>
                <th>Artikel</th>
                <th style="width: 80px;">Menge</th>
                <th>Bestellungen</th>
              </tr>
            </thead>
            <tbody>
              ${picklist.map(item => `
                <tr>
                  <td><div class="checkbox"></div></td>
                  <td class="location">${item.storage_location}</td>
                  <td>${item.sku}</td>
                  <td>${item.title}</td>
                  <td style="text-align: center;"><strong>${item.total_quantity}</strong></td>
                  <td style="font-size: 12px;">${item.orders.map(o => `#${o.order_number} (${o.quantity}x)`).join(', ')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="margin-top: 40px; border-top: 2px solid #000; padding-top: 20px;">
            <p><strong>Gepickt von:</strong> _________________________</p>
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
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold">Kommissionierung</h1>
              <p className="text-gray-600">
                {viewMode === 'orders' ? 'Bestellungen verwalten' : 'Pickliste abarbeiten'}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {viewMode === 'orders' ? (
              <>
                {selectedOrders.size > 0 && (
                  <button
                    onClick={generatePicklist}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <ClipboardList className="h-5 w-5" />
                    Pickliste erstellen ({selectedOrders.size})
                  </button>
                )}
                <button
                  onClick={syncOrders}
                  disabled={syncing}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Synchronisiere...' : 'Sync Orders'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={printPicklist}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <Printer className="h-5 w-5" />
                  Drucken
                </button>
                <button
                  onClick={completePicklist}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <CheckCircle className="h-5 w-5" />
                  Picking abschließen
                </button>
                <button
                  onClick={() => {
                    setViewMode('orders');
                    setPicklist([]);
                  }}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <X className="h-5 w-5" />
                  Abbrechen
                </button>
              </>
            )}
          </div>
        </div>

        {/* Statistiken */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Gesamt</p>
            <p className="text-2xl font-bold">{orders.length}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Offen</p>
            <p className="text-2xl font-bold text-orange-600">
              {orders.filter(o => o.fulfillment_status === 'unfulfilled').length}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Erfüllt</p>
            <p className="text-2xl font-bold text-green-600">
              {orders.filter(o => o.fulfillment_status === 'fulfilled').length}
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Ausgewählt</p>
            <p className="text-2xl font-bold text-blue-600">{selectedOrders.size}</p>
          </div>
        </div>
      </div>

      {/* Picklist View */}
      {viewMode === 'picklist' ? (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2">Pickliste</h2>
            <div className="flex justify-between items-center">
              <p className="text-gray-600">
                {picklist.filter(item => item.picked).length} von {picklist.length} Artikeln gepickt
              </p>
              <div className="w-64 bg-gray-200 rounded-full h-4">
                <div 
                  className="bg-green-600 h-4 rounded-full transition-all"
                  style={{ 
                    width: `${picklist.length > 0 ? (picklist.filter(item => item.picked).length / picklist.length) * 100 : 0}%` 
                  }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {picklist.map((item, index) => (
              <div 
                key={`${item.sku}-${index}`}
                className={`border rounded-lg p-4 transition-all ${
                  item.picked ? 'bg-green-50 border-green-300' : 'bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => togglePickedItem(index)}
                      className={`w-8 h-8 rounded border-2 flex items-center justify-center transition-colors ${
                        item.picked 
                          ? 'bg-green-600 border-green-600' 
                          : 'border-gray-300 hover:border-green-600'
                      }`}
                    >
                      {item.picked && <Check className="h-5 w-5 text-white" />}
                    </button>
                    
                    <div className="flex items-center gap-6">
                      <div className="bg-blue-100 px-3 py-1 rounded-lg">
                        <span className="font-bold text-blue-800">{item.storage_location}</span>
                      </div>
                      
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-gray-600">SKU: {item.sku}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-2xl font-bold">{item.total_quantity}x</p>
                      <p className="text-xs text-gray-500">Gesamt</p>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Bestellungen:</p>
                      <div className="text-xs space-y-1">
                        {item.orders.map((o, i) => (
                          <div key={i}>
                            #{o.order_number} ({o.quantity}x)
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Filter und Suche */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Suche nach Bestellnummer oder Kunde..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="all">Alle Bestellungen</option>
                <option value="unfulfilled">Offen</option>
                <option value="fulfilled">Erfüllt</option>
              </select>
              {selectedOrders.size > 0 && (
                <button
                  onClick={() => setSelectedOrders(new Set())}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Auswahl aufheben
                </button>
              )}
            </div>
          </div>

          {/* Orders List */}
          <div className="space-y-4">
            {filteredOrders.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">Keine Bestellungen gefunden</h3>
                <p className="text-gray-500">
                  {searchTerm ? 'Versuchen Sie eine andere Suche' : 'Synchronisieren Sie Bestellungen von Shopify'}
                </p>
              </div>
            ) : (
              filteredOrders.map(order => (
                <div 
                  key={order.id}
                  className={`bg-white rounded-lg shadow-md p-6 transition-all ${
                    selectedOrders.has(order.id) ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={selectedOrders.has(order.id)}
                        onChange={(e) => {
                          const newSelection = new Set(selectedOrders);
                          if (e.target.checked) {
                            newSelection.add(order.id);
                          } else {
                            newSelection.delete(order.id);
                          }
                          setSelectedOrders(newSelection);
                        }}
                        className="mt-1 w-5 h-5 rounded border-gray-300"
                        disabled={order.fulfillment_status === 'fulfilled'}
                      />
                      
                      <div>
                        <h3 className="text-lg font-semibold">
                          Bestellung #{order.order_number}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                          <span className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {order.customer_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {order.shipping_city || 'Keine Adresse'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(order.shopify_created_at).toLocaleDateString('de-DE')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        order.fulfillment_status === 'fulfilled'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {order.fulfillment_status === 'fulfilled' ? 'Erfüllt' : 'Offen'}
                      </span>
                      <span className="text-lg font-bold">
                        €{Number(order.total_price).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">Artikel ({order.order_items.length})</h4>
                    <div className="space-y-2">
                      {order.order_items.map(item => (
                        <div key={item.id} className="flex justify-between items-center py-2 border-b last:border-0">
                          <div className="flex-1">
                            <p className="font-medium">{item.title}</p>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span>SKU: {item.sku}</span>
                              {item.product?.storage_location && (
                                <span className="flex items-center gap-1 text-blue-600">
                                  <MapPin className="h-3 w-3" />
                                  {item.product.storage_location}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{item.quantity}x</p>
                            <p className="text-sm text-gray-600">€{Number(item.price).toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {order.note && (
                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>Notiz:</strong> {order.note}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}