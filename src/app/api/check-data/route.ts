import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Get all products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    // Get all orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    // Get all order items with different join methods
    const { data: orderItems1 } = await supabase
      .from('order_items')
      .select('*, products(*)')
      .limit(10);

    const { data: orderItems2 } = await supabase
      .from('order_items')
      .select('*, product:products!product_id(*)')
      .limit(10);

    // Get raw order items
    const { data: rawOrderItems } = await supabase
      .from('order_items')
      .select('*')
      .limit(10);

    return NextResponse.json({
      products: {
        count: products?.length || 0,
        data: products,
        error: productsError?.message
      },
      orders: {
        count: orders?.length || 0,
        data: orders,
        error: ordersError?.message
      },
      orderItems: {
        method1: orderItems1,
        method2: orderItems2,
        raw: rawOrderItems
      },
      databaseInfo: {
        timestamp: new Date().toISOString(),
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
      }
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}