'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function TestDB() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    console.log('Testing Supabase connection...');
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    
    try {
      // Test 1: Simple select
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, total_price')
        .limit(10);

      console.log('Query result:', { data, error });

      if (error) {
        setError(error.message);
        console.error('Supabase error:', error);
      } else {
        setOrders(data || []);
        console.log(`Success! Found ${data?.length} orders`);
      }
    } catch (err) {
      console.error('Catch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Database Connection Test</h1>
      
      {error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Error:</strong> {error}
        </div>
      ) : (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <strong>Success!</strong> Connected to database
        </div>
      )}

      <div className="mt-4">
        <h2 className="text-xl font-semibold mb-2">Orders from Database:</h2>
        <div className="bg-gray-50 p-4 rounded">
          <p className="mb-2">Found {orders.length} orders</p>
          
          {orders.length > 0 && (
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Order #</th>
                  <th className="text-left py-2">Customer</th>
                  <th className="text-left py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b">
                    <td className="py-2">{order.order_number}</td>
                    <td className="py-2">{order.customer_name}</td>
                    <td className="py-2">€{order.total_price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mt-4">
        <button 
          onClick={testConnection}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Test Again
        </button>
      </div>

      <div className="mt-4 p-4 bg-gray-100 rounded">
        <h3 className="font-semibold mb-2">Debug Info:</h3>
        <pre className="text-xs">
          {JSON.stringify({
            NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...',
            ordersCount: orders.length,
            hasError: !!error
          }, null, 2)}
        </pre>
      </div>
    </div>
  );
}