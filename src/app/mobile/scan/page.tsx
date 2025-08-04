'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Camera,
  X,
  Package,
  Plus,
  Minus,
  MapPin,
  Check,
  Loader2,
  Home,
  ShoppingCart,
  QrCode,
  Save,
  CameraOff,
  Search,
  Scan,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
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
  const [manualBarcode, setManualBarcode] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove' | 'set'>('add');
  const [loading, setLoading] = useState(false);
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [cameraError, setCameraError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastScannedRef = useRef<string>('');
  const scanCountRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setCameraError('');
      setShowCamera(true);
      setScanStatus('Kamera wird gestartet...');
      
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false 
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.muted = true;
        
        await new Promise((resolve) => {
          videoRef.current!.onloadedmetadata = () => {
            videoRef.current!.play();
            resolve(true);
          };
        });

        // Initialize the reader
        if (!readerRef.current) {
          readerRef.current = new BrowserMultiFormatReader();
        }

        setIsScanning(true);
        setScanStatus('Barcode in den Rahmen halten...');
        scanCountRef.current = 0;
        
        // Start scanning
        scanBarcode();
      }
    } catch (error: any) {
      console.error('Camera error:', error);
      setCameraError(error.message || 'Kamera konnte nicht gestartet werden');
      toast.error('Kamera-Fehler: ' + (error.message || 'Unbekannter Fehler'));
      setShowCamera(false);
      setIsScanning(false);
    }
  };

  const scanBarcode = () => {
    if (!videoRef.current || !canvasRef.current || !readerRef.current || !isScanning) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(scanBarcode);
      return;
    }

    // Update scan count for debugging
    scanCountRef.current++;
    if (scanCountRef.current % 30 === 0) { // Every ~1 second at 30fps
      setScanStatus(`Scanning... (${Math.floor(scanCountRef.current / 30)}s)`);
    }

    // Set canvas dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Try to decode
    readerRef.current
      .decodeFromCanvas(canvas)
      .then(result => {
        const code = result.getText();
        console.log('Barcode detected:', code);
        
        if (code && code !== lastScannedRef.current) {
          lastScannedRef.current = code;
          handleBarcodeDetected(code);
        }
      })
      .catch(err => {
        if (!(err instanceof NotFoundException)) {
          console.error('Decode error:', err);
        }
        // Continue scanning
        animationRef.current = requestAnimationFrame(scanBarcode);
      });
  };

  const stopCamera = () => {
    setIsScanning(false);
    
    // Cancel animation frame
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    // Stop video stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Clear video
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Reset reader
    if (readerRef.current) {
      readerRef.current.reset();
      readerRef.current = null;
    }

    setShowCamera(false);
    setScanStatus('');
    setCameraError('');
    lastScannedRef.current = '';
    scanCountRef.current = 0;
  };

  const handleBarcodeDetected = async (code: string) => {
    // Stop scanning
    setIsScanning(false);
    
    // Vibration feedback
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
    
    setScanStatus('✓ Barcode erfolgreich gescannt!');
    
    // Process barcode after short delay
    setTimeout(() => {
      stopCamera();
      setManualBarcode(code);
      checkProduct(code);
    }, 500);
  };

  const checkProduct = async (barcode?: string) => {
    const codeToCheck = barcode || manualBarcode;
    
    if (!codeToCheck.trim()) {
      toast.error('Bitte Barcode eingeben');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('barcode', codeToCheck)
        .single();

      if (error || !data) {
        setShowCreateProduct(true);
        setProduct(null);
        toast.info('Neuer Barcode - Produkt anlegen?');
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
          sku: `SKU-${manualBarcode}`,
          barcode: manualBarcode,
          current_stock: 0,
          minimum_stock: 10,
          shopify_variant_id: null
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
      
      // Reset
      setProduct(null);
      setManualBarcode('');
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
    setManualBarcode('');
    setQuantity(1);
    setShowCreateProduct(false);
    setNewProductName('');
    stopCamera();
  };

  // Manual barcode entry for testing
  const handleManualScan = () => {
    if (showCamera && manualBarcode) {
      handleBarcodeDetected(manualBarcode);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="p-4 pb-24">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Barcode Scanner</h1>
          <Link href="/mobile" className="p-2 rounded-lg bg-gray-800">
            <X className="h-5 w-5" />
          </Link>
        </div>

        {!product && !showCreateProduct && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <label className="block text-sm font-medium mb-2">
                Barcode eingeben oder scannen
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      checkProduct();
                    }
                  }}
                  placeholder="z.B. 4006680012342"
                  className="flex-1 bg-gray-700 rounded-lg px-4 py-3 text-lg"
                  autoFocus={!showCamera}
                />
                <button
                  onClick={() => checkProduct()}
                  disabled={loading || !manualBarcode}
                  className="px-4 py-3 bg-blue-600 rounded-lg disabled:bg-gray-600"
                >
                  <Search className="h-6 w-6" />
                </button>
                <button
                  onClick={startCamera}
                  disabled={showCamera}
                  className="px-4 py-3 bg-orange-600 rounded-lg disabled:bg-gray-600"
                >
                  <Camera className="h-6 w-6" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Nutzen Sie die Kamera oder geben Sie den Code manuell ein
              </p>
            </div>

            {/* Camera View */}
            {showCamera && (
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full aspect-video object-cover"
                  style={{ maxHeight: '400px' }}
                  playsInline
                  muted
                  autoPlay
                />
                
                {/* Hidden canvas for processing */}
                <canvas
                  ref={canvasRef}
                  style={{ display: 'none' }}
                />
                
                {/* Scan Frame */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative">
                    <div className="w-64 h-32 border-2 border-orange-500 rounded-lg">
                      <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-orange-500" />
                      <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-orange-500" />
                      <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-orange-500" />
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-orange-500" />
                    </div>
                    
                    {/* Scan Line Animation */}
                    {isScanning && (
                      <div className="absolute inset-0 overflow-hidden">
                        <div className="h-0.5 bg-orange-500 absolute w-full animate-pulse" 
                             style={{
                               top: '50%',
                               transform: 'translateY(-50%)',
                               boxShadow: '0 0 8px rgba(251, 146, 60, 0.8)'
                             }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Bar */}
                <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-75 rounded-lg p-2">
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <Scan className="h-4 w-4 animate-pulse" />
                    {scanStatus}
                  </div>
                  
                  {/* Manual scan button for testing */}
                  {manualBarcode && (
                    <button
                      onClick={handleManualScan}
                      className="mt-2 w-full bg-orange-600 rounded py-1 text-xs"
                    >
                      Manuell scannen: {manualBarcode}
                    </button>
                  )}
                </div>

                {/* Error display */}
                {cameraError && (
                  <div className="absolute top-4 left-4 right-4 bg-red-900 bg-opacity-75 rounded-lg p-2 text-sm">
                    <AlertCircle className="inline h-4 w-4 mr-1" />
                    {cameraError}
                  </div>
                )}

                {/* Close Button */}
                <button
                  onClick={stopCamera}
                  className="absolute top-4 right-4 p-2 bg-red-600 rounded-full hover:bg-red-700"
                >
                  <CameraOff className="h-5 w-5" />
                </button>
              </div>
            )}

            {/* Quick Instructions */}
            {!showCamera && (
              <div className="bg-blue-900 bg-opacity-30 rounded-lg p-4">
                <h3 className="font-semibold mb-2">So funktioniert's:</h3>
                <ol className="text-sm space-y-1 text-gray-300">
                  <li>1. Barcode manuell eingeben oder Kamera nutzen</li>
                  <li>2. Produkt wird automatisch gefunden oder neu angelegt</li>
                  <li>3. Bestand anpassen und speichern</li>
                </ol>
                <p className="text-xs mt-2 text-gray-400">
                  Tipp: Halten Sie den Barcode ruhig und gut beleuchtet in den Rahmen
                </p>
              </div>
            )}
          </div>
        )}

        {/* Create New Product */}
        {showCreateProduct && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-3">Neues Produkt anlegen</h2>
              <p className="text-sm text-gray-400 mb-4">
                Barcode: <span className="font-mono text-orange-500">{manualBarcode}</span>
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
                    placeholder="z.B. Feuerwerk Rakete XL"
                    className="w-full bg-gray-700 rounded-lg px-3 py-2 text-white"
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
                    className="py-2 bg-green-600 rounded-lg font-medium flex items-center justify-center gap-2 disabled:bg-gray-600"
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
          </div>
        )}

        {/* Product Result */}
        {product && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-start gap-4">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 bg-gray-700 rounded-lg flex items-center justify-center">
                    <Package className="h-10 w-10 text-gray-500" />
                  </div>
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
                  className="flex-1 bg-gray-700 rounded-lg px-4 py-3 text-center text-xl font-bold text-white"
                />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-3 bg-gray-700 rounded-lg"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

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
                  className="py-3 bg-orange-600 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:bg-gray-600"
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

            <button
              onClick={resetScanner}
              className="w-full py-3 bg-gray-700 rounded-lg font-medium"
            >
              Nächstes Produkt scannen
            </button>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-black bg-opacity-90 backdrop-blur-sm z-40 mobile-bottom-nav">
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
          <Link href="/mobile/products" className="flex flex-col items-center gap-1 py-2 text-gray-400">
            <Package className="h-6 w-6" />
            <span className="text-xs">Produkte</span>
          </Link>
        </div>
      </div>
    </div>
  );
}