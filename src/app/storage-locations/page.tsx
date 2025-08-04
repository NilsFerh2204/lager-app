'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Warehouse,
  QrCode,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Search,
  Package,
  MapPin,
  ArrowRight,
  Printer,
  Download,
  Grid3x3,
  AlertCircle,
  Check,
  Loader2,
  Copy,
  Move
} from 'lucide-react';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';

interface StorageLocation {
  id: string;
  code: string;
  name: string;
  zone: string;
  row_num: string;  // Geändert von row zu row_num
  shelf: string;
  level: string;
  capacity: number;
  current_usage: number;
  created_at: string;
  updated_at: string;
}

interface ProductLocation {
  id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  is_primary: boolean;
  product?: {
    name: string;
    sku: string;
    current_stock: number;
  };
  location?: StorageLocation;
}

export default function StorageLocationsPage() {
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [productLocations, setProductLocations] = useState<ProductLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState<StorageLocation | null>(null);
  const [showMoveModal, setShowMoveModal] = useState<{product: any, from: StorageLocation} | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Form states
  const [formData, setFormData] = useState({
    zone: '',
    row_num: '',  // Geändert von row zu row_num
    shelf: '',
    level: '',
    name: '',
    capacity: 100
  });

  const [moveFormData, setMoveFormData] = useState({
    targetLocationId: '',
    quantity: 0
  });

  useEffect(() => {
    fetchLocations();
    fetchProductLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('storage_locations')
        .select('*')
        .order('zone, row_num, shelf, level');  // Geändert von row zu row_num

      if (error) throw error;
      setLocations(data || []);
    } catch (error: any) {
      console.error('Error fetching locations:', error);
      toast.error('Fehler beim Laden der Lagerplätze');
    } finally {
      setLoading(false);
    }
  };

  const fetchProductLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('product_locations')
        .select(`
          *,
          product:product_id (
            name,
            sku,
            current_stock
          ),
          location:location_id (*)
        `);

      if (error) throw error;
      setProductLocations(data || []);
    } catch (error: any) {
      console.error('Error fetching product locations:', error);
    }
  };

  const generateLocationCode = (data: typeof formData) => {
    return `${data.zone}${data.row_num}-${data.shelf}${data.level}`;  // Geändert von row zu row_num
  };

  const createLocation = async () => {
    const code = generateLocationCode(formData);
    
    // Check if location already exists
    const existing = locations.find(l => l.code === code);
    if (existing) {
      toast.error('Dieser Lagerplatz existiert bereits');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('storage_locations')
        .insert({
          code,
          name: formData.name || code,
          zone: formData.zone,
          row_num: formData.row_num,  // Geändert von row zu row_num
          shelf: formData.shelf,
          level: formData.level,
          capacity: formData.capacity,
          current_usage: 0
        })
        .select()
        .single();

      if (error) throw error;

      setLocations([...locations, data]);
      toast.success('Lagerplatz erstellt');
      setIsCreating(false);
      setFormData({ zone: '', row_num: '', shelf: '', level: '', name: '', capacity: 100 });  // Geändert
    } catch (error: any) {
      console.error('Error creating location:', error);
      toast.error('Fehler beim Erstellen des Lagerplatzes');
    }
  };

  const updateLocation = async (id: string, updates: Partial<StorageLocation>) => {
    try {
      const { error } = await supabase
        .from('storage_locations')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setLocations(locations.map(l => 
        l.id === id ? { ...l, ...updates } : l
      ));
      toast.success('Lagerplatz aktualisiert');
      setEditingLocation(null);
    } catch (error: any) {
      console.error('Error updating location:', error);
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const deleteLocation = async (id: string) => {
    if (!confirm('Wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('storage_locations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setLocations(locations.filter(l => l.id !== id));
      toast.success('Lagerplatz gelöscht');
    } catch (error: any) {
      console.error('Error deleting location:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const generateQRCode = async (location: StorageLocation) => {
    setShowQRModal(location);
    
    // Wait for canvas to be rendered
    setTimeout(async () => {
      if (qrCanvasRef.current) {
        try {
          const qrData = JSON.stringify({
            type: 'storage_location',
            code: location.code,
            id: location.id,
            zone: location.zone,
            row_num: location.row_num,  // Geändert von row zu row_num
            shelf: location.shelf,
            level: location.level
          });

          await QRCode.toCanvas(qrCanvasRef.current, qrData, {
            width: 256,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
        } catch (error) {
          console.error('Error generating QR code:', error);
          toast.error('Fehler beim Generieren des QR-Codes');
        }
      }
    }, 100);
  };

  const downloadQRCode = () => {
    if (qrCanvasRef.current && showQRModal) {
      const url = qrCanvasRef.current.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `lagerplatz-${showQRModal.code}.png`;
      link.href = url;
      link.click();
    }
  };

  const printQRCode = () => {
    if (qrCanvasRef.current && showQRModal) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        const qrImage = qrCanvasRef.current.toDataURL('image/png');
        printWindow.document.write(`
          <html>
            <head>
              <title>QR-Code Lagerplatz ${showQRModal.code}</title>
              <style>
                body { 
                  display: flex; 
                  flex-direction: column;
                  align-items: center; 
                  justify-content: center; 
                  min-height: 100vh;
                  font-family: Arial, sans-serif;
                }
                h1 { margin-bottom: 20px; }
                .info { margin-top: 20px; font-size: 18px; }
              </style>
            </head>
            <body>
              <h1>Lagerplatz: ${showQRModal.code}</h1>
              <img src="${qrImage}" alt="QR Code" />
              <div class="info">
                <p><strong>Zone:</strong> ${showQRModal.zone}</p>
                <p><strong>Reihe:</strong> ${showQRModal.row_num}</p>
                <p><strong>Regal:</strong> ${showQRModal.shelf}</p>
                <p><strong>Ebene:</strong> ${showQRModal.level}</p>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 250);
      }
    }
  };

  const moveProduct = async () => {
    if (!showMoveModal || !moveFormData.targetLocationId) return;

    try {
      // Update product_locations table
      const { error } = await supabase
        .from('product_locations')
        .upsert({
          product_id: showMoveModal.product.id,
          location_id: moveFormData.targetLocationId,
          quantity: moveFormData.quantity,
          is_primary: true
        });

      if (error) throw error;

      // Update product's main storage_location
      await supabase
        .from('products')
        .update({ 
          storage_location: locations.find(l => l.id === moveFormData.targetLocationId)?.code 
        })
        .eq('id', showMoveModal.product.id);

      toast.success('Produkt umgelagert');
      setShowMoveModal(null);
      setMoveFormData({ targetLocationId: '', quantity: 0 });
      fetchProductLocations();
    } catch (error: any) {
      console.error('Error moving product:', error);
      toast.error('Fehler beim Umlagern');
    }
  };

  const filteredLocations = locations.filter(location => {
    const matchesSearch = 
      location.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesZone = selectedZone === 'all' || location.zone === selectedZone;
    return matchesSearch && matchesZone;
  });

  const zones = [...new Set(locations.map(l => l.zone))];

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
            <Warehouse className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold">Lagerplätze</h1>
              <p className="text-gray-600">Verwaltung und QR-Code Generierung</p>
            </div>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Neuer Lagerplatz
          </button>
        </div>

        {/* Statistiken */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Gesamt</p>
            <p className="text-2xl font-bold">{locations.length}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Zonen</p>
            <p className="text-2xl font-bold text-blue-600">{zones.length}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Belegt</p>
            <p className="text-2xl font-bold text-green-600">
              {locations.filter(l => l.current_usage > 0).length}
            </p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Auslastung</p>
            <p className="text-2xl font-bold text-orange-600">
              {locations.length > 0 
                ? Math.round((locations.reduce((sum, l) => sum + l.current_usage, 0) / 
                   locations.reduce((sum, l) => sum + l.capacity, 0)) * 100)
                : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Suche nach Code oder Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="all">Alle Zonen</option>
            {zones.map(zone => (
              <option key={zone} value={zone}>Zone {zone}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Locations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredLocations.map(location => (
          <div key={location.id} className="bg-white rounded-lg shadow-md p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-lg font-bold">{location.code}</h3>
                {location.name !== location.code && (
                  <p className="text-sm text-gray-600">{location.name}</p>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => generateQRCode(location)}
                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                  title="QR-Code anzeigen"
                >
                  <QrCode className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setEditingLocation(location.id)}
                  className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                  title="Bearbeiten"
                >
                  <Edit className="h-5 w-5" />
                </button>
                <button
                  onClick={() => deleteLocation(location.id)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                  title="Löschen"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Zone:</span>
                <span className="font-medium">{location.zone}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Reihe:</span>
                <span className="font-medium">{location.row_num}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Regal:</span>
                <span className="font-medium">{location.shelf}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Ebene:</span>
                <span className="font-medium">{location.level}</span>
              </div>
              
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Auslastung:</span>
                  <span className={`text-sm font-medium ${
                    location.current_usage >= location.capacity ? 'text-red-600' :
                    location.current_usage > location.capacity * 0.8 ? 'text-orange-600' :
                    'text-green-600'
                  }`}>
                    {location.current_usage}/{location.capacity}
                  </span>
                </div>
                <div className="mt-1 bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      location.current_usage >= location.capacity ? 'bg-red-600' :
                      location.current_usage > location.capacity * 0.8 ? 'bg-orange-600' :
                      'bg-green-600'
                    }`}
                    style={{ 
                      width: `${Math.min(100, (location.current_usage / location.capacity) * 100)}%` 
                    }}
                  />
                </div>
              </div>

              {/* Products at this location */}
              {productLocations.filter(pl => pl.location_id === location.id).length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-gray-600 mb-1">Produkte hier:</p>
                  {productLocations
                    .filter(pl => pl.location_id === location.id)
                    .slice(0, 3)
                    .map(pl => (
                      <div key={pl.id} className="text-xs bg-gray-50 p-1 rounded mb-1">
                        {pl.product?.name} ({pl.quantity}x)
                      </div>
                    ))
                  }
                  {productLocations.filter(pl => pl.location_id === location.id).length > 3 && (
                    <p className="text-xs text-gray-500">
                      +{productLocations.filter(pl => pl.location_id === location.id).length - 3} weitere
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create Location Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4">Neuer Lagerplatz</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Zone</label>
                  <input
                    type="text"
                    value={formData.zone}
                    onChange={(e) => setFormData({...formData, zone: e.target.value.toUpperCase()})}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="A"
                    maxLength={1}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Reihe</label>
                  <input
                    type="text"
                    value={formData.row_num}
                    onChange={(e) => setFormData({...formData, row_num: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="01"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Regal</label>
                  <input
                    type="text"
                    value={formData.shelf}
                    onChange={(e) => setFormData({...formData, shelf: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="01"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Ebene</label>
                  <input
                    type="text"
                    value={formData.level}
                    onChange={(e) => setFormData({...formData, level: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="A"
                    maxLength={1}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Name (optional)</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Beschreibung..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Kapazität</label>
                <input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({...formData, capacity: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border rounded-lg"
                  min="1"
                />
              </div>

              {formData.zone && formData.row_num && formData.shelf && formData.level && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Vorschau Code:</p>
                  <p className="font-bold text-lg">{generateLocationCode(formData)}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setIsCreating(false);
                  setFormData({ zone: '', row_num: '', shelf: '', level: '', name: '', capacity: 100 });
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Abbrechen
              </button>
              <button
                onClick={createLocation}
                disabled={!formData.zone || !formData.row_num || !formData.shelf || !formData.level}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">QR-Code: {showQRModal.code}</h2>
              <button
                onClick={() => setShowQRModal(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex justify-center mb-4">
              <canvas ref={qrCanvasRef} />
            </div>

            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Zone:</span>
                  <span className="font-medium ml-1">{showQRModal.zone}</span>
                </div>
                <div>
                  <span className="text-gray-600">Reihe:</span>
                  <span className="font-medium ml-1">{showQRModal.row_num}</span>
                </div>
                <div>
                  <span className="text-gray-600">Regal:</span>
                  <span className="font-medium ml-1">{showQRModal.shelf}</span>
                </div>
                <div>
                  <span className="text-gray-600">Ebene:</span>
                  <span className="font-medium ml-1">{showQRModal.level}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={downloadQRCode}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Download className="h-5 w-5" />
                Download
              </button>
              <button
                onClick={printQRCode}
                className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2"
              >
                <Printer className="h-5 w-5" />
                Drucken
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Product Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4">Produkt umlagern</h2>
            <p className="text-sm text-gray-600 mb-4">
              Von: {showMoveModal.from.code} → Neuer Lagerplatz
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Ziel-Lagerplatz</label>
                <select
                  value={moveFormData.targetLocationId}
                  onChange={(e) => setMoveFormData({...moveFormData, targetLocationId: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Wählen...</option>
                  {locations
                    .filter(l => l.id !== showMoveModal.from.id)
                    .map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.code} - {loc.name} (Frei: {loc.capacity - loc.current_usage})
                      </option>
                    ))
                  }
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Menge</label>
                <input
                  type="number"
                  value={moveFormData.quantity}
                  onChange={(e) => setMoveFormData({...moveFormData, quantity: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border rounded-lg"
                  min="1"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowMoveModal(null);
                  setMoveFormData({ targetLocationId: '', quantity: 0 });
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Abbrechen
              </button>
              <button
                onClick={moveProduct}
                disabled={!moveFormData.targetLocationId || moveFormData.quantity <= 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Umlagern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}