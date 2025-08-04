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
  Flashlight,
  SwitchCamera,
  Search,
  Check,
  AlertCircle,
  Loader2,
  Home,
  ShoppingCart,
  ClipboardList,
  QrCode,
  Smartphone,
  Database
} from 'lucide-react';
import Link from 'next/link';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/library';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  sku: string;
  current_stock: number;
  storage_location: string | null;
  image_url: string | null;
}

export default function MobileScannerPage() {
  const [scanning, setScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove' | 'set'>('add');
  const [flashOn, setFlashOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [loading, setLoading] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);
    
    // Check if camera permissions are already granted
    checkCameraPermission();
  }, []);

  const checkCameraPermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      setHasPermission(result.state === 'granted');
      
      if (result.state === 'prompt') {
        setShowInstructions(true);
      }
    } catch (error) {
      // iOS doesn't support permissions API, we'll try to request camera access
      console.log('Permissions API not supported');
    }
  };

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      // Permission granted, stop the stream
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
      setShowInstructions(false);
      return true;
    } catch (error) {
      console.error('Camera permission denied:', error);
      setHasPermission(false);
      toast.error('Kamera-Zugriff verweigert. Bitte erlauben Sie den Zugriff in den Einstellungen.');
      return false;
    }
  };

  const startScanning = async () => {
    // First check/request permission
    if (hasPermission === false || hasPermission === null) {
      const granted = await requestCameraPermission();
      if (!granted) return;
    }

    try {
      setScanning(true);
      if (!readerRef.current) {
        readerRef.current = new BrowserMultiFormatReader();
      }

      // Explizit Rückkamera anfordern
      const constraints = {
        video: {
          facingMode: { exact: "environment" }, // Rückkamera erzwingen
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      // Direkt Stream anfordern
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Scanner auf diesem Stream starten
        scannerRef.current = await readerRef.current.decodeFromVideoElement(
          videoRef.current,
          (result, error) => {
            if (result) {
              const code = result.getText();
              handleScan(code);
              
              if (navigator.vibrate) {
                navigator.vibrate(200);
              }
            }
          }
        );

        // Apply torch if supported
        if (flashOn) {
          const track = stream.getVideoTracks()[0];
          if (track.getCapabilities && 'torch' in track.getCapabilities()) {
            await track.applyConstraints({
              // @ts-ignore
              advanced: [{ torch: flashOn }]
            });
          }
        }
      }
    } catch (error: any) {
      console.error('Exact environment camera error:', error);
      
      // Falls exact environment nicht funktioniert, normale Rückkamera
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          
          // Scanner mit Fallback starten
          scannerRef.current = await readerRef.current!.decodeFromVideoElement(
            videoRef.current,
            (result, error) => {
              if (result) {
                const code = result.getText();
                handleScan(code);
                
                if (navigator.vibrate) {
                  navigator.vibrate(200);
                }
              }
            }
          );
        }
      } catch (fallbackError: any) {
        console.error('Kamera-Fehler:', fallbackError);
        setScanning(false);
        
        if (fallbackError.name === 'NotAllowedError') {
          setHasPermission(false);
          toast.error('Kamera-Zugriff verweigert. Bitte erlauben Sie den Zugriff.');
        } else {
          toast.error('Kamera konnte nicht gestartet werden');
        }
      }
    }
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current = null;
    }
    
    // Stop video stream
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    setScanning(false);
  };

  const handleScan = async (code: string) => {
    setScannedCode(code);
    stopScanning();
    await searchProduct(code);
  };

  const searchProduct = async (searchTerm: string) => {
    setLoading(true);
    try {
      // Erst nach Produkt mit Barcode suchen
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .or(`sku.eq.${searchTerm},barcode.eq.${searchTerm}`)
        .single();

      if (error || !data) {
        // Produkt nicht gefunden - als unbekannten Barcode speichern
        const { error: insertError } = await supabase
          .from('unknown_barcodes')
          .upsert({
            barcode: searchTerm,
            scan_count: 1,
            last_scanned: new Date().toISOString()
          }, {
            onConflict: 'barcode'
          });

        // Scan count erhöhen wenn bereits existiert
        if (insertError?.code === '23505') { // Duplicate key
          await supabase.rpc('increment_scan_count', { 
            barcode_param: searchTerm 
          });
        }

        toast.error('Unbekannter Barcode! Bitte zuordnen.');
        
        // Option zum Zuordnen anbieten
        if (confirm('Möchten Sie diesen Barcode jetzt einem Produkt zuordnen?')) {
          window.location.href = `/mobile/barcode-learning?barcode=${searchTerm}`;
        }
        
        setProduct(null);
      } else {
        setProduct(data);
        toast.success(`Produkt gefunden: ${data.name}`);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Fehler bei der Suche');
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

      // Log inventory adjustment
      await supabase
        .from('inventory_adjustments')
        .insert({
          product_id: product.id,
          old_quantity: product.current_stock,
          new_quantity: newStock,
          difference: newStock - product.current_stock,
          reason: adjustmentType === 'add' ? 'Wareneingang' : adjustmentType === 'remove' ? 'Entnahme' : 'Inventur',
          adjusted_by: 'Mobile Scanner'
        });

      toast.success(`Bestand aktualisiert: ${newStock} Stück`);
      setProduct({ ...product, current_stock: newStock });
      
      // Reset for next scan
      setTimeout(() => {
        setProduct(null);
        setScannedCode('');
        setQuantity(1);
        if (!manualMode) {
          startScanning();
        }
      }, 2000);
    } catch (error) {
      console.error('Stock adjustment error:', error);
      toast.error('Fehler beim Aktualisieren');
    } finally {
      setLoading(false);
    }
  };

  const toggleFlash = async () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      
      if (track.getCapabilities && 'torch' in track.getCapabilities()) {
        const newFlashState = !flashOn;
        try {
          await track.applyConstraints({
            // @ts-ignore
            advanced: [{ torch: newFlashState }]
          });
          setFlashOn(newFlashState);
        } catch (error) {
          console.error('Flash toggle error:', error);
          toast.error('Taschenlampe nicht verfügbar');
        }
      } else {
        toast.error('Taschenlampe nicht verfügbar');
      }
    }
  };

  const switchCamera = async () => {
    stopScanning();
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    setTimeout(() => {
      startScanning();
    }, 100);
  };

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
          <h1 className="text-lg font-semibold">Barcode Scanner</h1>
          <button
            onClick={() => setManualMode(!manualMode)}
            className="p-2 rounded-lg bg-gray-800"
          >
            {manualMode ? <Camera className="h-6 w-6" /> : <Search className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-20 p-4">
        {/* iOS Instructions */}
        {isIOS && showInstructions && (
          <div className="bg-blue-900 bg-opacity-50 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <Smartphone className="h-6 w-6 text-blue-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">iOS Kamera-Zugriff</h3>
                <p className="text-sm text-gray-300 mb-2">
                  Für den Scanner benötigt die App Zugriff auf Ihre Kamera.
                </p>
                <p className="text-sm text-gray-400">
                  Falls Sie gefragt werden, tippen Sie auf "Erlauben".
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Permission Denied Message */}
        {hasPermission === false && (
          <div className="bg-red-900 bg-opacity-50 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Kamera-Zugriff verweigert</h3>
                <p className="text-sm text-gray-300 mb-2">
                  Bitte erlauben Sie den Kamera-Zugriff in den Einstellungen:
                </p>
                <ol className="text-sm text-gray-400 list-decimal list-inside">
                  <li>Öffnen Sie die iOS Einstellungen</li>
                  <li>Safari → Kamera → Erlauben</li>
                  <li>Laden Sie diese Seite neu</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {!manualMode ? (
          /* Camera Scanner */
          <div className="space-y-4">
            {!scanning && !product && (
              <button
                onClick={startScanning}
                disabled={hasPermission === false}
                className={`w-full py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-2 ${
                  hasPermission === false 
                    ? 'bg-gray-700 text-gray-400' 
                    : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                <Camera className="h-6 w-6" />
                Scanner starten
              </button>
            )}

            {scanning && (
              <div className="relative rounded-lg overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  className="w-full aspect-[4/3] object-cover"
                  autoPlay
                  playsInline
                />
                <div className="absolute inset-0 border-2 border-orange-500 m-8 rounded-lg pointer-events-none" />
                
                {/* Scanner Controls */}
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                  <button
                    onClick={toggleFlash}
                    className="p-3 bg-gray-800 bg-opacity-80 rounded-full"
                  >
                    <Flashlight className={`h-6 w-6 ${flashOn ? 'text-yellow-400' : 'text-gray-400'}`} />
                  </button>
                  <button
                    onClick={stopScanning}
                    className="p-3 bg-red-600 rounded-full"
                  >
                    <X className="h-6 w-6" />
                  </button>
                  <button
                    onClick={switchCamera}
                    className="p-3 bg-gray-800 bg-opacity-80 rounded-full"
                  >
                    <SwitchCamera className="h-6 w-6 text-gray-400" />
                  </button>
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
                  className="px-4 py-3 bg-orange-600 rounded-lg"
                >
                  <Search className="h-6 w-6" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Product Result */}
        {product && (
          <div className="mt-6 space-y-4">
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
                  onClick={() => {
                    setProduct(null);
                    setScannedCode('');
                    if (!manualMode) startScanning();
                  }}
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
          </div>
        )}

        {/* Quick Actions */}
        {!scanning && !product && (
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
      <div className="fixed bottom-0 left-0 right-0 bg-black bg-opacity-90 backdrop-blur-sm">
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