'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Scan,
  Package,
  Save,
  Search,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Home,
  QrCode,
  ShoppingCart,
  MapPin,
  Database,
  TrendingUp
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  image_url: string | null;
  current_stock: number;
}

interface UnknownBarcode {
  barcode: string;
  scan_count: number;
  first_scanned: string;
  last_scanned: string;
}

export default function BarcodeLearningPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [unknownBarcodes, setUnknownBarcodes] = useState<UnknownBarcode[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedBarcode, setSelectedBarcode] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'assign' | 'unknown'>('assign');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchUnknownBarcodes();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');
    
    if (!error && data) {
      setProducts(data);
    }
  };

  const fetchUnknownBarcodes = async () => {
    const { data, error } = await supabase
      .from('unknown_barcodes')
      .select('*')
      .order('scan_count', { ascending: false });
    
    if (!error && data) {
      setUnknownBarcodes(data);
    }
  };

  const assignBarcode = async () => {
    if (!selectedProduct || !selectedBarcode) {
      toast.error('Bitte Produkt und Barcode auswählen');
      return;
    }

    setLoading(true);
    try {
      // Update product with barcode
      const { error: updateError } = await supabase
        .from('products')
        .update({ barcode: selectedBarcode })
        .eq('id', selectedProduct.id);

      if (updateError) throw updateError;

      // Remove from unknown barcodes
      await supabase
        .from('unknown_barcodes')
        .delete()
        .eq('barcode', selectedBarcode);

      toast.success(`Barcode ${selectedBarcode} wurde ${selectedProduct.name} zugeordnet`);
      
      // Reset
      setSelectedProduct(null);
      setSelectedBarcode('');
      fetchProducts();
      fetchUnknownBarcodes();
    } catch (error) {
      toast.error('Fehler beim Zuordnen');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const productsWithoutBarcode = filteredProducts.filter(p => !p.barcode);
  const productsWithBarcode = filteredProducts.filter(p => p.barcode);

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-20">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-black bg-opacity-80 backdrop-blur-sm z-50">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => window.history.back()}
            className="p-2 rounded-lg bg-gray-800"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold">Barcode Verwaltung</h1>
          <Database className="h-6 w-6 text-orange-500" />
        </div>
      </div>

      {/* Tabs */}
      <div className="pt-20 px-4">
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setActiveTab('assign')}
            className={`py-3 rounded-lg font-medium ${
              activeTab === 'assign' 
                ? 'bg-orange-600' 
                : 'bg-gray-800'
            }`}
          >
            Zuordnen
          </button>
          <button
            onClick={() => setActiveTab('unknown')}
            className={`py-3 rounded-lg font-medium relative ${
              activeTab === 'unknown' 
                ? 'bg-orange-600' 
                : 'bg-gray-800'
            }`}
          >
            Unbekannt
            {unknownBarcodes.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center">
                {unknownBarcodes.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4">
        {activeTab === 'assign' ? (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-500 mb-1">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm">Mit Barcode</span>
                </div>
                <p className="text-2xl font-bold">{productsWithBarcode.length}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-orange-500 mb-1">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm">Ohne Barcode</span>
                </div>
                <p className="text-2xl font-bold">{productsWithoutBarcode.length}</p>
              </div>
            </div>

            {/* Manual Assignment */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-semibold mb-3">Barcode zuordnen</h3>
              
              {/* Barcode Input */}
              <div className="mb-3">
                <label className="text-sm text-gray-400">Barcode</label>
                <input
                  type="text"
                  value={selectedBarcode}
                  onChange={(e) => setSelectedBarcode(e.target.value)}
                  placeholder="Barcode scannen oder eingeben"
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1"
                />
              </div>

              {/* Product Selection */}
              <div className="mb-3">
                <label className="text-sm text-gray-400">Produkt</label>
                {selectedProduct ? (
                  <div className="bg-gray-700 rounded-lg p-3 mt-1 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedProduct.name}</p>
                      <p className="text-sm text-gray-400">SKU: {selectedProduct.sku}</p>
                    </div>
                    <button
                      onClick={() => setSelectedProduct(null)}
                      className="text-gray-400"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {/* Open product selector */}}
                    className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1 text-left text-gray-400"
                  >
                    Produkt auswählen...
                  </button>
                )}
              </div>

              <button
                onClick={assignBarcode}
                disabled={!selectedProduct || !selectedBarcode || loading}
                className="w-full bg-orange-600 disabled:bg-gray-700 rounded-lg py-3 font-medium"
              >
                Zuordnen
              </button>
            </div>

            {/* Product Search */}
            <div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Produkt suchen..."
                className="w-full bg-gray-800 rounded-lg px-4 py-3 mb-3"
              />

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {productsWithoutBarcode.map(product => (
                  <div
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className={`bg-gray-800 rounded-lg p-3 flex items-center gap-3 ${
                      selectedProduct?.id === product.id ? 'ring-2 ring-orange-500' : ''
                    }`}
                  >
                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-12 h-12 rounded object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-gray-400">SKU: {product.sku}</p>
                    </div>
                    <div className="text-orange-500">
                      <Scan className="h-5 w-5" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Unknown Barcodes Tab */
          <div className="space-y-4">
            <div className="bg-blue-900 bg-opacity-50 rounded-lg p-4">
              <h3 className="font-semibold mb-1">Unbekannte Barcodes</h3>
              <p className="text-sm text-gray-300">
                Diese Barcodes wurden gescannt, sind aber keinem Produkt zugeordnet.
              </p>
            </div>

            {unknownBarcodes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Scan className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Keine unbekannten Barcodes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {unknownBarcodes.map(item => (
                  <div
                    key={item.barcode}
                    onClick={() => {
                      setSelectedBarcode(item.barcode);
                      setActiveTab('assign');
                    }}
                    className="bg-gray-800 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-mono font-medium">{item.barcode}</p>
                      <p className="text-sm text-gray-400">
                        {item.scan_count}x gescannt
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-orange-500">
                      <TrendingUp className="h-5 w-5" />
                      <ChevronRight className="h-5 w-5" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
          <Link href="/mobile/picking" className="flex flex-col items-center gap-1 py-2 text-gray-400">
            <ShoppingCart className="h-6 w-6" />
            <span className="text-xs">Picken</span>
          </Link>
          <Link href="/mobile/locations" className="flex flex-col items-center gap-1 py-2 text-gray-400">
            <MapPin className="h-6 w-6" />
            <span className="text-xs">Plätze</span>
          </Link>
        </div>
      </div>
    </div>
  );
}