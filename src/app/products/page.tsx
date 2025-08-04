'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Package,
  Edit,
  Trash2,
  Save,
  X,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  Download,
  Upload,
  MapPin,
  Plus,
  Move,
  QrCode,
  Eye,
  Copy,
  Image as ImageIcon,
  Grid,
  List
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  shopify_id: string | null;
  name: string;
  sku: string;
  current_stock: number;
  minimum_stock: number;
  storage_location: string | null;
  image_url: string | null;
  price: number | null;
  barcode: string | null;
  vendor: string | null;
  product_type: string | null;
  last_sync: string | null;
  last_inventory_update: string | null;
  created_at: string;
  updated_at: string;
  locations?: ProductLocation[];
}

interface ProductLocation {
  id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  is_primary: boolean;
  location?: StorageLocation;
}

interface StorageLocation {
  id: string;
  code: string;
  name: string;
  zone: string;
  row_num: string;
  shelf: string;
  level: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Product>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState<Product | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [locationFormData, setLocationFormData] = useState({
    locationId: '',
    quantity: 0,
    isPrimary: false
  });

  useEffect(() => {
    fetchProducts();
    fetchLocations();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (productsError) throw productsError;

      // Fetch product locations
      const { data: locationsData, error: locationsError } = await supabase
        .from('product_locations')
        .select(`
          *,
          location:location_id (*)
        `);

      if (locationsError) throw locationsError;

      // Combine data
      const productsWithLocations = productsData?.map(product => ({
        ...product,
        locations: locationsData?.filter(loc => loc.product_id === product.id) || []
      })) || [];

      setProducts(productsWithLocations);
    } catch (error: any) {
      console.error('Error fetching products:', error);
      toast.error('Fehler beim Laden der Produkte');
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('storage_locations')
        .select('*')
        .order('code');

      if (error) throw error;
      setLocations(data || []);
    } catch (error: any) {
      console.error('Error fetching locations:', error);
    }
  };

