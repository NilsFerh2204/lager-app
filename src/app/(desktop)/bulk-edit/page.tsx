'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Package, 
  Save, 
  Edit3, 
  X, 
  Check,
  AlertCircle,
  Loader2,
  Plus,
  Minus,
  DollarSign,
  Tag,
  Box
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  current_stock: number;
  min_stock: number;
  category: string;
  storage_location?: string;
}

interface BulkChange {
  field: 'price' | 'current_stock' | 'min_stock' | 'category' | 'storage_location';
  operation: 'set' | 'increase' | 'decrease' | 'percentage';
  value: string | number;
}

export default function BulkEditProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [bulkChange, setBulkChange] = useState<BulkChange>({
    field: 'price',
    operation: 'set',
    value: ''
  });
  const [previewMode, setPreviewMode] = useState(false);
  const [previewChanges, setPreviewChanges] = useState<Map<string, Product>>(new Map());

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
    } catch (error: any) {
      toast.error('Fehler beim Laden der Produkte');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const calculateNewValue = (currentValue: number, operation: string, changeValue: number): number => {
    switch (operation) {
      case 'set':
        return changeValue;
      case 'increase':
        return currentValue + changeValue;
      case 'decrease':
        return Math.max(0, currentValue - changeValue);
      case 'percentage':
        return currentValue * (1 + changeValue / 100);
      default:
        return currentValue;
    }
  };

  const previewBulkChanges = () => {
    const changes = new Map<string, Product>();
    
    filteredProducts.forEach(product => {
      if (selectedProducts.has(product.id)) {
        const updatedProduct = { ...product };
        const changeValue = bulkChange.field === 'category' || bulkChange.field === 'storage_location' 
          ? bulkChange.value 
          : Number(bulkChange.value);

        switch (bulkChange.field) {
          case 'price':
            updatedProduct.price = calculateNewValue(product.price, bulkChange.operation, changeValue as number);
            break;
          case 'current_stock':
            updatedProduct.current_stock = Math.round(calculateNewValue(product.current_stock, bulkChange.operation, changeValue as number));
            break;
          case 'min_stock':
            updatedProduct.min_stock = Math.round(calculateNewValue(product.min_stock, bulkChange.operation, changeValue as number));
            break;
          case 'category':
            updatedProduct.category = changeValue as string;
            break;
          case 'storage_location':
            updatedProduct.storage_location = changeValue as string;
            break;
        }
        
        changes.set(product.id, updatedProduct);
      }
    });
    
    setPreviewChanges(changes);
    setPreviewMode(true);
  };

  const applyBulkChanges = async () => {
    if (selectedProducts.size === 0) {
      toast.error('Keine Produkte ausgewählt');
      return;
    }

    if (!bulkChange.value) {
      toast.error('Bitte geben Sie einen Wert ein');
      return;
    }

    setSaving(true);
    try {
      const updates: any[] = [];
      
      previewChanges.forEach((updatedProduct, productId) => {
        updates.push({
          id: productId,
          price: updatedProduct.price,
          current_stock: updatedProduct.current_stock,
          min_stock: updatedProduct.min_stock,
          category: updatedProduct.category,
          storage_location: updatedProduct.storage_location,
          updated_at: new Date().toISOString()
        });
      });

      // Batch update in chunks of 100
      for (let i = 0; i < updates.length; i += 100) {
        const chunk = updates.slice(i, i + 100);
        const { error } = await supabase
          .from('products')
          .upsert(chunk);
        
        if (error) throw error;
      }

      toast.success(`${updates.length} Produkte aktualisiert`);
      
      // Reset
      setSelectedProducts(new Set());
      setBulkChange({ field: 'price', operation: 'set', value: '' });
      setPreviewMode(false);
      setPreviewChanges(new Map());
      
      // Reload products
      await fetchProducts();
    } catch (error: any) {
      toast.error('Fehler beim Aktualisieren der Produkte');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Bulk Edit - Massenbearbeitung</h1>
        <p className="text-gray-600">Bearbeiten Sie mehrere Produkte gleichzeitig</p>
      </div>

      {/* Bulk Action Controls */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Massenbearbeitung</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Feld</label>
            <select
              value={bulkChange.field}
              onChange={(e) => setBulkChange({ ...bulkChange, field: e.target.value as any })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="price">Preis</option>
              <option value="current_stock">Aktueller Bestand</option>
              <option value="min_stock">Mindestbestand</option>
              <option value="category">Kategorie</option>
              <option value="storage_location">Lagerplatz</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Operation</label>
            <select
              value={bulkChange.operation}
              onChange={(e) => setBulkChange({ ...bulkChange, operation: e.target.value as any })}
              className="w-full px-3 py-2 border rounded-lg"
              disabled={bulkChange.field === 'category' || bulkChange.field === 'storage_location'}
            >
              <option value="set">Setzen auf</option>
              {(bulkChange.field !== 'category' && bulkChange.field !== 'storage_location') && (
                <>
                  <option value="increase">Erhöhen um</option>
                  <option value="decrease">Verringern um</option>
                  <option value="percentage">Prozentual ändern</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Wert</label>
            <input
              type={bulkChange.field === 'category' || bulkChange.field === 'storage_location' ? 'text' : 'number'}
              value={bulkChange.value}
              onChange={(e) => setBulkChange({ ...bulkChange, value: e.target.value })}
              placeholder={bulkChange.operation === 'percentage' ? 'z.B. 10 für 10%' : 'Neuer Wert'}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={previewBulkChanges}
              disabled={selectedProducts.size === 0 || !bulkChange.value}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              Vorschau
            </button>
            {previewMode && (
              <button
                onClick={applyBulkChanges}
                disabled={saving}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Anwenden
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-600">
            {selectedProducts.size} von {filteredProducts.length} Produkten ausgewählt
          </span>
          <button
            onClick={toggleAllSelection}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            {selectedProducts.size === filteredProducts.length ? 'Alle abwählen' : 'Alle auswählen'}
          </button>
          {previewMode && (
            <button
              onClick={() => {
                setPreviewMode(false);
                setPreviewChanges(new Map());
              }}
              className="text-red-600 hover:text-red-700 font-medium"
            >
              Vorschau beenden
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Suche nach Name, SKU oder Kategorie..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg"
        />
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                    onChange={toggleAllSelection}
                    className="rounded"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preis</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bestand</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min. Bestand</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategorie</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lagerplatz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map((product) => {
                const isSelected = selectedProducts.has(product.id);
                const previewProduct = previewChanges.get(product.id);
                const hasChanges = previewMode && previewProduct;
                
                return (
                  <tr 
                    key={product.id} 
                    className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''} ${hasChanges ? 'bg-yellow-50' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleProductSelection(product.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm">{product.sku}</td>
                    <td className="px-6 py-4 text-sm font-medium">{product.name}</td>
                    <td className="px-6 py-4 text-sm">
                      {hasChanges && previewProduct?.price !== product.price ? (
                        <span>
                          <span className="line-through text-gray-400">€{product.price.toFixed(2)}</span>
                          <span className="ml-2 text-green-600 font-medium">€{previewProduct?.price.toFixed(2)}</span>
                        </span>
                      ) : (
                        `€${product.price.toFixed(2)}`
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {hasChanges && previewProduct?.current_stock !== product.current_stock ? (
                        <span>
                          <span className="line-through text-gray-400">{product.current_stock}</span>
                          <span className="ml-2 text-green-600 font-medium">{previewProduct?.current_stock}</span>
                        </span>
                      ) : (
                        product.current_stock
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {hasChanges && previewProduct?.min_stock !== product.min_stock ? (
                        <span>
                          <span className="line-through text-gray-400">{product.min_stock}</span>
                          <span className="ml-2 text-green-600 font-medium">{previewProduct?.min_stock}</span>
                        </span>
                      ) : (
                        product.min_stock
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {hasChanges && previewProduct?.category !== product.category ? (
                        <span>
                          <span className="line-through text-gray-400">{product.category}</span>
                          <span className="ml-2 text-green-600 font-medium">{previewProduct?.category}</span>
                        </span>
                      ) : (
                        product.category
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {hasChanges && previewProduct?.storage_location !== product.storage_location ? (
                        <span>
                          <span className="line-through text-gray-400">{product.storage_location || '-'}</span>
                          <span className="ml-2 text-green-600 font-medium">{previewProduct?.storage_location || '-'}</span>
                        </span>
                      ) : (
                        product.storage_location || '-'
                      )}
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