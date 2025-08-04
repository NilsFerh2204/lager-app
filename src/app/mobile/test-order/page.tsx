'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function CreateTestOrderPage() {
  const [loading, setLoading] = useState(false);

  const createTestOrder = async () => {
    setLoading(true);
    try {
      // First get some products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .limit(3);

      if (productsError || !products || products.length === 0) {
        toast.error('Keine Produkte gefunden. Bitte erst Produkte anlegen.');
        return;
      }

      console.log('Found products:', products);

      // Create a test order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: `TEST-${Date.now()}`,
          customer_name: 'Test Kunde',
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (orderError || !order) {
        console.error('Order error:', orderError);
        toast.error('Fehler beim Erstellen der Bestellung');
        return;
      }

      console.log('Created order:', order);

      // Create order items
      const orderItems = products.map((product, index) => ({
        order_id: order.id,
        product_id: product.id,
        quantity: index + 1,
        picked_quantity: 0
      }));

      console.log('Creating order items:', orderItems);

      const { data: createdItems, error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)
        .select('*');

      if (itemsError) {
        console.error('Items error:', itemsError);
        toast.error('Fehler beim Erstellen der Bestellpositionen');
        return;
      }

      console.log('Created order items:', createdItems);
      toast.success('Test-Bestellung erstellt!');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Fehler beim Erstellen');
    } finally {
      setLoading(false);
    }
  };

  const checkData = async () => {
    try {
      // Check orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .limit(5);

      console.log('Orders:', orders, ordersError);

      // Check order items with products
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          *,
          product:products(*)
        `)
        .limit(5);

      console.log('Order Items with Products:', items, itemsError);

      toast.success('Daten in der Console');
    } catch (error) {
      console.error('Check error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-2xl font-bold mb-6">Test Order Creator</h1>
      
      <div className="space-y-4">
        <button
          onClick={createTestOrder}
          disabled={loading}
          className="w-full bg-orange-600 rounded-lg py-3 font-semibold"
        >
          {loading ? 'Erstelle...' : 'Test-Bestellung erstellen'}
        </button>

        <button
          onClick={checkData}
          className="w-full bg-blue-600 rounded-lg py-3 font-semibold"
        >
          Datenbank prüfen (Console)
        </button>

        <a
          href="/mobile/picking"
          className="block w-full bg-green-600 rounded-lg py-3 font-semibold text-center"
        >
          Zur Kommissionierung
        </a>
      </div>
    </div>
  );
}