'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Warehouse,
  QrCode,
  Search,
  ArrowLeft,
  ArrowRight,
  Plus,
  Minus,
  Check,
  Package,
  MapPin,
  Loader2,
  Home
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  sku: string;
  current_stock: number;
  image_url: string | null;
}

interface StorageLocation {
  id: string;
  code: string;
  name: string;
  capacity: number;
  current_usage: number;
}

interface TransferItem {
  product: Product;
  fromLocation: StorageLocation | null;
  toLocation: StorageLocation | null;
  quantity: number;
}

export default function MobileTransferPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [transferItem, setTransferItem] = useState<TransferItem | null>(null);
  const [step, setStep] = useState<'product' | 'from' | 'to' | 'quantity' | 'confirm'>('product');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, locationsRes] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('storage_locations').select('*').order('code')
      ]);

      if (productsRes.error) throw productsRes.error;
      if (locationsRes.error) throw locationsRes.error;

      setProducts(productsRes.data || []);
      setLocations(locationsRes.data || []);
    } catch (error) {
      toast.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const selectProduct = (product: Product) => {
    setSelectedProduct(product);
    setTransferItem({
      product,
      fromLocation: null,
      toLocation: null,
      quantity: 1
    });
    setStep('from');
  };

  const selectFromLocation = (location: StorageLocation) => {
    if (transferItem) {
      setTransferItem({ ...transferItem, fromLocation: location });
      setStep('to');
    }
  };

  const selectToLocation = (location: StorageLocation) => {
    if (transferItem) {
      setTransferItem({ ...transferItem, toLocation: location });
      setStep('quantity');
    }
  };

  const executeTransfer = async () => {
    if (!transferItem || !transferItem.fromLocation || !transferItem.toLocation) return;

    const loadingToast = toast.loading('Führe Umlagerung durch...');

    try {
      // Create stock movement record
      await supabase.from('stock_movements').insert({
        product_id: transferItem.product.id,
        from_location_id: transferItem.fromLocation.id,
        to_location_id: transferItem.toLocation.id,
        quantity: transferItem.quantity,
        movement_type: 'transfer',
        performed_by: 'Mobile App'
      });

      // Update product locations
      // This would need more complex logic in a real app
      
      toast.success('Umlagerung erfolgreich!', { id: loadingToast });
      resetTransfer();
    } catch (error) {
      toast.error('Fehler bei der Umlagerung', { id: loadingToast });
    }
  };

  const resetTransfer = () => {
    setSelectedProduct(null);
    setTransferItem(null);
    setStep('product');
    setSearchTerm('');
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableToLocations = locations.filter(loc => 
    loc.id !== transferItem?.fromLocation?.id
  );

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
          <button
            onClick={step === 'product' ? () => window.history.back() : resetTransfer}
            className="p-2 rounded-lg bg-gray-800"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold">Umlagerung</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Progress Steps */}
      <div className="pt-20 px-4 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div className={`flex-1 h-2 rounded-full mr-2 ${
            ['product', 'from', 'to', 'quantity', 'confirm'].includes(step) ? 'bg-orange-600' : 'bg-gray-700'
          }`} />
          <div className={`flex-1 h-2 rounded-full mr-2 ${
            ['from', 'to', 'quantity', 'confirm'].includes(step) ? 'bg-orange-600' : 'bg-gray-700'
          }`} />
          <div className={`flex-1 h-2 rounded-full mr-2 ${
            ['to', 'quantity', 'confirm'].includes(step) ? 'bg-orange-600' : 'bg-gray-700'
          }`} />
          <div className={`flex-1 h-2 rounded-full mr-2 ${
            ['quantity', 'confirm'].includes(step) ? 'bg-orange-600' : 'bg-gray-700'
          }`} />
          <div className={`flex-1 h-2 rounded-full ${
            step === 'confirm' ? 'bg-orange-600' : 'bg-gray-700'
          }`} />
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4">
        {/* Step 1: Select Product */}
        {step === 'product' && (
          <>
            <h2 className="text-xl font-semibold mb-4">Produkt auswählen</h2>
            
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Produkt suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-800 rounded-lg text-white placeholder-gray-400"
              />
            </div>

            <div className="space-y-3">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => selectProduct(product)}
                  className="w-full bg-gray-800 rounded-lg p-4 flex items-center gap-3 text-left"
                >
                  {product.image_url && (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-16 h-16 rounded object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold">{product.name}</h3>
                    <p className="text-sm text-gray-400">SKU: {product.sku}</p>
                    <p className="text-sm text-gray-400">Bestand: {product.current_stock}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 2: Select From Location */}
        {step === 'from' && transferItem && (
          <>
            <h2 className="text-xl font-semibold mb-2">Von Lagerplatz</h2>
            <p className="text-gray-400 mb-4">{transferItem.product.name}</p>

            <div className="space-y-3">
              {locations.map(location => (
                <button
                  key={location.id}
                  onClick={() => selectFromLocation(location)}
                  className="w-full bg-gray-800 rounded-lg p-4 flex items-center justify-between text-left"
                >
                  <div>
                    <h3 className="font-semibold">{location.code}</h3>
                    <p className="text-sm text-gray-400">{location.name}</p>
                    <div className="mt-1">
                      <span className="text-xs bg-gray-700 px-2 py-1 rounded">
                        {location.current_usage}/{location.capacity}
                      </span>
                    </div>
                  </div>
                  <MapPin className="h-6 w-6 text-gray-400" />
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 3: Select To Location */}
        {step === 'to' && transferItem && (
          <>
            <h2 className="text-xl font-semibold mb-2">Nach Lagerplatz</h2>
            <p className="text-gray-400 mb-4">
              {transferItem.product.name} • Von: {transferItem.fromLocation?.code}
            </p>

            <div className="space-y-3">
              {availableToLocations.map(location => (
                <button
                  key={location.id}
                  onClick={() => selectToLocation(location)}
                  className="w-full bg-gray-800 rounded-lg p-4 flex items-center justify-between text-left"
                >
                  <div>
                    <h3 className="font-semibold">{location.code}</h3>
                    <p className="text-sm text-gray-400">{location.name}</p>
                    <div className="mt-1">
                      <span className={`text-xs px-2 py-1 rounded ${
                        location.current_usage >= location.capacity 
                          ? 'bg-red-900 text-red-300'
                          : 'bg-gray-700'
                      }`}>
                        {location.current_usage}/{location.capacity}
                      </span>
                    </div>
                  </div>
                  <MapPin className="h-6 w-6 text-gray-400" />
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 4: Select Quantity */}
        {step === 'quantity' && transferItem && (
          <>
            <h2 className="text-xl font-semibold mb-2">Menge wählen</h2>
            <div className="bg-gray-800 rounded-lg p-4 mb-6">
              <p className="font-medium">{transferItem.product.name}</p>
              <p className="text-sm text-gray-400 mt-1">
                Von: {transferItem.fromLocation?.code} → Nach: {transferItem.toLocation?.code}
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 mb-8">
              <button
                onClick={() => setTransferItem({
                  ...transferItem,
                  quantity: Math.max(1, transferItem.quantity - 1)
                })}
                className="p-4 bg-red-600 rounded-full"
              >
                <Minus className="h-8 w-8" />
              </button>

              <div className="text-center">
                <input
                  type="number"
                  value={transferItem.quantity}
                  onChange={(e) => setTransferItem({
                    ...transferItem,
                    quantity: Math.max(1, parseInt(e.target.value) || 1)
                  })}
                  className="w-32 text-center text-4xl font-bold bg-gray-700 rounded-lg py-2"
                />
                <p className="text-sm text-gray-400 mt-2">
                  Max: {transferItem.product.current_stock}
                </p>
              </div>

              <button
                onClick={() => setTransferItem({
                  ...transferItem,
                  quantity: Math.min(transferItem.product.current_stock, transferItem.quantity + 1)
                })}
                className="p-4 bg-green-600 rounded-full"
              >
                <Plus className="h-8 w-8" />
              </button>
            </div>

            <button
              onClick={() => setStep('confirm')}
              className="w-full py-4 bg-orange-600 rounded-lg font-semibold text-lg"
            >
              Weiter zur Bestätigung
            </button>
          </>
        )}

        {/* Step 5: Confirm */}
        {step === 'confirm' && transferItem && (
          <>
            <h2 className="text-xl font-semibold mb-4">Umlagerung bestätigen</h2>
            
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <div className="flex items-center gap-4 mb-4">
                {transferItem.product.image_url && (
                  <img
                    src={transferItem.product.image_url}
                    alt={transferItem.product.name}
                    className="w-20 h-20 rounded object-cover"
                  />
                )}
                <div>
                  <h3 className="font-semibold text-lg">{transferItem.product.name}</h3>
                  <p className="text-gray-400">SKU: {transferItem.product.sku}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-3 border-t border-gray-700">
                  <span className="text-gray-400">Von:</span>
                  <span className="font-medium">{transferItem.fromLocation?.code}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-t border-gray-700">
                  <span className="text-gray-400">Nach:</span>
                  <span className="font-medium">{transferItem.toLocation?.code}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-t border-gray-700">
                  <span className="text-gray-400">Menge:</span>
                  <span className="font-bold text-2xl">{transferItem.quantity}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setStep('quantity')}
                className="py-4 bg-gray-700 rounded-lg font-semibold"
              >
                Zurück
              </button>
              <button
                onClick={executeTransfer}
                className="py-4 bg-green-600 rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                <Check className="h-5 w-5" />
                Umlagern
              </button>
            </div>
          </>
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
          <Link href="/mobile/transfer" className="flex flex-col items-center gap-1 py-2 text-orange-500">
            <Warehouse className="h-6 w-6" />
            <span className="text-xs">Umlagern</span>
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