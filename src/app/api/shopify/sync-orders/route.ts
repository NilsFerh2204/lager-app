import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get environment variables at runtime
    const shopDomain = process.env.SHOPIFY_STORE_DOMAIN || '';
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || '';
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-01';
    
    if (!shopDomain || !accessToken) {
      return NextResponse.json(
        { success: false, error: 'Shopify credentials missing' },
        { status: 500 }
      );
    }

    // Dynamic import Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { success: false, error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Zeitraum für Bestellungen (letzte 90 Tage)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const startDate = ninetyDaysAgo.toISOString();
    
    console.log(`Synchronisiere Bestellungen ab ${startDate}...`);
    
    // Alle Bestellungen mit Pagination holen
    let allOrders: any[] = [];
    let nextPageUrl: string | null = `https://${shopDomain}/admin/api/${apiVersion}/orders.json?status=any&created_at_min=${startDate}&limit=250`;
    let pageCount = 0;
    
    while (nextPageUrl && pageCount < 20) { // Max 20 Seiten (5000 Bestellungen)
      pageCount++;
      console.log(`Fetching page ${pageCount}...`);
      
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
      allOrders = [...allOrders, ...(data.orders || [])];
      
      // Check for next page
      const linkHeader = response.headers.get('Link');
      nextPageUrl = null;
      
      if (linkHeader) {
        const matches = linkHeader.match(/<([^>]+)>; rel="next"/);
        if (matches && matches[1]) {
          nextPageUrl = matches[1];
        }
      }
    }

    console.log(`Total orders fetched: ${allOrders.length}`);

    // Bestellungen in Datenbank speichern
    let syncedCount = 0;
    let errorCount = 0;
    let itemsSynced = 0;
    
    for (const order of allOrders) {
      try {
        // Order Hauptdaten
        const orderData = {
          shopify_id: String(order.id),
          order_number: String(order.order_number || order.name),
          email: order.email || '',
          status: order.financial_status || 'pending',
          fulfillment_status: order.fulfillment_status || 'unfulfilled',
          financial_status: order.financial_status || 'pending',
          total_price: parseFloat(order.total_price || '0'),
          subtotal_price: parseFloat(order.subtotal_price || '0'),
          total_tax: parseFloat(order.total_tax || '0'),
          currency: order.currency || 'EUR',
          customer_name: order.customer ? 
            `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() || 
            order.customer.name || 'Gast' : 'Gast',
          customer_email: order.customer?.email || order.email,
          customer_phone: order.customer?.phone || order.phone,
          shipping_name: order.shipping_address?.name,
          shipping_address1: order.shipping_address?.address1,
          shipping_address2: order.shipping_address?.address2,
          shipping_city: order.shipping_address?.city,
          shipping_province: order.shipping_address?.province,
          shipping_country: order.shipping_address?.country,
          shipping_zip: order.shipping_address?.zip,
          shipping_phone: order.shipping_address?.phone,
          note: order.note,
          tags: order.tags,
          shopify_created_at: order.created_at,
          shopify_updated_at: order.updated_at,
          updated_at: new Date().toISOString()
        };

        // Upsert Order
        const { data: upsertedOrder, error: orderError } = await supabase
          .from('orders')
          .upsert(orderData, {
            onConflict: 'shopify_id'
          })
          .select()
          .single();

        if (orderError) {
          console.error('Error upserting order:', orderError);
          errorCount++;
          continue;
        }

        // Order Items synchronisieren
        if (upsertedOrder && order.line_items) {
          // Alte Items löschen
          await supabase
            .from('order_items')
            .delete()
            .eq('order_id', upsertedOrder.id);

          // Neue Items einfügen
          for (const item of order.line_items) {
            try {
              // Versuche Produkt über SKU zu finden
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
                shopify_line_item_id: String(item.id),
                shopify_product_id: item.product_id ? String(item.product_id) : null,
                shopify_variant_id: item.variant_id ? String(item.variant_id) : null,
                title: item.title || '',
                variant_title: item.variant_title,
                sku: item.sku || '',
                quantity: item.quantity || 1,
                price: parseFloat(item.price || '0'),
                total_discount: parseFloat(item.total_discount || '0'),
                vendor: item.vendor,
                fulfillment_status: item.fulfillment_status || 'unfulfilled',
                requires_shipping: item.requires_shipping !== false
              };

              const { error: itemError } = await supabase
                .from('order_items')
                .insert(itemData);

              if (!itemError) {
                itemsSynced++;
              } else {
                console.error('Error inserting order item:', itemError);
              }
            } catch (itemError) {
              console.error('Error processing order item:', itemError);
            }
          }
        }

        syncedCount++;
      } catch (error) {
        console.error('Error syncing order:', error);
        errorCount++;
      }
    }

    // Statistiken berechnen
    const { count: totalOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    const { count: unfulfilledOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('fulfillment_status', 'unfulfilled');

    const message = `Synchronisation abgeschlossen: ${syncedCount} Bestellungen synchronisiert, ${itemsSynced} Artikel verarbeitet`;
    console.log(message);

    return NextResponse.json({
      success: true,
      message,
      results: {
        ordersProcessed: allOrders.length,
        ordersSynced: syncedCount,
        itemsSynced,
        errors: errorCount,
        totalOrders,
        unfulfilledOrders,
        dateRange: {
          from: startDate,
          to: new Date().toISOString()
        }
      }
    });

  } catch (error: any) {
    console.error('Orders sync error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Orders sync failed',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'ready',
    endpoint: '/api/shopify/sync-orders',
    method: 'POST',
    description: 'Synchronisiert Bestellungen der letzten 90 Tage von Shopify'
  });
}