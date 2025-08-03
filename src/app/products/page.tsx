'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Package, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  AlertTriangle,
  BarCode,
  Image as ImageIcon,
  X,
  ShoppingBag,
  RefreshCw,
  MapPin,
  ChevronDown,
  ChevronUp,
  Save,
  Eye
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  current_stock: number;
  min_stock: number;
  price: number;
  unit: string;
  category: string | null;
  image_url: string | null;
  shopify_id: string | null;
  shopify_handle: string | null;
  storage_location: string | null;
  created_at: string;
  updated_at: string;
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [storageLocations, setStorageLocations] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    name: '',
    description: '',
    current_stock: 0,
    min_stock: 0,
    price: 0,
    unit: 'Stück',
    category: '',
    storage_location: '',
    image_url: ''
  });

  useEffect(() => {
    fetchProducts();
    fetchStorageLocations();
  }, []);

  const fetchStorageLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('storage_locations')
        .select('code, name')
        .eq('is_active', true)
        .order('code');

      if (!error && data) {
        // Verwende nur den Code für die Dropdown-Optionen
        const locations = data.map(loc => loc.code);
        setStorageLocations(locations);
        console.log('Loaded storage locations:', locations);
      }
    } catch (error) {
      console.error('Error fetching storage locations:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;

      setProducts(data || []);
      
      // Extrahiere Kategorien
      const uniqueCategories = [...new Set(data?.map(p => p.category).filter(Boolean))] as string[];
      setCategories(uniqueCategories);
      
      console.log('Produkte geladen:', data?.length);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Fehler beim Laden der Produkte');
    } finally {
      setLoading(false);
    }
  };

  const syncWithShopify = async () => {
    setSyncing(true);
    try {
      toast.loading('Synchronisiere mit Shopify...', { id: 'sync' });
      
      const response = await fetch('/api/shopify/sync', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(data.message, { id: 'sync' });
        await fetchProducts();
      } else {
        toast.error('Synchronisation fehlgeschlagen', { id: 'sync' });
      }
    } catch (error) {
      toast.error('Fehler bei der Synchronisation', { id: 'sync' });
    } finally {
      setSyncing(false);
    }
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      barcode: product.barcode || '',
      name: product.name,
      description: product.description || '',
      current_stock: product.current_stock,
      min_stock: product.min_stock,
      price: product.price,
      unit: product.unit,
      category: product.category || '',
      storage_location: product.storage_location || '',
      image_url: product.image_url || ''
    });
    setShowEditModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingProduct.id);

        if (error) throw error;
        toast.success('Produkt erfolgreich aktualisiert');
      } else {
        const { error } = await supabase
          .from('products')
          .insert([formData]);

        if (error) throw error;
        toast.success('Produkt erfolgreich hinzugefügt');
      }

      setShowEditModal(false);
      setEditingProduct(null);
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Fehler beim Speichern des Produkts');
    }
  };

  const quickUpdateLocation = async (productId: string, location: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ 
          storage_location: location,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);

      if (error) throw error;
      
      toast.success('Lagerplatz aktualisiert');
      fetchProducts();
    } catch (error) {
      console.error('Error updating location:', error);
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

      toast.success('Produkt erfolgreich gelöscht');
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Fehler beim Löschen des Produkts');
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.storage_location?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const displayProducts = showAll ? filteredProducts : filteredProducts.slice(0, 20);

  const getStockStatus = (product: Product) => {
    if (product.current_stock === 0) return { color: 'bg-red-100 text-red-800', text: 'Ausverkauft' };
    if (product.current_stock <= product.min_stock) return { color: 'bg-yellow-100 text-yellow-800', text: 'Niedrig' };
    return { color: 'bg-green-100 text-green-800', text: 'Verfügbar' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Lade Produkte...</div>
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
              <Package className="text-blue-600" />
              Produktverwaltung
            </h1>
            <div className="flex gap-2">
              <button
                onClick={syncWithShopify}
                disabled={syncing}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  syncing 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
                Shopify Sync
              </button>
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setFormData({
                    sku: '',
                    barcode: '',
                    name: '',
                    description: '',
                    current_stock: 0,
                    min_stock: 0,
                    price: 0,
                    unit: 'Stück',
                    category: '',
                    storage_location: '',
                    image_url: ''
                  });
                  setShowEditModal(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus size={20} />
                Neues Produkt
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Suche nach Name, SKU oder Lagerplatz..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Alle Kategorien</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                Liste
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                Grid
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Gesamt</div>
              <div className="text-2xl font-bold">{products.length}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Gefiltert</div>
              <div className="text-2xl font-bold text-green-600">{filteredProducts.length}</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Kritisch</div>
              <div className="text-2xl font-bold text-red-600">
                {products.filter(p => p.current_stock <= p.min_stock).length}
              </div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Ohne Lagerplatz</div>
              <div className="text-2xl font-bold text-yellow-600">
                {products.filter(p => !p.storage_location).length}
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Gesamtwert</div>
              <div className="text-xl font-bold text-blue-600">
                €{products.reduce((sum, p) => sum + (p.current_stock * p.price), 0).toFixed(0)}
              </div>
            </div>
          </div>
        </div>

        {/* Products Display */}
        {viewMode === 'list' ? (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bild</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produkt</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lagerplatz</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Bestand</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Preis</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                        {product.image_url ? (
                          <img 
                            src={product.image_url} 
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <ImageIcon size={20} className="text-gray-400" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{product.name}</div>
                      {product.shopify_id && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <ShoppingBag size={10} />
                          Shopify
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900 font-mono">{product.sku}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <MapPin size={14} className="text-gray-400" />
                        <select
                          value={product.storage_location || ''}
                          onChange={(e) => {
                            const newLocation = e.target.value;
                            if (newLocation !== product.storage_location) {
                              quickUpdateLocation(product.id, newLocation);
                            }
                          }}
                          className="px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Kein Lagerplatz</option>
                          {storageLocations.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-sm font-medium">{product.current_stock}</div>
                      <div className="text-xs text-gray-500">Min: {product.min_stock}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      €{product.price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStockStatus(product).color}`}>
                        {getStockStatus(product).text}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => openEditModal(product)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Bearbeiten"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Löschen"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Show More/Less Button */}
            {filteredProducts.length > 20 && (
              <div className="p-4 bg-gray-50 text-center">
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto"
                >
                  {showAll ? (
                    <>
                      <ChevronUp size={20} />
                      Weniger anzeigen (20)
                    </>
                  ) : (
                    <>
                      <ChevronDown size={20} />
                      Alle {filteredProducts.length} Produkte anzeigen
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Grid View */
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayProducts.map((product) => (
                <div key={product.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
                  {/* Product Image */}
                  <div className="relative h-48 bg-gray-100 rounded-t-lg overflow-hidden">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <ImageIcon size={48} className="text-gray-400" />
                      </div>
                    )}
                    {product.shopify_id && (
                      <div className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded-lg text-xs flex items-center gap-1">
                        <ShoppingBag size={12} />
                        Shopify
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="font-semibold text-gray-800 mb-1 truncate">{product.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">SKU: {product.sku}</p>
                    
                    {/* Lagerplatz */}
                    <div className="mb-3 p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-gray-500" />
                        <select
                          value={product.storage_location || ''}
                          onChange={(e) => {
                            const newLocation = e.target.value;
                            if (newLocation !== product.storage_location) {
                              quickUpdateLocation(product.id, newLocation);
                            }
                          }}
                          className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Kein Lagerplatz</option>
                          {storageLocations.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <p className="text-sm text-gray-600">Bestand</p>
                        <p className="font-bold">{product.current_stock} {product.unit}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Preis</p>
                        <p className="font-bold">€{product.price.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="mb-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStockStatus(product).color}`}>
                        {getStockStatus(product).text}
                      </span>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEditModal(product)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Show More/Less Button */}
            {filteredProducts.length > 20 && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto"
                >
                  {showAll ? (
                    <>
                      <ChevronUp size={20} />
                      Weniger anzeigen (20)
                    </>
                  ) : (
                    <>
                      <ChevronDown size={20} />
                      Alle {filteredProducts.length} Produkte anzeigen
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {filteredProducts.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
            <Package size={48} className="mx-auto mb-4 text-gray-300" />
            Keine Produkte gefunden
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">
                  {editingProduct ? 'Produkt bearbeiten' : 'Neues Produkt'}
                </h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingProduct(null);
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
                      SKU *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Barcode
                    </label>
                    <input
                      type="text"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Produktname *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lagerplatz
                  </label>
                  <div className="flex items-center gap-2">
                    <MapPin size={20} className="text-gray-400" />
                    <select
                      value={formData.storage_location}
                      onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                      className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Kein Lagerplatz zugewiesen</option>
                      {storageLocations.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Beschreibung
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bild-URL
                  </label>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {formData.image_url && (
                    <div className="mt-2">
                      <img 
                        src={formData.image_url} 
                        alt="Vorschau" 
                        className="w-32 h-32 object-cover rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Aktueller Bestand
                    </label>
                    <input
                      type="number"
                      value={formData.current_stock}
                      onChange={(e) => setFormData({ ...formData, current_stock: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mindestbestand
                    </label>
                    <input
                      type="number"
                      value={formData.min_stock}
                      onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preis (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Einheit
                    </label>
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Stück">Stück</option>
                      <option value="Karton">Karton</option>
                      <option value="Palette">Palette</option>
                      <option value="kg">kg</option>
                      <option value="Liter">Liter</option>
                    </select>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kategorie
                    </label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="z.B. Raketen"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingProduct(null);
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
                    {editingProduct ? 'Speichern' : 'Hinzufügen'}
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