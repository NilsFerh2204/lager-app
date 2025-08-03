'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Package, 
  Search, 
  AlertCircle, 
  Edit, 
  Save, 
  X, 
  Plus, 
  Minus,
  Loader2,
  Check,
  RefreshCw,
  Filter,
  DollarSign,
  Box,
  Tag,
  Edit3,
  CheckSquare,
  Square,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  current_stock: number;
  min_stock: number;
  category: string;
  storage_location?: string;
  shopify_id?: string;
  description?: string;
  image_url?: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Product | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  
  // Bulk Edit States
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;
      
      setProducts(data || []);
      
      // Extract unique categories
      const uniqueCategories = [...new Set((data || []).map(p => p.category))].filter(Boolean);
      setCategories(uniqueCategories);
    } catch (error: any) {
      toast.error('Fehler beim Laden der Produkte');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setEditForm({ ...product });
  };

  const handleSave = async () => {
    if (!editForm) return;

    try {
      const { error } = await supabase
        .from('products')
        .update({
          name: editForm.name,
          price: editForm.price,
          current_stock: editForm.current_stock,
          min_stock: editForm.min_stock,
          category: editForm.category,
          storage_location: editForm.storage_location
        })
        .eq('id', editForm.id);

      if (error) throw error;

      setProducts(products.map(p => 
        p.id === editForm.id ? editForm : p
      ));
      
      setEditingId(null);
      setEditForm(null);
      toast.success('Produkt aktualisiert');
    } catch (error: any) {
      toast.error('Fehler beim Speichern');
      console.error(error);
    }
  };

  const toggleBulkEditMode = () => {
    setBulkEditMode(!bulkEditMode);
    setSelectedProducts(new Set());
  };

  const toggleProductSelection = (productId: string) => {
    const newSelection = new Set(selectedProducts);
    if (newSelection.has(productId)) {
      newSelection.delete(productId);
    } else {
      newSelection.add(productId);
    }
    setSelectedProducts(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const handleBulkEditClick = () => {
    if (selectedProducts.size === 0) {
      toast.error('Bitte wählen Sie mindestens ein Produkt aus');
      return;
    }
    // Navigate to bulk edit page with selected IDs
    const ids = Array.from(selectedProducts).join(',');
    window.location.href = `/bulk-edit?ids=${ids}`;
  };

  const getStockStatus = (stock: number, minStock: number) => {
    if (stock === 0) return { text: 'Ausverkauft', color: 'bg-red-100 text-red-800' };
    if (stock <= minStock) return { text: 'Niedrig', color: 'bg-yellow-100 text-yellow-800' };
    return { text: 'Verfügbar', color: 'bg-green-100 text-green-800' };
  };

  const handleSync = async () => {
    const loadingToast = toast.loading('Synchronisiere mit Shopify...');
    try {
      const response = await fetch('/api/shopify/sync', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        toast.success(data.message || 'Synchronisation erfolgreich!', { id: loadingToast });
        await fetchProducts();
      } else {
        toast.error(data.error || 'Synchronisation fehlgeschlagen', { id: loadingToast });
      }
    } catch (error) {
      toast.error('Fehler bei der Synchronisation', { id: loadingToast });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Statistics
  const totalProducts = products.length;
  const inStockProducts = products.filter(p => p.current_stock > 0).length;
  const criticalStock = products.filter(p => p.current_stock <= p.min_stock && p.current_stock > 0).length;
  const outOfStock = products.filter(p => p.current_stock === 0).length;
  const totalValue = products.reduce((sum, p) => sum + (p.price * p.current_stock), 0);

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold">Produktverwaltung</h1>
          </div>
          <div className="flex gap-3">
            {bulkEditMode && selectedProducts.size > 0 && (
              <button
                onClick={handleBulkEditClick}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
              >
                <Edit3 className="h-5 w-5" />
                {selectedProducts.size} Produkte bearbeiten
              </button>
            )}
            <button
              onClick={toggleBulkEditMode}
              className={`${
                bulkEditMode ? 'bg-gray-600' : 'bg-purple-600'
              } text-white px-4 py-2 rounded-lg hover:opacity-90 transition-colors flex items-center gap-2`}
            >
              {bulkEditMode ? (
                <>
                  <X className="h-5 w-5" />
                  Abbrechen
                </>
              ) : (
                <>
                  <CheckSquare className="h-5 w-5" />
                  Bulk Edit
                </>
              )}
            </button>
            <button
              onClick={handleSync}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="h-5 w-5" />
              Shopify Sync
            </button>
            <Link
              href="/products/new"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Neues Produkt
            </Link>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
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

        {/* Statistics */}
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Gesamt</p>
            <p className="text-2xl font-bold">{totalProducts}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Gefiltert</p>
            <p className="text-2xl font-bold text-green-600">{filteredProducts.length}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Kritisch</p>
            <p className="text-2xl font-bold text-red-600">{criticalStock}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Ohne Lagerplatz</p>
            <p className="text-2xl font-bold text-yellow-600">{products.filter(p => !p.storage_location).length}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Gesamtwert</p>
            <p className="text-2xl font-bold text-blue-600">€{totalValue.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {bulkEditMode && (
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                      onChange={toggleAllSelection}
                      className="rounded"
                    />
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bild</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produkt</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lagerplatz</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bestand</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preis</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aktionen</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => {
                const isEditing = editingId === product.id;
                const stockStatus = getStockStatus(product.current_stock, product.min_stock);
                const isSelected = selectedProducts.has(product.id);
                
                return (
                  <tr key={product.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                    {bulkEditMode && (
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleProductSelection(product.id)}
                          className="rounded"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="h-12 w-12 object-cover rounded" />
                      ) : (
                        <div className="h-12 w-12 bg-gray-200 rounded flex items-center justify-center">
                          <Package className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm?.name || ''}
                          onChange={(e) => setEditForm({...editForm!, name: e.target.value})}
                          className="px-2 py-1 border rounded"
                        />
                      ) : (
                        <div>
                          <div className="text-sm font-medium text-gray-900">{product.name}</div>
                          {product.shopify_id && (
                            <div className="text-xs text-green-600 flex items-center gap-1 mt-1">
                              <Check className="h-3 w-3" />
                              Shopify
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{product.sku}</td>
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm?.storage_location || ''}
                          onChange={(e) => setEditForm({...editForm!, storage_location: e.target.value})}
                          className="px-2 py-1 border rounded w-24"
                        />
                      ) : (
                        <span className="text-sm text-gray-900">{product.storage_location || 'Kein Lagerplatz'}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm?.current_stock || 0}
                          onChange={(e) => setEditForm({...editForm!, current_stock: parseInt(e.target.value) || 0})}
                          className="px-2 py-1 border rounded w-20"
                        />
                      ) : (
                        <div>
                          <div className="text-sm font-medium">{product.current_stock}</div>
                          <div className="text-xs text-gray-500">Min: {product.min_stock}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editForm?.price || 0}
                          onChange={(e) => setEditForm({...editForm!, price: parseFloat(e.target.value) || 0})}
                          className="px-2 py-1 border rounded w-24"
                        />
                      ) : (
                        <span className="text-sm font-medium">€{product.price.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${stockStatus.color}`}>
                        {stockStatus.text}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={handleSave}
                              className="text-green-600 hover:text-green-900"
                            >
                              <Save className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setEditForm(null);
                              }}
                              className="text-red-600 hover:text-red-900"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEdit(product)}
                              className="text-blue-600 hover:text-blue-900"
                              disabled={bulkEditMode}
                            >
                              <Edit className="h-5 w-5" />
                            </button>
                            <button
                              className="text-red-600 hover:text-red-900"
                              disabled={bulkEditMode}
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}