import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Ausgeschlossene Kunden
const EXCLUDED_CUSTOMERS = [
  'Raphael Rühl',
  'Torsten Fehr'
];

export async function POST(request: NextRequest) {
  try {
    // Environment variables zur Laufzeit abrufen
    const shopDomain = process.env.SHOPIFY_STORE_DOMAIN;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-01';
    
    // Supabase client zur Laufzeit erstellen
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase-Konfiguration fehlt' },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!shopDomain || !accessToken) {
      return NextResponse.json(
        { error: 'Shopify-Konfiguration fehlt' },
        { status: 500 }
      );
    }

    // Nur Bestellungen aus dem aktuellen Jahr
    const currentYear = new Date().getFullYear();
    const startOfYear = `${currentYear}-01-01T00:00:00Z`;
    
    console.log(`Synchronisiere unfulfilled Bestellungen ab ${startOfYear}...`);
    
    let allOrders: any[] = [];
    
    // Konstruiere die URLs zur Laufzeit
    const baseUrl = `https://${shopDomain}/admin/api/${apiVersion}`;
    const ordersEndpoint = `${baseUrl}/orders.json`;
    let nextPageUrl = `${ordersEndpoint}?status=any&fulfillment_status=unfulfilled&created_at_min=${startOfYear}&limit=250`;
    
    // Hole alle Seiten von Shopify (Pagination)
    let pageCount = 0;
    while (nextPageUrl && pageCount < 20) { // Sicherheitslimit
      pageCount++;
      
      const response = await fetch(nextPageUrl, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Shopify API error:', response.status, errorText);
        throw new Error(`Shopify API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Filtere ausgeschlossene Kunden
      const filteredOrders = (data.orders || []).filter((order: any) => {
        const customerName = order.customer?.first_name && order.customer?.last_name 
          ? `${order.customer.first_name} ${order.customer.last_name}`
          : order.customer?.name || '';
        
        return !EXCLUDED_CUSTOMERS.some(excluded => 
          customerName.toLowerCase().includes(excluded.toLowerCase())
        );
      });
      
      allOrders = [...allOrders, ...filteredOrders];
      
      console.log(`Page ${pageCount}: ${data.orders?.length || 0} orders, ${filteredOrders.length} after filtering. Total: ${allOrders.length}`);
      
      // Check for next page
      const linkHeader = response.headers.get('Link');
      nextPageUrl = '';
      
      if (linkHeader) {
        const matches = linkHeader.match(/<([^>]+)>; rel="next"/);
        if (matches && matches[1]) {
          nextPageUrl = matches[1];
        }
      }
    }

    console.log(`Total unfulfilled orders to sync: ${allOrders.length}`);
    
    // Erstelle orders Tabelle wenn nicht vorhanden (falls RPC existiert)
    try {
      await supabase.rpc('create_orders_table_if_not_exists').single();
    } catch (e) {
      console.log('RPC not available or table already exists');
    }
    
    let syncedCount = 0;
    let errorCount = 0;
    
    // Verarbeite jede Bestellung
    for (const order of allOrders) {
      try {
        // Prepare order data
        const orderData = {
          shopify_id: order.id?.toString() || '',
          order_number: order.order_number?.toString() || order.name || '',
          email: order.email || '',
          status: order.financial_status || 'pending',
          fulfillment_status: order.fulfillment_status || 'unfulfilled',
          total_price: parseFloat(order.total_price || '0'),
          subtotal_price: parseFloat(order.subtotal_price || '0'),
          total_tax: parseFloat(order.total_tax || '0'),
          currency: order.currency || 'EUR',
          customer_name: order.customer ? 
            `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() || 'Gast' : 
            'Gast',
          customer_email: order.customer?.email || order.email || '',
          customer_phone: order.customer?.phone || order.phone || '',
          shipping_name: order.shipping_address?.name || '',
          shipping_address1: order.shipping_address?.address1 || '',
          shipping_address2: order.shipping_address?.address2 || '',
          shipping_city: order.shipping_address?.city || '',
          shipping_province: order.shipping_address?.province || '',
          shipping_country: order.shipping_address?.country || '',
          shipping_zip: order.shipping_address?.zip || '',
          shipping_phone: order.shipping_address?.phone || '',
          note: order.note || '',
          tags: order.tags || '',
          shopify_created_at: order.created_at,
          shopify_updated_at: order.updated_at,
        };

        // Upsert order
        const { error: orderError, data: upsertedOrder } = await supabase
          .from('orders')
          .upsert(orderData, {
            onConflict: 'shopify_id'
          })
          .select()
          .single();

        if (orderError) {
          console.error('Error upserting order:', order.order_number, orderError);
          errorCount++;
          continue;
        }

        if (upsertedOrder && order.line_items) {
          // Delete existing order items
          await supabase
            .from('order_items')
            .delete()
            .eq('order_id', upsertedOrder.id);

          // Insert order items
          for (const item of order.line_items) {
            // Try to find matching product by SKU
            let productId = null;
            if (item.sku) {
              const { data: product } = await supabase
                .from('products')
                .select('id')
                .eq('sku', item.sku)
                .single();
              
              if (product) {
                productId = product.id;
              }
            }

            const itemData = {
              order_id: upsertedOrder.id,
              product_id: productId,
              shopify_line_item_id: item.id?.toString() || '',
              shopify_product_id: item.product_id?.toString() || '',
              shopify_variant_id: item.variant_id?.toString() || '',
              title: item.title || '',
              variant_title: item.variant_title || '',
              sku: item.sku || '',
              quantity: item.quantity || 1,
              price: parseFloat(item.price || '0'),
              total_discount: parseFloat(item.total_discount || '0'),
              vendor: item.vendor || '',
              fulfillment_status: item.fulfillment_status || 'unfulfilled'
            };

            const { error: itemError } = await supabase
              .from('order_items')
              .insert(itemData);

            if (itemError) {
              console.error('Error inserting order item:', itemError);
            }
          }
        }

        syncedCount++;
        
        // Log progress
        if (syncedCount % 10 === 0) {
          console.log(`Progress: ${syncedCount}/${allOrders.length} orders synced`);
        }
      } catch (error) {
        console.error('Error syncing order:', order.order_number, error);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `${syncedCount} unfulfilled Bestellungen synchronisiert (${errorCount} Fehler)`,
      details: {
        total: allOrders.length,
        synced: syncedCount,
        errors: errorCount,
        excluded: EXCLUDED_CUSTOMERS
      }
    });

  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Synchronisation fehlgeschlagen',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}

// Exportiere auch GET für Health Check
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Sync orders endpoint is ready',
    timestamp: new Date().toISOString()
  });
}
