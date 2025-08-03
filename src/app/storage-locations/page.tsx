'use client';

import { useState, useEffect } from 'react';
import {
  Warehouse,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Check,
  AlertCircle,
  Package,
  Grid3x3,
  Search,
  ToggleLeft,
  ToggleRight,
  MapPin
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface StorageLocation {
  id: string;
  code: string;
  name: string;
  zone: string | null;
  aisle: string | null;
  shelf: string | null;
  bin: string | null;
  capacity: number;
  current_usage: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  current_stock: number;
}

export default function StorageLocationsPage() {
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [products, setProducts] = useState<{ [key: string]: Product[] }>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterZone, setFilterZone] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<StorageLocation | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [zones, setZones] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    zone: '',
    aisle: '',
    shelf: '',
    bin: '',
    capacity: 100,
    is_active: true
  });

  useEffect(() => {
    fetchLocations();
    fetchProductsAtLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('storage_locations')
        .select('*')
        .order('code');

      if (error) throw error;

      setLocations(data || []);
      
      // Extrahiere Zonen
      const uniqueZones = [...new Set(data?.map(l => l.zone).filter(Boolean))] as string[];
      setZones(uniqueZones);
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast.error('Fehler beim Laden der Lagerplätze');
    } finally {
      setLoading(false);
    }
  };

  const fetchProductsAtLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, current_stock, storage_location')
        .not('storage_location', 'is', null);

      if (!error && data) {
        const productsByLocation: { [key: string]: Product[] } = {};
        data.forEach(product => {
          if (product.storage_location) {
            if (!productsByLocation[product.storage_location]) {
              productsByLocation[product.storage_location] = [];
            }
            productsByLocation[product.storage_location].push(product);
          }
        });
        setProducts(productsByLocation);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Generate code if not provided
      const locationCode = formData.code || generateLocationCode(formData);
      
      // Bereite die Daten vor - nur die Felder die in der DB existieren
      const locationData: any = {
        code: locationCode,
        name: formData.name,
        updated_at: new Date().toISOString()
      };

      // Füge optionale Felder nur hinzu wenn sie existieren
      if (formData.zone) locationData.zone = formData.zone;
      if (formData.aisle) locationData.aisle = formData.aisle;
      if (formData.shelf) locationData.shelf = formData.shelf;
      if (formData.bin) locationData.bin = formData.bin;
      if (formData.capacity) locationData.capacity = formData.capacity;
      if (typeof formData.is_active === 'boolean') locationData.is_active = formData.is_active;

      console.log('Saving location data:', locationData);

      if (editingLocation) {
        const { data, error } = await supabase
          .from('storage_locations')
          .update(locationData)
          .eq('id', editingLocation.id)
          .select()
          .single();

        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        
        console.log('Updated location:', data);
        toast.success('Lagerplatz erfolgreich aktualisiert');
      } else {
        // Für neue Einträge, setze current_usage auf 0
        locationData.current_usage = 0;
        
        const { data, error } = await supabase
          .from('storage_locations')
          .insert([locationData])
          .select()
          .single();

        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
        
        console.log('Created location:', data);
        toast.success('Lagerplatz erfolgreich hinzugefügt');
      }

      setShowAddModal(false);
      setShowEditModal(false);
      setEditingLocation(null);
      resetForm();
      await fetchLocations();
      await fetchProductsAtLocations();
    } catch (error: any) {
      console.error('Error saving location:', error);
      if (error.code === '23505') {
        toast.error('Dieser Lagerplatz-Code existiert bereits');
      } else if (error.message) {
        toast.error(`Fehler: ${error.message}`);
      } else {
        toast.error('Fehler beim Speichern des Lagerplatzes');
      }
    }
  };

  const handleDelete = async (id: string, code: string) => {
    // Prüfe ob Produkte am Lagerplatz sind
    const productsAtLocation = products[code] || [];
    
    if (productsAtLocation.length > 0) {
      const confirmMove = confirm(
        `Es befinden sich ${productsAtLocation.length} Produkte an diesem Lagerplatz.\n` +
        `Möchten Sie den Lagerplatz trotzdem löschen?\n` +
        `Die Produkte werden dann keinem Lagerplatz zugeordnet sein.`
      );
      
      if (!confirmMove) return;
      
      // Entferne Lagerplatz von Produkten
      const { error: updateError } = await supabase
        .from('products')
        .update({ storage_location: null })
        .eq('storage_location', code);
        
      if (updateError) {
        toast.error('Fehler beim Aktualisieren der Produkte');
        return;
      }
    } else {
      if (!confirm('Möchten Sie diesen Lagerplatz wirklich löschen?')) return;
    }

    try {
      const { error } = await supabase
        .from('storage_locations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Lagerplatz erfolgreich gelöscht');
      fetchLocations();
      fetchProductsAtLocations();
    } catch (error) {
      console.error('Error deleting location:', error);
      toast.error('Fehler beim Löschen des Lagerplatzes');
    }
  };

  const toggleActive = async (location: StorageLocation) => {
    try {
      const newStatus = !location.is_active;
      
      const { data, error } = await supabase
        .from('storage_locations')
        .update({ 
          is_active: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', location.id)
        .select()
        .single();

      if (error) {
        console.error('Toggle error:', error);
        throw error;
      }

      console.log('Toggled location:', data);
      
      toast.success(
        newStatus 
          ? 'Lagerplatz aktiviert' 
          : 'Lagerplatz deaktiviert'
      );
      
      await fetchLocations();
    } catch (error: any) {
      console.error('Error toggling location:', error);
      if (error.message) {
        toast.error(`Fehler: ${error.message}`);
      } else {
        toast.error('Fehler beim Ändern des Status');
      }
    }
  };

  const generateLocationCode = (data: any) => {
    const parts = [
      data.zone || 'Z',
      data.aisle || 'A',
      data.shelf || 'S',
      data.bin || 'B'
    ].filter(Boolean);
    
    return parts.join('-').toUpperCase();
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      zone: '',
      aisle: '',
      shelf: '',
      bin: '',
      capacity: 100,
      is_active: true
    });
  };

  const openEditModal = (location: StorageLocation) => {
    setEditingLocation(location);
    setFormData({
      code: location.code,
      name: location.name,
      zone: location.zone || '',
      aisle: location.aisle || '',
      shelf: location.shelf || '',
      bin: location.bin || '',
      capacity: location.capacity,
      is_active: location.is_active
    });
    setShowEditModal(true);
  };

  const filteredLocations = locations.filter(location => {
    const matchesSearch = 
      location.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesZone = filterZone === 'all' || location.zone === filterZone;
    const matchesActive = showInactive || location.is_active;
    
    return matchesSearch && matchesZone && matchesActive;
  });

  const getUsageColor = (usage: number, capacity: number) => {
    const percentage = (usage / capacity) * 100;
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Lade Lagerplätze...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <Warehouse className="text-blue-600" />
              Lagerplätze verwalten
            </h1>
            <button
              onClick={() => {
                resetForm();
                setEditingLocation(null);
                setShowAddModal(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus size={20} />
              Neuer Lagerplatz
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Lagerplatz suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterZone}
              onChange={(e) => setFilterZone(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Alle Zonen</option>
              {zones.map(zone => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
            <button
              onClick={() => setShowInactive(!showInactive)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                showInactive 
                  ? 'bg-gray-600 text-white' 
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {showInactive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
              Inaktive {showInactive ? 'anzeigen' : 'ausblenden'}
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Gesamt</div>
              <div className="text-2xl font-bold">{locations.length}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Aktiv</div>
              <div className="text-2xl font-bold text-green-600">
                {locations.filter(l => l.is_active).length}
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Belegt</div>
              <div className="text-2xl font-bold text-blue-600">
                {Object.keys(products).length}
              </div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Zonen</div>
              <div className="text-2xl font-bold text-yellow-600">{zones.length}</div>
            </div>
          </div>
        </div>

        {/* Locations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLocations.map((location) => {
            const productsAtLocation = products[location.code] || [];
            const usagePercentage = location.capacity > 0 
              ? (productsAtLocation.length / location.capacity) * 100 
              : 0;

            return (
              <div 
                key={location.id} 
                className={`bg-white rounded-lg shadow-md p-6 ${
                  !location.is_active ? 'opacity-60' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <MapPin className="text-blue-600" size={20} />
                      {location.code}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{location.name}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditModal(location)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Bearbeiten"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => toggleActive(location)}
                      className={`p-2 rounded-lg ${
                        location.is_active 
                          ? 'text-green-600 hover:bg-green-50' 
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                      title={location.is_active ? 'Deaktivieren' : 'Aktivieren'}
                    >
                      {location.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    </button>
                    <button
                      onClick={() => handleDelete(location.id, location.code)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Löschen"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Location Details */}
                <div className="space-y-2 mb-4">
                  {location.zone && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">Zone:</span>
                      <span className="font-medium">{location.zone}</span>
                    </div>
                  )}
                  {location.aisle && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">Gang:</span>
                      <span className="font-medium">{location.aisle}</span>
                    </div>
                  )}
                  {location.shelf && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">Regal:</span>
                      <span className="font-medium">{location.shelf}</span>
                    </div>
                  )}
                  {location.bin && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">Fach:</span>
                      <span className="font-medium">{location.bin}</span>
                    </div>
                  )}
                </div>

                {/* Usage Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Auslastung</span>
                    <span className="font-medium">
                      {productsAtLocation.length} / {location.capacity}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getUsageColor(productsAtLocation.length, location.capacity)}`}
                      style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Products at Location */}
                {productsAtLocation.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Produkte ({productsAtLocation.length}):
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {productsAtLocation.slice(0, 3).map((product) => (
                        <div key={product.id} className="text-xs text-gray-600">
                          • {product.name} ({product.current_stock} Stk)
                        </div>
                      ))}
                      {productsAtLocation.length > 3 && (
                        <div className="text-xs text-gray-500">
                          +{productsAtLocation.length - 3} weitere
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Status Badge */}
                <div className="mt-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    !location.is_active
                      ? 'bg-gray-100 text-gray-600'
                      : productsAtLocation.length === 0
                      ? 'bg-green-100 text-green-800'
                      : usagePercentage >= 90
                      ? 'bg-red-100 text-red-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {!location.is_active
                      ? 'Inaktiv'
                      : productsAtLocation.length === 0
                      ? 'Leer'
                      : usagePercentage >= 90
                      ? 'Fast voll'
                      : 'In Verwendung'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {filteredLocations.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
            <Warehouse size={48} className="mx-auto mb-4 text-gray-300" />
            Keine Lagerplätze gefunden
          </div>
        )}

        {/* Add/Edit Modal */}
        {(showAddModal || showEditModal) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">
                  {editingLocation ? 'Lagerplatz bearbeiten' : 'Neuer Lagerplatz'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setEditingLocation(null);
                    resetForm();
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="z.B. A-01-03"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Eindeutiger Code für den Lagerplatz
                    </p>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="z.B. Hauptlager Regal 1"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Zone
                    </label>
                    <input
                      type="text"
                      value={formData.zone}
                      onChange={(e) => setFormData({ ...formData, zone: e.target.value.toUpperCase() })}
                      placeholder="z.B. A"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gang
                    </label>
                    <input
                      type="text"
                      value={formData.aisle}
                      onChange={(e) => setFormData({ ...formData, aisle: e.target.value })}
                      placeholder="z.B. 01"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Regal
                    </label>
                    <input
                      type="text"
                      value={formData.shelf}
                      onChange={(e) => setFormData({ ...formData, shelf: e.target.value })}
                      placeholder="z.B. 03"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fach
                    </label>
                    <input
                      type="text"
                      value={formData.bin}
                      onChange={(e) => setFormData({ ...formData, bin: e.target.value })}
                      placeholder="z.B. B"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kapazität (Anzahl Produkte)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <div className="flex items-center gap-3 mt-3">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_active}
                          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm">Aktiv</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="text-blue-600 mt-0.5" size={16} />
                    <div className="text-sm text-blue-800">
                      <strong>Tipp:</strong> Der Code wird automatisch generiert, wenn Sie Zone, Gang, Regal und Fach ausfüllen.
                      Sie können ihn aber auch manuell eingeben.
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(false);
                      setEditingLocation(null);
                      resetForm();
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Save size={20} />
                    {editingLocation ? 'Speichern' : 'Hinzufügen'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}