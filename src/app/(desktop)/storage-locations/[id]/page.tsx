'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Package, 
  MapPin, 
  Calendar,
  AlertTriangle,
  Plus,
  Minus,
  Edit,
  Trash2,
  Box,
  Barcode,
  Hash
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  description: string;
  current_stock: number;
  min_stock: number;
  price: number;
  unit: string;
  category: string;
}

interface InventoryItem {
  id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  batch_number: string;
  notes: string;
  expiry_date: string;
  last_counted: string;
  created_at: string;
  updated_at: string;
  product: Product;
}

interface StorageLocation {
  id: string;
  code: string;
  name: string;
  zone: string;
  type: string;
  rack_number: number;
  position_number: number;
  max_capacity: number;
  current_capacity: number;
  is_available: boolean;
  created_at: string;
}

export default function StorageLocationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locationId = params.id as string;

  const [location, setLocation] = useState<StorageLocation | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<InventoryItem | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

  useEffect(() => {
    if (locationId) {
      fetchLocationDetails();
    }
  }, [locationId]);

  const fetchLocationDetails = async () => {
    try {
      // Hole Lagerplatz-Details
      const { data: locationData, error: locationError } = await supabase
        .from('storage_locations')
        .select('*')
        .eq('id', locationId)
        .single();

      if (locationError) throw locationError;
      setLocation(locationData);

      // Hole Inventar für diesen Lagerplatz
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory')
        .select(`
          *,
          product:products(*)
        `)
        .eq('location_id', locationId)
        .order('updated_at', { ascending: false });

      if (inventoryError) throw inventoryError;
      setInventory(inventoryData || []);

      // Berechne aktuelle Kapazität
      const totalQuantity = inventoryData?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      setLocation(prev => prev ? { ...prev, current_capacity: totalQuantity } : null);

    } catch (error) {
      console.error('Error fetching location details:', error);
      toast.error('Fehler beim Laden der Lagerplatz-Details');
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustQuantity = async () => {
    if (!selectedInventory) return;

    try {
      const newQuantity = selectedInventory.quantity + adjustQuantity;
      
      if (newQuantity < 0) {
        toast.error('Bestand kann nicht negativ sein');
        return;
      }

      // Update Inventar
      const { error: updateError } = await supabase
        .from('inventory')
        .update({ 
          quantity: newQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedInventory.id);

      if (updateError) throw updateError;

      // Erstelle Bewegung
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          type: adjustQuantity > 0 ? 'inbound' : 'outbound',
          product_id: selectedInventory.product_id,
          from_location_id: adjustQuantity < 0 ? locationId : null,
          to_location_id: adjustQuantity > 0 ? locationId : null,
          quantity: Math.abs(adjustQuantity),
          reason: adjustReason || 'Manuelle Anpassung'
        });

      if (movementError) throw movementError;

      // Update Produkt-Gesamtbestand
      const { error: productError } = await supabase
        .from('products')
        .update({ 
          current_stock: selectedInventory.product.current_stock + adjustQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedInventory.product_id);

      if (productError) throw productError;

      toast.success('Bestand erfolgreich angepasst');
      setShowAdjustModal(false);
      setSelectedInventory(null);
      setAdjustQuantity(0);
      setAdjustReason('');
      fetchLocationDetails();
    } catch (error) {
      console.error('Error adjusting quantity:', error);
      toast.error('Fehler beim Anpassen des Bestands');
    }
  };

  const handleRemoveProduct = async (inventoryId: string) => {
    if (!confirm('Möchten Sie dieses Produkt wirklich von diesem Lagerplatz entfernen?')) return;

    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', inventoryId);

      if (error) throw error;

      toast.success('Produkt erfolgreich entfernt');
      fetchLocationDetails();
    } catch (error) {
      console.error('Error removing product:', error);
      toast.error('Fehler beim Entfernen des Produkts');
    }
  };

  const getPositionLabel = (position: number) => {
    if (position <= 3) return `Unten ${position}`;
    if (position <= 6) return `Mitte ${position - 3}`;
    return `Oben ${position - 6}`;
  };

  const getCapacityPercentage = () => {
    if (!location) return 0;
    return (location.current_capacity / location.max_capacity) * 100;
  };

  const getCapacityColor = () => {
    const percentage = getCapacityPercentage();
    if (percentage === 0) return 'bg-green-500';
    if (percentage < 50) return 'bg-yellow-500';
    if (percentage < 80) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Lade Lagerplatz-Details...</div>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Lagerplatz nicht gefunden</h2>
          <Link href="/storage-locations" className="text-blue-600 hover:underline">
            Zurück zur Übersicht
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/storage-locations')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft size={24} />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                  <MapPin className="text-blue-600" />
                  {location.code}
                </h1>
                <p className="text-gray-600">{location.name}</p>
              </div>
            </div>
            <div className={`px-4 py-2 rounded-lg font-semibold ${
              location.is_available 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {location.is_available ? 'Verfügbar' : 'Gesperrt'}
            </div>
          </div>

          {/* Lagerplatz Info */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Zone</div>
              <div className="font-semibold">{location.zone}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Position</div>
              <div className="font-semibold">{getPositionLabel(location.position_number)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Typ</div>
              <div className="font-semibold capitalize">{location.type}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Produkte</div>
              <div className="font-semibold">{inventory.length} Artikel</div>
            </div>
          </div>

          {/* Kapazitätsanzeige */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Kapazität</span>
              <span className="font-semibold">
                {location.current_capacity} / {location.max_capacity} Stück ({getCapacityPercentage().toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div 
                className={`h-4 rounded-full transition-all ${getCapacityColor()}`}
                style={{ width: `${getCapacityPercentage()}%` }}
              />
            </div>
          </div>
        </div>

        {/* Produkte am Lagerplatz */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Package className="text-blue-600" />
              Produkte an diesem Lagerplatz
            </h2>
            <button
              onClick={() => router.push(`/products?add_to_location=${locationId}`)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus size={20} />
              Produkt hinzufügen
            </button>
          </div>

          {inventory.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Box size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Keine Produkte an diesem Lagerplatz</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produkt
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Barcode
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Menge
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Charge
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Wert
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aktionen
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inventory.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link 
                          href={`/products/${item.product_id}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {item.product.sku}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium">{item.product.name}</div>
                          {item.product.category && (
                            <div className="text-sm text-gray-500">{item.product.category}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Barcode size={16} />
                          {item.product.barcode || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold">
                          {item.quantity} {item.product.unit || 'Stk'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.batch_number || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.product.price 
                          ? `€ ${(item.quantity * item.product.price).toFixed(2)}`
                          : '-'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.product.current_stock <= item.product.min_stock ? (
                          <span className="flex items-center gap-1 text-red-600">
                            <AlertTriangle size={16} />
                            Niedrig
                          </span>
                        ) : (
                          <span className="text-green-600">OK</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedInventory(item);
                              setShowAdjustModal(true);
                            }}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Bestand anpassen"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleRemoveProduct(item.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Entfernen"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Zusammenfassung */}
          {inventory.length > 0 && (
            <div className="mt-6 pt-6 border-t grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Gesamtmenge</div>
                <div className="text-2xl font-bold text-gray-800">
                  {inventory.reduce((sum, item) => sum + item.quantity, 0)} Stück
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Gesamtwert</div>
                <div className="text-2xl font-bold text-gray-800">
                  € {inventory.reduce((sum, item) => 
                    sum + (item.quantity * (item.product.price || 0)), 0
                  ).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Auslastung</div>
                <div className="text-2xl font-bold text-gray-800">
                  {getCapacityPercentage().toFixed(1)}%
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal für Bestandsanpassung */}
        {showAdjustModal && selectedInventory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">Bestand anpassen</h3>
              <div className="mb-4">
                <p className="text-gray-600 mb-2">
                  Produkt: <span className="font-semibold">{selectedInventory.product.name}</span>
                </p>
                <p className="text-gray-600">
                  Aktueller Bestand: <span className="font-semibold">{selectedInventory.quantity}</span>
                </p>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Anpassung (+ für Zugang, - für Abgang)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAdjustQuantity(adjustQuantity - 1)}
                    className="p-2 bg-gray-200 hover:bg-gray-300 rounded"
                  >
                    <Minus size={20} />
                  </button>
                  <input
                    type="number"
                    value={adjustQuantity}
                    onChange={(e) => setAdjustQuantity(parseInt(e.target.value) || 0)}
                    className="flex-1 px-3 py-2 border rounded-lg text-center"
                  />
                  <button
                    onClick={() => setAdjustQuantity(adjustQuantity + 1)}
                    className="p-2 bg-gray-200 hover:bg-gray-300 rounded"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Neuer Bestand: <span className="font-semibold">
                    {selectedInventory.quantity + adjustQuantity}
                  </span>
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grund (optional)
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="z.B. Inventur, Schwund, Rückgabe..."
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowAdjustModal(false);
                    setSelectedInventory(null);
                    setAdjustQuantity(0);
                    setAdjustReason('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleAdjustQuantity}
                  disabled={adjustQuantity === 0}
                  className={`px-4 py-2 rounded-lg ${
                    adjustQuantity === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  Anpassen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}