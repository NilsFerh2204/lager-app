import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get environment variables at runtime only
    const shopDomain = process.env.SHOPIFY_STORE_DOMAIN || '';
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || '';
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-01';
    
    if (!shopDomain || !accessToken) {
      return NextResponse.json(
        { error: 'Shopify credentials missing', hasDomain: !!shopDomain, hasToken: !!accessToken },
        { status: 500 }
      );
    }

    // Dynamic import to avoid build-time execution
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build URL at runtime
    const currentYear = new Date().getFullYear();
    const startOfYear = `${currentYear}-01-01T00:00:00Z`;
    const ordersUrl = `https://${shopDomain}/admin/api/${apiVersion}/orders.json?status=any&fulfillment_status=unfulfilled&created_at_min=${startOfYear}&limit=250`;
    
    const response = await fetch(ordersUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Shopify API error: ${response.status}`, details: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();
    const orders = data.orders || [];

    // Sync to database
    let syncedCount = 0;
    
    for (const order of orders) {
      try {
        const { error } = await supabase
          .from('orders')
          .upsert({
            shopify_id: String(order.id),
            order_number: String(order.order_number || order.name),
            email: order.email || '',
            status: order.financial_status || 'pending',
            fulfillment_status: order.fulfillment_status || 'unfulfilled',
            total_price: parseFloat(order.total_price || '0'),
            currency: order.currency || 'EUR',
            customer_name: order.customer ? 
              `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : 
              'Guest',
            shopify_created_at: order.created_at,
            shopify_updated_at: order.updated_at,
          }, {
            onConflict: 'shopify_id'
          });

        if (!error) {
          syncedCount++;
        }
      } catch (error) {
        console.error('Error syncing order:', error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${syncedCount} von ${orders.length} Bestellungen synchronisiert`,
      total: orders.length,
      synced: syncedCount
    });

  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Sync failed', stack: error.stack },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'ready',
    endpoint: 'sync-orders',
    method: 'POST'
  });
}
