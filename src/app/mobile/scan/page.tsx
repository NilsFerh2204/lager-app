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
  Search,
  Check,
  AlertCircle,
  Loader2,
  Home,
  ShoppingCart,
  ClipboardList,
  QrCode,
  Database,
  CameraOff,
  Save,
  SwitchCamera,
  Flashlight
} from 'lucide-react';
import Link from 'next/link';
import { BrowserMultiFormatReader } from '@zxing/library';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  sku: string;
  current_stock: number;
  storage_location: string | null;
  image_url: string | null;
  barcode: string | null;
}

export default function MobileScannerPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove' | 'set'>('add');
  const [loading, setLoading] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [currentCamera, setCurrentCamera] = useState<'user' | 'environment'>('environment');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [torchOn, setTorchOn] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Get available cameras on mount
    getAvailableCameras();
    
    // Cleanup on unmount
    return () => {
      stopCamera();
    };
  }, []);

  const getAvailableCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(videoDevices);
    } catch (error) {
      console.error('Error getting cameras:', error);
    }
  };

  const startCamera = async (preferredCamera?: 'user' | 'environment') => {
    try {
      // Stop any existing camera first
      stopCamera();

      const cameraMode = preferredCamera || currentCamera;
      
      // Try to get the specific camera
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: cameraMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // Apply torch if supported
        const track = mediaStream.getVideoTracks()[0];
        if ('torch' in track.getCapabilities()) {
          await track.applyConstraints({
            advanced: [{ torch: torchOn } as any]
          });
        }
        
        // Start scanning
        if (!readerRef.current) {
          readerRef.current = new BrowserMultiFormatReader();
        }

        setIsScanning(true);

        // Scan continuously
        intervalRef.current = setInterval(async () => {
          if (!videoRef.current || !readerRef.current) {
            return;
          }

          try {
            const result = await readerRef.current.decodeOnceFromVideoElement(videoRef.current);
            if (result) {
              const code = result.getText();
              handleBarcodeDetected(code);
            }
          } catch (err) {
            // No barcode found, continue scanning
          }
        }, 500);
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast.error('Kamera konnte nicht gestartet werden');
      setIsScanning(false);
    }
  };

  const switchCamera = async () => {
    const newCamera = currentCamera === 'environment' ? 'user' : 'environment';
    setCurrentCamera(newCamera);
    
    if (isScanning) {
      await startCamera(newCamera);
    }
  };

  const toggleTorch = async () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if ('torch' in track.getCapabilities()) {
        const newTorchState = !torchOn;
        setTorchOn(newTorchState);
        await track.applyConstraints({
          advanced: [{ torch: newTorchState } as any]
        });
      } else {
        toast.error('Taschenlampe nicht verfügbar');
      }
    }
  };

  const stopCamera = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
    setTorchOn(false);
  };

  const handleBarcodeDetected = async (code: string) => {
    // Stop camera immediately
    stopCamera();
    
    // Vibration feedback
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }
    
    setScannedCode(code);
    await searchProduct(code);
  };

  const searchProduct = async (searchTerm: string) => {
    setLoading(true);
    try {
      // Search for product by barcode or SKU
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .or(`sku.eq.${searchTerm},barcode.eq.${searchTerm}`)
        .single();

      if (error || !data) {
        // Product not found - offer to create new product
        setShowCreateProduct(true);
        setProduct(null);
        toast.error('Produkt nicht gefunden');
      } else {
        setProduct(data);
        setShowCreateProduct(false);
        toast.success(`Gefunden: ${data.name}`);
      }
    } catch (error) {
      console.error('Search error:', error);
      setShowCreateProduct(true);
      setProduct(null);
    } finally {
      setLoading(false);
    }
  };

  const createNewProduct = async () => {
    if (!newProductName.trim()) {
      toast.error('Bitte Produktname eingeben');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .insert({
          name: newProductName,
          sku: scannedCode,
          barcode: scannedCode,
          current_stock: 0,
          minimum_stock: 10,
          shopify_id: null
        })
        .select()
        .single();

      if (error) throw error;

      setProduct(data);
      setShowCreateProduct(false);
      setNewProductName('');
      toast.success('Produkt erstellt!');
    } catch (error) {
      console.error('Create product error:', error);
      toast.error('Fehler beim Erstellen');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = async () => {
    if (!scannedCode.trim()) {
      toast.error('Bitte Barcode eingeben');
      return;
    }
    await searchProduct(scannedCode);
  };

  const adjustStock = async () => {
    if (!product) return;

    setLoading(true);
    try {
      let newStock = product.current_stock;
      
      switch (adjustmentType) {
        case 'add':
          newStock += quantity;
          break;
        case 'remove':
          newStock = Math.max(0, newStock - quantity);
          break;
        case 'set':
          newStock = quantity;
          break;
      }

      const { error } = await supabase
        .from('products')
        .update({ 
          current_stock: newStock,
          last_inventory_update: new Date().toISOString()
        })
        .eq('id', product.id);

      if (error) throw error;

      toast.success(`Bestand aktualisiert: ${newStock} Stück`);
      
      // Reset for next scan
      setProduct(null);
      setScannedCode('');
      setQuantity(1);
      setShowCreateProduct(false);
    } catch (error) {
      console.error('Stock adjustment error:', error);
      toast.error('Fehler beim Aktualisieren');
    } finally {
      setLoading(false);
    }
  };

  const resetScanner = () => {
    setProduct(null);
    setScannedCode('');
    setQuantity(1);
    setShowCreateProduct(false);
    setNewProductName('');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Main Content */}
      <div className="p-4 pb-24">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Barcode Scanner</h1>
          <button
            onClick={() => setManualMode(!manualMode)}
            className="p-2 rounded-lg bg-gray-800"
          >
            {manualMode ? <Camera className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>
        </div>

        {!product && !showCreateProduct && (
          <>
            {!manualMode ? (
              /* Camera Scanner */
              <div className="space-y-4">
                {!isScanning ? (
                  <button
                    onClick={() => startCamera()}
                    className="w-full py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700"
                  >
                    <Camera className="h-6 w-6" />
                    Kamera starten
                  </button>
                ) : (
                  <div className="relative rounded-lg overflow-hidden bg-black">
                    <video
                      ref={videoRef}
                      className="w-full aspect-[4/3] object-cover"
                      autoPlay
                      playsInline
                      muted
                    />
                    
                    {/* Scan frame overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-64 h-48 border-2 border-orange-500 rounded-lg">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-500" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-500" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-500" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-500" />
                      </div>
                    </div>
                    
                    {/* Camera Controls */}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                      <button
                        onClick={switchCamera}
                        className="p-3 bg-gray-800 bg-opacity-80 rounded-full"
                        title="Kamera wechseln"
                      >
                        <SwitchCamera className="h-6 w-6" />
                      </button>
                      
                      <button
                        onClick={stopCamera}
                        className="p-3 bg-red-600 rounded-full"
                      >
                        <CameraOff className="h-6 w-6" />
                      </button>
                      
                      <button
                        onClick={toggleTorch}
                        className="p-3 bg-gray-800 bg-opacity-80 rounded-full"
                        title="Taschenlampe"
                      >
                        <Flashlight className={`h-6 w-6 ${torchOn ? 'text-yellow-400' : ''}`} />
                      </button>
                    </div>

                    {/* Current Camera Indicator */}
                    <div className="absolute top-4 right-4 bg-black bg-opacity-50 px-3 py-1 rounded-full text-xs">
                      {currentCamera === 'environment' ? 'Rückkamera' : 'Frontkamera'}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Manual Input */
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Barcode / SKU eingeben
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={scannedCode}
                      onChange={(e) => setScannedCode(e.target.value)}
                      placeholder="z.B. 123456789"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-lg"
                      autoFocus
                    />
                    <button
                      onClick={handleManualSearch}
                      disabled={loading || !scannedCode}
                      className="px-4 py-3 bg-orange-600 rounded-lg disabled:bg-gray-700"
                    >
                      <Search className="h-6 w-6" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Create New Product */}
        {showCreateProduct && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-3">Neues Produkt anlegen</h2>
              <p className="text-sm text-gray-400 mb-4">
                Barcode: <span className="font-mono">{scannedCode}</span>
              </p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Produktname
                  </label>
                  <input
                    type="text"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="z.B. Feuerwerk Batterie XL"
                    className="w-full bg-gray-700 rounded-lg px-3 py-2"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={resetScanner}
                    className="py-2 bg-gray-700 rounded-lg font-medium"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={createNewProduct}
                    disabled={loading || !newProductName.trim()}
                    className="py-2 bg-green-600 rounded-lg font-medium flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Save className="h-5 w-5" />
                        Erstellen
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <Link
              href={`/mobile/barcode-learning?barcode=${scannedCode}`}
              className="block text-center text-orange-500 underline"
            >
              Oder vorhandenes Produkt zuordnen →
            </Link>
          </div>
        )}

        {/* Product Result */}
        {product && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-start gap-4">
                {product.image_url && (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{product.name}</h3>
                  <p className="text-gray-400">SKU: {product.sku}</p>
                  {product.barcode && (
                    <p className="text-gray-400 text-sm">Barcode: {product.barcode}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <MapPin className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">{product.storage_location || 'Kein Lagerplatz'}</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-400">Aktueller Bestand</p>
                <p className="text-2xl font-bold">{product.current_stock} Stück</p>
              </div>
            </div>

            {/* Stock Adjustment */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium mb-3">Bestand anpassen</h4>
              
              {/* Adjustment Type */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                  onClick={() => setAdjustmentType('add')}
                  className={`py-2 rounded-lg font-medium ${
                    adjustmentType === 'add' 
                      ? 'bg-green-600' 
                      : 'bg-gray-700'
                  }`}
                >
                  + Hinzu
                </button>
                <button
                  onClick={() => setAdjustmentType('remove')}
                  className={`py-2 rounded-lg font-medium ${
                    adjustmentType === 'remove' 
                      ? 'bg-red-600' 
                      : 'bg-gray-700'
                  }`}
                >
                  - Entnahme
                </button>
                <button
                  onClick={() => setAdjustmentType('set')}
                  className={`py-2 rounded-lg font-medium ${
                    adjustmentType === 'set' 
                      ? 'bg-blue-600' 
                      : 'bg-gray-700'
                  }`}
                >
                  = Setzen
                </button>
              </div>

              {/* Quantity Input */}
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-3 bg-gray-700 rounded-lg"
                >
                  <Minus className="h-5 w-5" />
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 bg-gray-700 rounded-lg px-4 py-3 text-center text-xl font-bold"
                />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-3 bg-gray-700 rounded-lg"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              {/* Preview */}
              <div className="p-3 bg-gray-700 rounded-lg mb-4 text-center">
                <p className="text-sm text-gray-400">Neuer Bestand</p>
                <p className="text-xl font-bold">
                  {adjustmentType === 'add' 
                    ? product.current_stock + quantity
                    : adjustmentType === 'remove'
                    ? Math.max(0, product.current_stock - quantity)
                    : quantity
                  } Stück
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={resetScanner}
                  className="py-3 bg-gray-700 rounded-lg font-semibold"
                >
                  Abbrechen
                </button>
                <button
                  onClick={adjustStock}
                  disabled={loading}
                  className="py-3 bg-orange-600 rounded-lg font-semibold flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-5 w-5" />
                      Speichern
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Scan next button */}
            <button
              onClick={() => {
                resetScanner();
                if (!manualMode) startCamera();
              }}
              className="w-full py-3 bg-gray-700 rounded-lg font-medium"
            >
              Nächstes Produkt scannen
            </button>
          </div>
        )}

        {/* Quick Actions */}
        {!isScanning && !product && !showCreateProduct && (
          <div className="mt-8 grid grid-cols-2 gap-4">
            <Link
              href="/mobile/inventory"
              className="bg-gray-800 rounded-lg p-4 flex flex-col items-center gap-2"
            >
              <ClipboardList className="h-8 w-8 text-blue-500" />
              <span className="text-sm">Inventur</span>
            </Link>
            <Link
              href="/mobile/transfer"
              className="bg-gray-800 rounded-lg p-4 flex flex-col items-center gap-2"
            >
              <Package className="h-8 w-8 text-green-500" />
              <span className="text-sm">Umlagerung</span>
            </Link>
            <Link
              href="/mobile/barcode-learning"
              className="bg-gray-800 rounded-lg p-4 flex flex-col items-center gap-2"
            >
              <Database className="h-8 w-8 text-yellow-500" />
              <span className="text-sm">Barcodes</span>
            </Link>
            <Link
              href="/mobile/locations"
              className="bg-gray-800 rounded-lg p-4 flex flex-col items-center gap-2"
            >
              <MapPin className="h-8 w-8 text-purple-500" />
              <span className="text-sm">Lagerplätze</span>
            </Link>
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
          <Link href="/mobile/scan" className="flex flex-col items-center gap-1 py-2 text-orange-500">
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