  const syncWithShopify = async () => {
    setSyncing(true);
    const loadingToast = toast.loading('Synchronisiere mit Shopify...');
    
    try {
      const response = await fetch('/api/shopify/sync-inventory', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast.success(`${data.synced} Produkte synchronisiert`, { id: loadingToast });
        fetchProducts();
      } else {
        toast.error(data.error || 'Synchronisation fehlgeschlagen', { id: loadingToast });
      }
    } catch (error) {
      toast.error('Fehler bei der Synchronisation', { id: loadingToast });
    } finally {
      setSyncing(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setEditValues({
      name: product.name,
      sku: product.sku,
      current_stock: product.current_stock,
      minimum_stock: product.minimum_stock,
      storage_location: product.storage_location
    });
  };

  const handleSave = async (id: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({
          ...editValues,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      setProducts(products.map(p => 
        p.id === id ? { ...p, ...editValues } : p
      ));
      
      toast.success('Produkt aktualisiert');
      setEditingId(null);
      setEditValues({});
    } catch (error: any) {
      console.error('Error updating product:', error);
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Möchten Sie dieses Produkt wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProducts(products.filter(p => p.id !== id));
      toast.success('Produkt gelöscht');
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const addProductLocation = async () => {
    if (!showLocationModal || !locationFormData.locationId) return;

    try {
      // Add to product_locations table
      const { data, error } = await supabase
        .from('product_locations')
        .insert({
          product_id: showLocationModal.id,
          location_id: locationFormData.locationId,
          quantity: locationFormData.quantity,
          is_primary: locationFormData.isPrimary
        })
        .select(`
          *,
          location:location_id (*)
        `)
        .single();

      if (error) throw error;

      // If primary, update product's main storage_location
      if (locationFormData.isPrimary) {
        await supabase
          .from('products')
          .update({ 
            storage_location: locations.find(l => l.id === locationFormData.locationId)?.code 
          })
          .eq('id', showLocationModal.id);
      }

      // Update local state
      setProducts(products.map(p => {
        if (p.id === showLocationModal.id) {
          return {
            ...p,
            locations: [...(p.locations || []), data],
            storage_location: locationFormData.isPrimary 
              ? locations.find(l => l.id === locationFormData.locationId)?.code || p.storage_location
              : p.storage_location
          };
        }
        return p;
      }));

      toast.success('Lagerplatz hinzugefügt');
      setLocationFormData({ locationId: '', quantity: 0, isPrimary: false });
    } catch (error: any) {
      console.error('Error adding location:', error);
      toast.error('Fehler beim Hinzufügen des Lagerplatzes');
    }
  };

  const removeProductLocation = async (productId: string, locationId: string) => {
    try {
      const { error } = await supabase
        .from('product_locations')
        .delete()
        .eq('product_id', productId)
        .eq('location_id', locationId);

      if (error) throw error;

      setProducts(products.map(p => {
        if (p.id === productId) {
          return {
            ...p,
            locations: p.locations?.filter(l => l.location_id !== locationId) || []
          };
        }
        return p;
      }));

      toast.success('Lagerplatz entfernt');
    } catch (error: any) {
      console.error('Error removing location:', error);
      toast.error('Fehler beim Entfernen');
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.storage_location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLowStock = !filterLowStock || product.current_stock <= product.minimum_stock;
    return matchesSearch && matchesLowStock;
  });

  const totalValue = products.reduce((sum, p) => sum + p.current_stock, 0);
  const lowStockCount = products.filter(p => p.current_stock <= p.minimum_stock).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Produkte</h1>
              <p className="text-gray-600">Verwaltung mit Bildern und Multi-Location</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-2 border rounded-lg hover:bg-gray-50"
              title={viewMode === 'grid' ? 'Listenansicht' : 'Rasteransicht'}
            >
              {viewMode === 'grid' ? <List className="h-5 w-5" /> : <Grid className="h-5 w-5" />}
            </button>
            <button
              onClick={syncWithShopify}
              disabled={syncing}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Synchronisiere...' : 'Mit Shopify Sync'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Gesamt</p>
            <p className="text-xl md:text-2xl font-bold">{products.length}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Lagerbestand</p>
            <p className="text-xl md:text-2xl font-bold text-blue-600">{totalValue}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Niedriger Bestand</p>
            <p className="text-xl md:text-2xl font-bold text-orange-600">{lowStockCount}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Lagerplätze</p>
            <p className="text-xl md:text-2xl font-bold text-green-600">{locations.length}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Suche nach Name, SKU, Barcode oder Lagerplatz..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
          <button
            onClick={() => setFilterLowStock(!filterLowStock)}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              filterLowStock
                ? 'bg-orange-100 text-orange-700 border-orange-300'
                : 'bg-white border text-gray-700'
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
            Nur niedriger Bestand
          </button>
        </div>
      </div>

      {/* Products Display */}
      {viewMode === 'grid' ? (
        // Grid View with Images
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              {/* Product Image */}
              <div className="relative h-48 bg-gray-100">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => setSelectedImage(product.image_url)}
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2Y3ZmFmYyIvPjx0ZXh0IHRleHQtYW5jaG9yPSJtaWRkbGUiIHg9IjIwMCIgeT0iMjAwIiBzdHlsZT0iZmlsbDojYTBhZWM0O2ZvbnQtd2VpZ2h0OmJvbGQ7Zm9udC1zaXplOjI1cHg7Zm9udC1mYW1pbHk6QXJpYWwsSGVsdmV0aWNhLHNhbnMtc2VyaWY7ZG9taW5hbnQtYmFzZWxpbmU6Y2VudHJhbCI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-16 w-16 text-gray-400" />
                  </div>
                )}
                {product.current_stock <= product.minimum_stock && (
                  <div className="absolute top-2 right-2 bg-orange-500 text-white px-2 py-1 rounded text-xs font-semibold">
                    Niedriger Bestand
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-4">
                {editingId === product.id ? (
                  // Edit Mode
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editValues.name}
                      onChange={(e) => setEditValues({...editValues, name: e.target.value})}
                      className="w-full px-2 py-1 border rounded text-sm"
                      placeholder="Name"
                    />
                    <input
                      type="text"
                      value={editValues.sku}
                      onChange={(e) => setEditValues({...editValues, sku: e.target.value})}
                      className="w-full px-2 py-1 border rounded text-sm"
                      placeholder="SKU"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={editValues.current_stock}
                        onChange={(e) => setEditValues({...editValues, current_stock: parseInt(e.target.value)})}
                        className="px-2 py-1 border rounded text-sm"
                        placeholder="Bestand"
                      />
                      <input
                        type="number"
                        value={editValues.minimum_stock}
                        onChange={(e) => setEditValues({...editValues, minimum_stock: parseInt(e.target.value)})}
                        className="px-2 py-1 border rounded text-sm"
                        placeholder="Minimum"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(product.id)}
                        className="flex-1 bg-green-600 text-white py-1 rounded text-sm hover:bg-green-700"
                      >
                        <Save className="h-4 w-4 mx-auto" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditValues({});
                        }}
                        className="flex-1 bg-gray-600 text-white py-1 rounded text-sm hover:bg-gray-700"
                      >
                        <X className="h-4 w-4 mx-auto" />
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <>
                    <h3 className="font-semibold text-lg mb-1 truncate" title={product.name}>
                      {product.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">SKU: {product.sku}</p>
                    
                    {/* Stock Info */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${
                          product.current_stock <= product.minimum_stock ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {product.current_stock}
                        </span>
                        <span className="text-sm text-gray-500">/ {product.minimum_stock}</span>
                      </div>
                      {product.price && (
                        <span className="text-lg font-semibold text-blue-600">
                          €{product.price.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {/* Locations */}
                    <div className="border-t pt-2 mb-2">
                      {product.locations && product.locations.length > 0 ? (
                        <div className="space-y-1">
                          {product.locations.slice(0, 2).map(loc => (
                            <div key={loc.id} className="flex items-center gap-1 text-xs">
                              <MapPin className="h-3 w-3 text-blue-500" />
                              <span className="font-medium">{loc.location?.code}</span>
                              <span className="text-gray-500">({loc.quantity}x)</span>
                              {loc.is_primary && (
                                <span className="bg-blue-100 text-blue-700 px-1 rounded text-xs">Haupt</span>
                              )}
                            </div>
                          ))}
                          {product.locations.length > 2 && (
                            <p className="text-xs text-gray-500">+{product.locations.length - 2} weitere</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">Kein Lagerplatz</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => setShowLocationModal(product)}
                        className="flex-1 text-blue-600 hover:bg-blue-50 py-1 rounded text-sm transition-colors"
                      >
                        <Plus className="h-4 w-4 mx-auto" />
                      </button>
                      <button
                        onClick={() => handleEdit(product)}
                        className="flex-1 text-gray-600 hover:bg-gray-50 py-1 rounded text-sm transition-colors"
                      >
                        <Edit className="h-4 w-4 mx-auto" />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="flex-1 text-red-600 hover:bg-red-50 py-1 rounded text-sm transition-colors"
                      >
                        <Trash2 className="h-4 w-4 mx-auto" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // List View (Table)
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bild
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produkt
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bestand
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Preis
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lagerplätze
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-12 w-12 rounded object-cover cursor-pointer"
                          onClick={() => setSelectedImage(product.image_url)}
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2Y3ZmFmYyIvPjx0ZXh0IHRleHQtYW5jaG9yPSJtaWRkbGUiIHg9IjIwMCIgeT0iMjAwIiBzdHlsZT0iZmlsbDojYTBhZWM0O2ZvbnQtd2VpZ2h0OmJvbGQ7Zm9udC1zaXplOjI1cHg7Zm9udC1mYW1pbHk6QXJpYWwsSGVsdmV0aWNhLHNhbnMtc2VyaWY7ZG9taW5hbnQtYmFzZWxpbmU6Y2VudHJhbCI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';
                          }}
                        />
                      ) : (
                        <div className="h-12 w-12 rounded bg-gray-100 flex items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingId === product.id ? (
                        <input
                          type="text"
                          value={editValues.name}
                          onChange={(e) => setEditValues({...editValues, name: e.target.value})}
                          className="w-full px-2 py-1 border rounded"
                        />
                      ) : (
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.barcode && (
                            <p className="text-xs text-gray-500">Barcode: {product.barcode}</p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingId === product.id ? (
                        <input
                          type="text"
                          value={editValues.sku}
                          onChange={(e) => setEditValues({...editValues, sku: e.target.value})}
                          className="w-full px-2 py-1 border rounded"
                        />
                      ) : (
                        <span className="text-sm">{product.sku}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingId === product.id ? (
                        <div className="space-y-2">
                          <input
                            type="number"
                            value={editValues.current_stock}
                            onChange={(e) => setEditValues({...editValues, current_stock: parseInt(e.target.value)})}
                            className="w-full px-2 py-1 border rounded"
                            placeholder="Aktuell"
                          />
                          <input
                            type="number"
                            value={editValues.minimum_stock}
                            onChange={(e) => setEditValues({...editValues, minimum_stock: parseInt(e.target.value)})}
                            className="w-full px-2 py-1 border rounded"
                            placeholder="Minimum"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${
                            product.current_stock <= product.minimum_stock ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {product.current_stock}
                          </span>
                          <span className="text-gray-400">/</span>
                          <span className="text-sm text-gray-600">{product.minimum_stock}</span>
                          {product.current_stock <= product.minimum_stock && (
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {product.price ? (
                        <span className="font-medium">€{product.price.toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {product.locations && product.locations.length > 0 ? (
                          product.locations.map(loc => (
                            <div key={loc.id} className="flex items-center gap-2">
                              <MapPin className="h-3 w-3 text-blue-500" />
                              <span className="text-sm font-medium">{loc.location?.code}</span>
                              <span className="text-xs text-gray-500">({loc.quantity}x)</span>
                              {loc.is_primary && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded">Haupt</span>
                              )}
                              <button
                                onClick={() => removeProductLocation(product.id, loc.location_id)}
                                className="ml-auto text-red-500 hover:text-red-700"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))
                        ) : (
                          <span className="text-sm text-gray-400">Kein Lagerplatz</span>
                        )}
                        <button
                          onClick={() => setShowLocationModal(product)}
                          className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          Lagerplatz hinzufügen
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {editingId === product.id ? (
                          <>
                            <button
                              onClick={() => handleSave(product.id)}
                              className="text-green-600 hover:text-green-700"
                              title="Speichern"
                            >
                              <Save className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setEditValues({});
                              }}
                              className="text-gray-600 hover:text-gray-700"
                              title="Abbrechen"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEdit(product)}
                              className="text-blue-600 hover:text-blue-700"
                              title="Bearbeiten"
                            >
                              <Edit className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
                              className="text-red-600 hover:text-red-700"
                              title="Löschen"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredProducts.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Keine Produkte gefunden</p>
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img
              src={selectedImage}
              alt="Produktbild"
              className="max-w-full max-h-[90vh] object-contain"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 bg-white rounded-full p-2 shadow-lg"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}

      {/* Location Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Lagerplatz hinzufügen</h2>
            <p className="text-sm text-gray-600 mb-4">Für: {showLocationModal.name}</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Lagerplatz</label>
                <select
                  value={locationFormData.locationId}
                  onChange={(e) => setLocationFormData({...locationFormData, locationId: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Wählen...</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.code} - {loc.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Menge</label>
                <input
                  type="number"
                  value={locationFormData.quantity}
                  onChange={(e) => setLocationFormData({...locationFormData, quantity: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border rounded-lg"
                  min="0"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isPrimary"
                  checked={locationFormData.isPrimary}
                  onChange={(e) => setLocationFormData({...locationFormData, isPrimary: e.target.checked})}
                  className="mr-2"
                />
                <label htmlFor="isPrimary" className="text-sm">
                  Als Haupt-Lagerplatz festlegen
                </label>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowLocationModal(null);
                  setLocationFormData({ locationId: '', quantity: 0, isPrimary: false });
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Abbrechen
              </button>
              <button
                onClick={addProductLocation}
                disabled={!locationFormData.locationId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}