import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Test 1: Get order items with direct join
    const { data: test1, error: error1 } = await supabase
      .from('order_items')
      .select(`
        *,
        products (*)
      `)
      .limit(5);

    // Test 2: Get order items with foreign key syntax
    const { data: test2, error: error2 } = await supabase
      .from('order_items')
      .select(`
        *,
        product:products!product_id (*)
      `)
      .limit(5);

    // Test 3: Get just the products table
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .limit(5);

    // Test 4: Manual join - get order items first, then products
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .limit(5);

    let manualJoin = [];
    if (orderItems) {
      for (const item of orderItems) {
        const { data: product } = await supabase
          .from('products')
          .select('*')
          .eq('id', item.product_id)
          .single();
        
        manualJoin.push({
          ...item,
          product
        });
      }
    }

    return NextResponse.json({
      test1: { data: test1, error: error1?.message },
      test2: { data: test2, error: error2?.message },
      products: { data: products, error: productsError?.message },
      orderItems: { data: orderItems, error: itemsError?.message },
      manualJoin
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}