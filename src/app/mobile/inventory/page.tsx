'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ClipboardList,
  QrCode,
  Search,
  ArrowLeft,
  Plus,
  Minus,
  Check,
  X,
  AlertCircle,
  Loader2,
  Home,
  Save,
  Package
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  current_stock: number;
  minimum_stock: number;
  storage_location: string | null;
  image_url: string | null;
}

interface InventoryItem {
  product: Product;
  counted: number;
  difference: number;
  checked: boolean;
}

export default function MobileInventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [locations, setLocations] = useState<string[]>([]);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('storage_location, name');

      if (error) throw error;

      const productsData = data || [];
      setProducts(productsData);
      
      // Initialize inventory items
      setInventoryItems(productsData.map(product => ({
        product,
        counted: product.current_stock,
        difference: 0,
        checked: false
      })));

      // Extract unique locations
      const uniqueLocations = [...new Set(productsData
        .map(p => p.storage_location)
        .filter(Boolean))] as string[];
      setLocations(uniqueLocations.sort());
      
    } catch (error) {
      toast.error('Fehler beim Laden der Produkte');
    } finally {
      setLoading(false);
    }
  };

  const updateCount = (productId: string, newCount: number) => {
    setInventoryItems(items => items.map(item => {
      if (item.product.id === productId) {
        const counted = Math.max(0, newCount);
        const difference = counted - item.product.current_stock;
        return { ...item, counted, difference, checked: true };
      }
      return item;
    }));
  };

  const saveInventory = async () => {
    const changedItems = inventoryItems.filter(item => item.difference !== 0);
    
    if (changedItems.length === 0) {
      toast.error('Keine Änderungen zum Speichern');
      return;
    }

    const loadingToast = toast.loading('Speichere Inventur...');

    try {
      // Update products and create adjustment records
      for (const item of changedItems) {
        // Update product stock
        await supabase
          .from('products')
          .update({ 
            current_stock: item.counted,
            last_inventory_update: new Date().toISOString()
          })
          .eq('id', item.product.id);

        // Create inventory adjustment record
        await supabase
          .from('inventory_adjustments')
          .insert({
            product_id: item.product.id,
            old_quantity: item.product.current_stock,
            new_quantity: item.counted,
            difference: item.difference,
            reason: 'Inventur',
            adjusted_by: 'Mobile App'
          });
      }

      toast.success(`${changedItems.length} Produkte aktualisiert`, { id: loadingToast });
      setShowSummary(true);
    } catch (error) {
      toast.error('Fehler beim Speichern', { id: loadingToast });
    }
  };

  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = 
      item.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation = 
      selectedLocation === 'all' || 
      item.product.storage_location === selectedLocation;
    return matchesSearch && matchesLocation;
  });

  const stats = {
    total: inventoryItems.length,
    checked: inventoryItems.filter(i => i.checked).length,
    differences: inventoryItems.filter(i => i.difference !== 0).length,
    totalDifference: inventoryItems.reduce((sum, i) => sum + i.difference, 0)
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-20">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-black bg-opacity-80 backdrop-blur-sm z-50">
        <div className="flex items-center justify-between p-4">
          <Link href="/mobile" className="p-2 rounded-lg bg-gray-800">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-lg font-semibold">Inventur</h1>
          <button
            onClick={saveInventory}
            className="p-2 rounded-lg bg-green-600"
            disabled={stats.differences === 0}
          >
            <Save className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-20 p-4">
        {/* Stats */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-gray-400">Gesamt</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-500">{stats.checked}</p>
              <p className="text-xs text-gray-400">Gezählt</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-500">{stats.differences}</p>
              <p className="text-xs text-gray-400">Differenzen</p>
            </div>
            <div>
              <p className={`text-2xl font-bold ${stats.totalDifference > 0 ? 'text-green-500' : stats.totalDifference < 0 ? 'text-red-500' : ''}`}>
                {stats.totalDifference > 0 ? '+' : ''}{stats.totalDifference}
              </p>
              <p className="text-xs text-gray-400">Total Diff.</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Produkt suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-800 rounded-lg text-white placeholder-gray-400"
            />
          </div>
          
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 rounded-lg text-white"
          >
            <option value="all">Alle Lagerplätze</option>
            {locations.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>

        {/* Inventory Items */}
        <div className="space-y-3">
          {filteredItems.map(item => (
            <div
              key={item.product.id}
              className={`bg-gray-800 rounded-lg p-4 ${
                item.checked ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {item.product.image_url && (
                  <img
                    src={item.product.image_url}
                    alt={item.product.name}
                    className="w-16 h-16 rounded object-cover"
                  />
                )}
                
                <div className="flex-1">
                  <h3 className="font-semibold">{item.product.name}</h3>
                  <p className="text-sm text-gray-400">SKU: {item.product.sku}</p>
                  {item.product.storage_location && (
                    <p className="text-sm text-blue-400 mt-1">
                      📍 {item.product.storage_location}
                    </p>
                  )}
                </div>
              </div>

              {/* Count Controls */}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateCount(item.product.id, item.counted - 1)}
                    className="p-2 bg-red-600 rounded-lg"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  
                  <div className="text-center">
                    <input
                      type="number"
                      value={item.counted}
                      onChange={(e) => updateCount(item.product.id, parseInt(e.target.value) || 0)}
                      className="w-20 text-center text-2xl font-bold bg-gray-700 rounded-lg py-1"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Soll: {item.product.current_stock}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => updateCount(item.product.id, item.counted + 1)}
                    className="p-2 bg-green-600 rounded-lg"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>

                {/* Difference Display */}
                {item.difference !== 0 && (
                  <div className={`text-right ${
                    item.difference > 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    <p className="text-lg font-bold">
                      {item.difference > 0 ? '+' : ''}{item.difference}
                    </p>
                    <p className="text-xs">Differenz</p>
                  </div>
                )}

                {item.checked && item.difference === 0 && (
                  <Check className="h-6 w-6 text-green-500" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Modal */}
      {showSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">Inventur gespeichert!</h2>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span>Produkte gezählt:</span>
                <span className="font-bold">{stats.checked}</span>
              </div>
              <div className="flex justify-between">
                <span>Mit Differenzen:</span>
                <span className="font-bold text-orange-500">{stats.differences}</span>
              </div>
              <div className="flex justify-between">
                <span>Gesamt-Differenz:</span>
                <span className={`font-bold ${
                  stats.totalDifference > 0 ? 'text-green-500' : 
                  stats.totalDifference < 0 ? 'text-red-500' : ''
                }`}>
                  {stats.totalDifference > 0 ? '+' : ''}{stats.totalDifference}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setShowSummary(false);
                window.location.reload();
              }}
              className="w-full py-3 bg-blue-600 rounded-lg font-semibold"
            >
              Neue Inventur starten
            </button>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-black bg-opacity-90 backdrop-blur-sm">
        <div className="grid grid-cols-4 py-2">
          <Link href="/mobile" className="flex flex-col items-center gap-1 py-2 text-gray-400">
            <Home className="h-6 w-6" />
            <span className="text-xs">Home</span>
          </Link>
          <Link href="/mobile/scan" className="flex flex-col items-center gap-1 py-2 text-gray-400">
            <QrCode className="h-6 w-6" />
            <span className="text-xs">Scan</span>
          </Link>
          <Link href="/mobile/inventory" className="flex flex-col items-center gap-1 py-2 text-orange-500">
            <ClipboardList className="h-6 w-6" />
            <span className="text-xs">Inventur</span>
          </Link>
          <Link href="/mobile/picking" className="flex flex-col items-center gap-1 py-2 text-gray-400">
            <Package className="h-6 w-6" />
            <span className="text-xs">Picken</span>
          </Link>
        </div>
      </div>
    </div>
  );
}