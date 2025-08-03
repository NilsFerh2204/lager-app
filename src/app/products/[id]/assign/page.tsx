'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  Package, MapPin, Plus, Minus, Save, ArrowLeft,
  AlertCircle, CheckCircle, Warehouse
} from 'lucide-react'

export default function AssignProductPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string
  
  const [product, setProduct] = useState<any>(null)
  const [locations, setLocations] = useState<any[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [assignments, setAssignments] = useState<{[key: string]: number}>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadData()
  }, [productId])

  const loadData = async () => {
    try {
      // Produkt laden
      const { data: productData } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()

      // Lagerplätze laden
      const { data: locationsData } = await supabase
        .from('storage_locations')
        .select('*')
        .order('code')

      // Aktuelle Inventory laden
      const { data: inventoryData } = await supabase
        .from('inventory')
        .select('*')
        .eq('product_id', productId)

      setProduct(productData)
      setLocations(locationsData || [])
      setInventory(inventoryData || [])

      // Bestehende Zuweisungen in State laden
      const existingAssignments: {[key: string]: number} = {}
      inventoryData?.forEach(inv => {
        existingAssignments[inv.location_id] = inv.quantity
      })
      setAssignments(existingAssignments)
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleQuantityChange = (locationId: string, delta: number) => {
    setAssignments(prev => {
      const current = prev[locationId] || 0
      const newValue = Math.max(0, current + delta)
      
      if (newValue === 0) {
        const { [locationId]: _, ...rest } = prev
        return rest
      }
      
      return { ...prev, [locationId]: newValue }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    try {
      // Alle bestehenden Inventory-Einträge für dieses Produkt löschen
      await supabase
        .from('inventory')
        .delete()
        .eq('product_id', productId)

      // Neue Inventory-Einträge erstellen
      const inventoryEntries = Object.entries(assignments)
        .filter(([_, quantity]) => quantity > 0)
        .map(([locationId, quantity]) => ({
          product_id: productId,
          location_id: locationId,
          quantity
        }))

      if (inventoryEntries.length > 0) {
        await supabase
          .from('inventory')
          .insert(inventoryEntries)
      }

      // Gesamtbestand im Produkt aktualisieren
      const totalStock = Object.values(assignments).reduce((sum, qty) => sum + qty, 0)
      await supabase
        .from('products')
        .update({ current_stock: totalStock })
        .eq('id', productId)

      setMessage('Lagerplätze erfolgreich zugewiesen!')
      setTimeout(() => {
        router.push('/products')
      }, 1500)
    } catch (error) {
      console.error('Fehler beim Speichern:', error)
      setMessage('Fehler beim Speichern der Zuweisungen')
    } finally {
      setSaving(false)
    }
  }

  const getTotalAssigned = () => {
    return Object.values(assignments).reduce((sum, qty) => sum + qty, 0)
  }

  const groupedLocations = locations.reduce((acc, loc) => {
    if (!acc[loc.zone]) acc[loc.zone] = []
    acc[loc.zone].push(loc)
    return acc
  }, {} as {[key: string]: any[]})

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Lade Daten...</p>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-xl text-gray-900">Produkt nicht gefunden</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <a href="/products" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
            <ArrowLeft className="w-4 h-4" />
            Zurück zur Produktübersicht
          </a>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-start gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl">
                <Package className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Lagerplätze zuweisen
                </h1>
                <div className="space-y-1">
                  <p className="text-lg font-medium">{product.name}</p>
                  <div className="flex gap-4 text-sm text-gray-600">
                    <span>SKU: {product.sku}</span>
                    {product.barcode && <span>Barcode: {product.barcode}</span>}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Gesamt zugewiesen</p>
                <p className="text-3xl font-bold text-blue-600">{getTotalAssigned()}</p>
                <p className="text-sm text-gray-500">von {product.current_stock || 0} Stück</p>
              </div>
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            message.includes('erfolgreich') 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            {message.includes('erfolgreich') ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <p className={message.includes('erfolgreich') ? 'text-green-800' : 'text-red-800'}>
              {message}
            </p>
          </div>
        )}

        {/* Locations Grid */}
        <div className="space-y-6">
          {Object.entries(groupedLocations).map(([zone, locs]) => (
            <div key={zone} className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-gray-500" />
                {zone}
              </h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {locs.map(location => {
                  const quantity = assignments[location.id] || 0
                  const hasQuantity = quantity > 0

                  return (
                    <div
                      key={location.id}
                      className={`
                        p-3 rounded-lg border-2 transition-all
                        ${hasQuantity 
                          ? 'bg-blue-50 border-blue-300' 
                          : 'bg-gray-50 border-gray-200'}
                      `}
                    >
                      <div className="text-center mb-2">
                        <div className="font-bold text-sm">{location.code}</div>
                        <div className="text-xs text-gray-500">{location.name}</div>
                      </div>
                      
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleQuantityChange(location.id, -10)}
                          className="p-1 hover:bg-gray-200 rounded"
                          disabled={quantity === 0}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        
                        <input
                          type="number"
                          value={quantity}
                          onChange={(e) => {
                            const newValue = parseInt(e.target.value) || 0
                            setAssignments(prev => ({
                              ...prev,
                              [location.id]: Math.max(0, newValue)
                            }))
                          }}
                          className="w-16 text-center border rounded px-1 py-0.5 text-sm"
                          min="0"
                        />
                        
                        <button
                          onClick={() => handleQuantityChange(location.id, 10)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-8 flex justify-between items-center bg-white rounded-xl shadow-sm p-6">
          <div>
            <p className="text-sm text-gray-500">Änderungen werden alle Lagerplätze für dieses Produkt überschreiben</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/products')}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={saving || getTotalAssigned() === 0}
              className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Speichern...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Zuweisungen speichern
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}