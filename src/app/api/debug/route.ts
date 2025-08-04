import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Test order items with products
    const { data: testData, error } = await supabase
      .from('order_items')
      .select(`
        *,
        product:products(*)
      `)
      .limit(5);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also test orders structure
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .limit(1);

    return NextResponse.json({
      order_items: testData,
      orders: ordersData,
      error: ordersError?.message
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}