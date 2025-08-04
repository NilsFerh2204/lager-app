'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Camera,
  X,
  Package,
  Plus,
  Minus,
  MapPin,
  ArrowLeft,
  FlashOff,
  Flashlight,
  SwitchCamera,
  Search,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BrowserMultiFormatReader, BarcodeFormat } from '@zxing/library';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  current_stock: number;
  minimum_stock: number;
  storage_location: string | null;
  image_url: string | null;
  price: number | null;
}

export default function MobileScannerPage() {
  const [scanning, setScanning] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [manualCode, setManualCode] = useState('');
  const [adjustQuantity, setAdjustQuantity] = useState(0);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Initialize barcode reader
    codeReaderRef.current = new BrowserMultiFormatReader();
    
    // Add PWA install prompt
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }

    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    try {
      setScanning(true);
      const codeReader = codeReaderRef.current;
      if (!codeReader || !videoRef.current) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      streamRef.current = stream;
      videoRef.current.srcObject = stream;

      codeReader.decodeFromVideoDevice(
        null,
        videoRef.current,
        async (result, error) => {
          if (result) {
            const code = result.getText();
            await handleBarcodeScan(code);
            stopScanning();
          }
        }
      );
    } catch (error) {
      console.error('Error starting scanner:', error);
      toast.error('Kamera-Zugriff verweigert');
      setScanning(false);
    }
  };

  const stopScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
    setScanning(false);
  };

  const handleBarcodeScan = async (code: string) => {
    setLoading(true);
    
    // Vibration feedback
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }

    try {
      // Search by barcode or SKU
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .or(`barcode.eq.${code},sku.eq.${code}`)
        .single();

      if (error || !data) {
        toast.error('Produkt nicht gefunden');
        return;
      }

      setProduct(data);
      toast.success(`${data.name} gefunden!`);
    } catch (error) {
      console.error('Error fetching product:', error);
      toast.error('Fehler beim Laden des Produkts');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = async () => {
    if (!manualCode) return;
    await handleBarcodeScan(manualCode);
    setManualCode('');
  };

  const adjustStock = async () => {
    if (!product || adjustQuantity === 0) return;

    try {
      const newStock = Math.max(0, product.current_stock + adjustQuantity);
      
      const { error } = await supabase
        .from('products')
        .update({ 
          current_stock: newStock,
          last_inventory_update: new Date().toISOString()
        })
        .eq('id', product.id);

      if (error) throw error;

      setProduct({ ...product, current_stock: newStock });
      toast.success(`Bestand aktualisiert: ${newStock}`);
      setShowAdjustModal(false);
      setAdjustQuantity(0);
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const toggleFlash = () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any;
      if (capabilities.torch) {
        track.applyConstraints({
          advanced: [{ torch: !flashOn }]
        } as any);
        setFlashOn(!flashOn);
      }
    }
  };

  const switchCamera = () => {
    setFacingMode(facingMode === 'environment' ? 'user' : 'environment');
    if (scanning) {
      stopScanning();
      setTimeout(() => startScanning(), 100);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-black bg-opacity-80 backdrop-blur-sm z-50">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => window.history.back()}
            className="p-2 rounded-lg bg-gray-800"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold">Barcode Scanner</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Scanner View */}
      {scanning && (
        <div className="fixed inset-0 z-40">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
          
          {/* Scanner Overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <div className="w-64 h-64 border-2 border-white rounded-lg">
                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-orange-500 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-orange-500 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-orange-500 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-orange-500 rounded-br-lg" />
              </div>
              <p className="text-center mt-4 text-white drop-shadow-lg">
                Barcode in den Rahmen halten
              </p>
            </div>
          </div>

          {/* Scanner Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent">
            <div className="flex justify-center gap-4">
              <button
                onClick={toggleFlash}
                className="p-3 bg-gray-800 rounded-full"
              >
                {flashOn ? <Flashlight className="h-6 w-6" /> : <FlashOff className="h-6 w-6" />}
              </button>
              <button
                onClick={stopScanning}
                className="p-4 bg-red-600 rounded-full"
              >
                <X className="h-8 w-8" />
              </button>
              <button
                onClick={switchCamera}
                className="p-3 bg-gray-800 rounded-full"
              >
                <SwitchCamera className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="pt-20 p-4">
        {!scanning && !product && (
          <>
            {/* Start Scanner Button */}
            <button
              onClick={startScanning}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-6 rounded-lg flex items-center justify-center gap-3 mb-6"
            >
              <Camera className="h-8 w-8" />
              <span className="text-xl font-semibold">Scanner starten</span>
            </button>

            {/* Manual Entry */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-3">Manuelle Eingabe</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Barcode oder SKU eingeben..."
                  className="flex-1 px-4 py-3 bg-gray-700 rounded-lg text-white placeholder-gray-400"
                  onKeyPress={(e) => e.key === 'Enter' && handleManualSearch()}
                />
                <button
                  onClick={handleManualSearch}
                  className="px-6 py-3 bg-blue-600 rounded-lg"
                >
                  <Search className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-6 grid grid-cols-2 gap-4">
              <button
                onClick={() => window.location.href = '/mobile/picking'}
                className="bg-gray-800 p-6 rounded-lg flex flex-col items-center gap-2"
              >
                <Package className="h-10 w-10 text-blue-500" />
                <span>Kommissionierung</span>
              </button>
              <button
                onClick={() => window.location.href = '/mobile/inventory'}
                className="bg-gray-800 p-6 rounded-lg flex flex-col items-center gap-2"
              >
                <ClipboardList className="h-10 w-10 text-green-500" />
                <span>Inventur</span>
              </button>
            </div>
          </>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-12 w-12 animate-spin" />
          </div>
        )}

        {/* Product Details */}
        {product && !loading && (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            {product.image_url && (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-48 object-cover"
              />
            )}
            
            <div className="p-4">
              <h2 className="text-xl font-bold mb-2">{product.name}</h2>
              <p className="text-gray-400 mb-4">SKU: {product.sku}</p>
              
              {/* Stock Info */}
              <div className="bg-gray-700 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400">Aktueller Bestand:</span>
                  <span className={`text-2xl font-bold ${
                    product.current_stock <= product.minimum_stock ? 'text-red-500' : 'text-green-500'
                  }`}>
                    {product.current_stock}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Mindestbestand:</span>
                  <span className="text-lg">{product.minimum_stock}</span>
                </div>
                {product.current_stock <= product.minimum_stock && (
                  <div className="mt-2 flex items-center gap-2 text-orange-500">
                    <AlertCircle className="h-5 w-5" />
                    <span className="text-sm">Bestand niedrig!</span>
                  </div>
                )}
              </div>

              {/* Location */}
              {product.storage_location && (
                <div className="flex items-center gap-2 mb-4 text-blue-400">
                  <MapPin className="h-5 w-5" />
                  <span className="font-medium">{product.storage_location}</span>
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowAdjustModal(true)}
                  className="bg-blue-600 py-3 rounded-lg font-medium"
                >
                  Bestand anpassen
                </button>
                <button
                  onClick={() => {
                    setProduct(null);
                    startScanning();
                  }}
                  className="bg-gray-700 py-3 rounded-lg font-medium"
                >
                  Neuer Scan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Adjust Stock Modal */}
      {showAdjustModal && product && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-xl font-bold mb-4">Bestand anpassen</h3>
            <p className="text-gray-400 mb-6">{product.name}</p>
            
            <div className="flex items-center justify-center gap-4 mb-6">
              <button
                onClick={() => setAdjustQuantity(adjustQuantity - 1)}
                className="p-3 bg-red-600 rounded-full"
              >
                <Minus className="h-6 w-6" />
              </button>
              
              <div className="text-center">
                <p className="text-3xl font-bold">
                  {product.current_stock + adjustQuantity}
                </p>
                <p className="text-sm text-gray-400">
                  {adjustQuantity > 0 ? '+' : ''}{adjustQuantity}
                </p>
              </div>
              
              <button
                onClick={() => setAdjustQuantity(adjustQuantity + 1)}
                className="p-3 bg-green-600 rounded-full"
              >
                <Plus className="h-6 w-6" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setShowAdjustModal(false);
                  setAdjustQuantity(0);
                }}
                className="py-3 bg-gray-700 rounded-lg"
              >
                Abbrechen
              </button>
              <button
                onClick={adjustStock}
                disabled={adjustQuantity === 0}
                className="py-3 bg-blue-600 rounded-lg disabled:opacity-50"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}