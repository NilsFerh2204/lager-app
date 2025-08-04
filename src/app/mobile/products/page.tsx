'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import {
  Package,
  Search,
  Plus,
  Filter,
  ArrowLeft,
  AlertCircle,
  Edit,
  MapPin,
  BarChart,
  Home,
  QrCode,
  ShoppingCart
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  current_stock: number;
  minimum_stock: number;
  storage_location: string | null;
  image_url: string | null;
  shopify_variant_id: string | null;
}

export default function MobileProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [searchTerm, filterLowStock, products]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;

      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Low stock filter
    if (filterLowStock) {
      filtered = filtered.filter(product => 
        product.current_stock <= product.minimum_stock
      );
    }

    setFilteredProducts(filtered);
  };

  const getStockStatus = (product: Product) => {
    if (product.current_stock === 0) {
      return { color: 'text-red-500', bg: 'bg-red-900', text: 'Nicht vorrätig' };
    } else if (product.current_stock <= product.minimum_stock) {
      return { color: 'text-orange-500', bg: 'bg-orange-900', text: 'Niedriger Bestand' };
    }
    return { color: 'text-green-500', bg: 'bg-green-900', text: 'Auf Lager' };
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-black bg-opacity-90 backdrop-blur-sm z-30 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link href="/mobile" className="p-2 rounded-lg bg-gray-800">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-xl font-bold">Produkte</h1>
          </div>
          <Link href="/mobile/scan" className="p-2 rounded-lg bg-orange-600">
            <Plus className="h-5 w-5" />
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Suche nach Name, SKU oder Barcode..."
            className="w-full bg-gray-800 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-400"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterLowStock(!filterLowStock)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              filterLowStock ? 'bg-orange-600' : 'bg-gray-800'
            }`}
          >
            <Filter className="h-4 w-4" />
            Niedriger Bestand
          </button>
          <div className="ml-auto text-sm text-gray-400 py-2">
            {filteredProducts.length} von {products.length}
          </div>
        </div>
      </div>

      {/* Products List */}
      <div className="p-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400">Keine Produkte gefunden</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((product) => {
              const stockStatus = getStockStatus(product);
              
              return (
                <Link
                  key={product.id}
                  href={`/mobile/products/${product.id}`}
                  className="block bg-gray-800 rounded-lg p-4 border border-gray-700"
                >
                  <div className="flex items-start gap-3">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center">
                        <Package className="h-8 w-8 text-gray-500" />
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{product.name}</h3>
                      <p className="text-sm text-gray-400">SKU: {product.sku}</p>
                      
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1">
                          <BarChart className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">{product.current_stock} Stück</span>
                        </div>
                        
                        {product.storage_location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">{product.storage_location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className={`px-2 py-1 rounded text-xs ${stockStatus.bg} ${stockStatus.color}`}>
                      {stockStatus.text}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-black bg-opacity-90 backdrop-blur-sm z-40">
        <div className="grid grid-cols-4 py-2">
          <Link href="/mobile" className="flex flex-col items-center gap-1 py-2 text-gray-400">
            <Home className="h-6 w-6" />
            <span className="text-xs">Home</span>
          </Link>
          <Link href="/mobile/scan" className="flex flex-col items-center gap-1 py-2 text-gray-400">
            <QrCode className="h-6 w-6" />
            <span className="text-xs">Scan</span>
          </Link>
          <Link href="/mobile/picking" className="flex flex-col items-center gap-1 py-2 text-gray-400">
            <ShoppingCart className="h-6 w-6" />
            <span className="text-xs">Picken</span>
          </Link>
          <Link href="/mobile/products" className="flex flex-col items-center gap-1 py-2 text-orange-500">
            <Package className="h-6 w-6" />
            <span className="text-xs">Produkte</span>
          </Link>
        </div>
      </div>
    </div>
  );
}