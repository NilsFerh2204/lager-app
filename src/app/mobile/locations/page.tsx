'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  MapPin,
  QrCode,
  Search,
  ArrowLeft,
  Package,
  Plus,
  Check,
  X,
  Loader2,
  Home
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface StorageLocation {
  id: string;
  code: string;
  name: string;
  zone: string;
  row_num: string;
  shelf: string;
  level: string;
  capacity: number;
  current_usage: number;
}

interface ProductLocation {
  id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  product?: {
    name: string;
    sku: string;
    image_url: string | null;
  };
}

export default function MobileLocationsPage() {
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [productLocations, setProductLocations] = useState<ProductLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<StorageLocation | null>(null);
  const [scanMode, setScanMode] = useState(false);

  useEffect(() => {
    fetchLocations();
    fetchProductLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('storage_locations')
        .select('*')
        .order('code');

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      toast.error('Fehler beim Laden der Lagerplätze');
    } finally {
      setLoading(false);
    }
  };

  const fetchProductLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('product_locations')
        .select(`
          *,
          product:product_id (
            name,
            sku,
            image_url
          )
        `);

      if (error) throw error;
      setProductLocations(data || []);
    } catch (error) {
      console.error('Error fetching product locations:', error);
    }
  };

  const handleLocationScan = (code: string) => {
    const location = locations.find(l => l.code === code);
    if (location) {
      setSelectedLocation(location);
      setScanMode(false);
      toast.success(`Lagerplatz ${code} gefunden!`);
    } else {
      toast.error('Lagerplatz nicht gefunden');
    }
  };

  const filteredLocations = locations.filter(location =>
    location.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getLocationProducts = (locationId: string) => {
    return productLocations.filter(pl => pl.location_id === locationId);
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
          <h1 className="text-lg font-semibold">Lagerplätze</h1>
          <button
            onClick={() => setScanMode(!scanMode)}
            className="p-2 rounded-lg bg-gray-800"
          >
            <QrCode className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-20 p-4">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Lagerplatz suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-800 rounded-lg text-white placeholder-gray-400"
          />
        </div>

        {/* Scanner Mode */}
        {scanMode && (
          <div className="bg-orange-900 bg-opacity-50 border border-orange-600 rounded-lg p-4 mb-4">
            <p className="text-center">Scanner-Modus aktiv</p>
            <p className="text-center text-sm text-gray-300 mt-1">
              Scannen Sie einen Lagerplatz QR-Code
            </p>
            <button
              onClick={() => setScanMode(false)}
              className="w-full mt-3 py-2 bg-gray-700 rounded-lg"
            >
              Abbrechen
            </button>
          </div>
        )}

        {/* Selected Location Details */}
        {selectedLocation && (
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h2 className="text-xl font-bold">{selectedLocation.code}</h2>
                <p className="text-gray-400">{selectedLocation.name}</p>
              </div>
              <button
                onClick={() => setSelectedLocation(null)}
                className="p-1 text-gray-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
              <div>
                <span className="text-gray-400">Zone:</span> {selectedLocation.zone}
              </div>
              <div>
                <span className="text-gray-400">Reihe:</span> {selectedLocation.row_num}
              </div>
              <div>
                <span className="text-gray-400">Regal:</span> {selectedLocation.shelf}
              </div>
              <div>
                <span className="text-gray-400">Ebene:</span> {selectedLocation.level}
              </div>
            </div>

            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-400">Auslastung:</span>
              <div className="flex items-center gap-2">
                <span className={`font-bold ${
                  selectedLocation.current_usage >= selectedLocation.capacity ? 'text-red-500' :
                  selectedLocation.current_usage > selectedLocation.capacity * 0.8 ? 'text-orange-500' :
                  'text-green-500'
                }`}>
                  {selectedLocation.current_usage}/{selectedLocation.capacity}
                </span>
                <div className="w-20 bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      selectedLocation.current_usage >= selectedLocation.capacity ? 'bg-red-500' :
                      selectedLocation.current_usage > selectedLocation.capacity * 0.8 ? 'bg-orange-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, (selectedLocation.current_usage / selectedLocation.capacity) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Products at this location */}
            <div>
              <h3 className="font-semibold mb-2">Produkte hier:</h3>
              {getLocationProducts(selectedLocation.id).length > 0 ? (
                <div className="space-y-2">
                  {getLocationProducts(selectedLocation.id).map(pl => (
                    <div key={pl.id} className="flex items-center gap-3 bg-gray-700 rounded-lg p-3">
                      {pl.product?.image_url && (
                        <img 
                          src={pl.product.image_url} 
                          alt={pl.product.name}
                          className="w-12 h-12 rounded object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{pl.product?.name}</p>
                        <p className="text-sm text-gray-400">SKU: {pl.product?.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{pl.quantity}x</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">Keine Produkte</p>
              )}
            </div>
          </div>
        )}

        {/* Locations List */}
        <div className="space-y-3">
          {filteredLocations.map(location => (
            <div
              key={location.id}
              onClick={() => setSelectedLocation(location)}
              className="bg-gray-800 rounded-lg p-4 flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold">{location.code}</h3>
                <p className="text-sm text-gray-400">{location.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs bg-gray-700 px-2 py-1 rounded">
                    Zone {location.zone}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    location.current_usage === 0 ? 'bg-green-900 text-green-300' :
                    location.current_usage >= location.capacity ? 'bg-red-900 text-red-300' :
                    'bg-blue-900 text-blue-300'
                  }`}>
                    {location.current_usage}/{location.capacity}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-center">
                  <Package className="h-6 w-6 text-gray-400" />
                  <p className="text-xs text-gray-400 mt-1">
                    {getLocationProducts(location.id).length}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
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
          <Link href="/mobile/locations" className="flex flex-col items-center gap-1 py-2 text-orange-500">
            <MapPin className="h-6 w-6" />
            <span className="text-xs">Plätze</span>
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