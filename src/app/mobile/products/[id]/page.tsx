'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import {
  Package,
  ArrowLeft,
  Edit,
  MapPin,
  BarChart,
  AlertCircle,
  Plus,
  Minus,
  Save,
  QrCode,
  Loader2
} from 'lucide-react';
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
  shopify_variant_id: string | null;
  created_at: string;
  last_inventory_update: string | null;
}

export default function MobileProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove' | 'set'>('add');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchProduct(params.id as string);
    }
  }, [params.id]);

  const fetchProduct = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setProduct(data);
    } catch (error) {
      console.error('Error fetching product:', error);
      toast.error('Produkt nicht gefunden');
      router.push('/mobile/products');
    } finally {
      setLoading(false);
    }
  };

  const adjustStock = async () => {
    if (!product) return;

    setSaving(true);
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
      setProduct({ ...product, current_stock: newStock });
      setEditMode(false);
      setQuantity(1);
    } catch (error) {
      console.error('Stock adjustment error:', error);
      toast.error('Fehler beim Aktualisieren');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!product) return null;

  const stockStatus = product.current_stock === 0 
    ? { color: 'text-red-500', bg: 'bg-red-900', text: 'Nicht vorrätig' }
    : product.current_stock <= product.minimum_stock
    ? { color: 'text-orange-500', bg: 'bg-orange-900', text: 'Niedriger Bestand' }
    : { color: 'text-green-500', bg: 'bg-green-900', text: 'Auf Lager' };

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-black bg-opacity-90 backdrop-blur-sm z-30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/mobile/products" className="p-2 rounded-lg bg-gray-800">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-xl font-bold">Produkt Details</h1>
          </div>
          <Link href={`/mobile/scan?sku=${product.sku}`} className="p-2 rounded-lg bg-orange-600">
            <QrCode className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Product Info */}
      <div className="p-4">
        {/* Image and Basic Info */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <div className="flex gap-4 mb-4">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-24 h-24 rounded-lg object-cover"
              />
            ) : (
              <div className="w-24 h-24 bg-gray-700 rounded-lg flex items-center justify-center">
                <Package className="h-12 w-12 text-gray-500" />
              </div>
            )}
            
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-1">{product.name}</h2>
              <p className="text-gray-400">SKU: {product.sku}</p>
              {product.barcode && (
                <p className="text-gray-400 text-sm">Barcode: {product.barcode}</p>
              )}
            </div>
          </div>

          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg ${stockStatus.bg} ${stockStatus.color}`}>
            <BarChart className="h-4 w-4" />
            {stockStatus.text}
          </div>
        </div>

        {/* Stock Info */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <h3 className="font-semibold mb-3">Bestand</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Aktueller Bestand</span>
              <span className="text-xl font-bold">{product.current_stock} Stück</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Mindestbestand</span>
              <span>{product.minimum_stock} Stück</span>
            </div>
            {product.storage_location && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Lagerplatz</span>
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{product.storage_location}</span>
                </div>
              </div>
            )}
          </div>
          
          {!editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="w-full mt-4 py-2 bg-orange-600 rounded-lg font-medium"
            >
              Bestand anpassen
            </button>
          )}
        </div>

        {/* Stock Adjustment */}
        {editMode && (
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <h3 className="font-semibold mb-3">Bestand anpassen</h3>
            
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
                  setEditMode(false);
                  setQuantity(1);
                }}
                className="py-3 bg-gray-700 rounded-lg font-semibold"
              >
                Abbrechen
              </button>
              <button
                onClick={adjustStock}
                disabled={saving}
                className="py-3 bg-orange-600 rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    Speichern
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}