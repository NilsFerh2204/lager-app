import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Ausgeschlossene Kunden
const EXCLUDED_CUSTOMERS = [
  'Raphael Rühl',
  'Torsten Fehr'
];

export async function POST(request: NextRequest) {
  try {
    const shopDomain = process.env.SHOPIFY_STORE_DOMAIN;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-01';

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
    
    let allOrders: any[] = []
    const shopifyUrl = `https://${shopDomain}/admin/api/${apiVersion}/orders.json`;
    let nextPageUrl = `${shopifyUrl}?status=any&fulfillment_status=unfulfilled&created_at_min=${startOfYear}&limit=250`
    
    // Hole alle Seiten von Shopify (Pagination)
    while (nextPageUrl) {
      const response = await fetch(nextPageUrl, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Filtere ausgeschlossene Kunden
      const filteredOrders = data.orders.filter((order: any) => {
        const customerName = order.customer?.first_name && order.customer?.last_name 
          ? `${order.customer.first_name} ${order.customer.last_name}`
          : order.customer?.name || '';
        
        return !EXCLUDED_CUSTOMERS.some(excluded => 
          customerName.toLowerCase().includes(excluded.toLowerCase())
        );
      });
      
      allOrders = [...allOrders, ...filteredOrders];
      
      console.log(`Fetched ${data.orders.length} orders, ${filteredOrders.length} after filtering. Total: ${allOrders.length}`);
      
      // Check for next page
      const linkHeader = response.headers.get('Link');
      nextPageUrl = '';
      
      if (linkHeader) {
        const matches = linkHeader.match(/<([^>]+)>; rel="next"/);
        if (matches) {
          nextPageUrl = matches[1];
        }
      }
    }

    console.log(`Total unfulfilled orders to sync: ${allOrders.length}`);
    
    // Erstelle orders Tabelle wenn nicht vorhanden
    await supabase.rpc('create_orders_table_if_not_exists').single();
    
    let syncedCount = 0;
    let errorCount = 0;
    
    // Verarbeite jede Bestellung
    for (const order of allOrders) {
      try {
        // Upsert order
        const { error: orderError } = await supabase
          .from('orders')
          .upsert({
            shopify_id: order.id.toString(),
            order_number: order.order_number.toString(),
            email: order.email,
            status: order.financial_status,
            fulfillment_status: order.fulfillment_status || 'unfulfilled',
            total_price: parseFloat(order.total_price || '0'),
            subtotal_price: parseFloat(order.subtotal_price || '0'),
            total_tax: parseFloat(order.total_tax || '0'),
            currency: order.currency,
            customer_name: order.customer ? 
              `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : 
              'Gast',
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
          }, {
            onConflict: 'shopify_id'
          });

        if (orderError) {
          console.error('Error upserting order:', orderError);
          errorCount++;
          continue;
        }

        // Get the order ID from our database
        const { data: dbOrder } = await supabase
          .from('orders')
          .select('id')
          .eq('shopify_id', order.id.toString())
          .single();

        if (dbOrder) {
          // Delete existing order items
          await supabase
            .from('order_items')
            .delete()
            .eq('order_id', dbOrder.id);

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

            await supabase
              .from('order_items')
              .insert({
                order_id: dbOrder.id,
                product_id: productId,
                shopify_line_item_id: item.id.toString(),
                shopify_product_id: item.product_id?.toString(),
                shopify_variant_id: item.variant_id?.toString(),
                title: item.title,
                variant_title: item.variant_title,
                sku: item.sku,
                quantity: item.quantity,
                price: parseFloat(item.price || '0'),
                total_discount: parseFloat(item.total_discount || '0'),
                vendor: item.vendor,
                fulfillment_status: item.fulfillment_status || 'unfulfilled'
              });
          }
        }

        syncedCount++;
      } catch (error) {
        console.error('Error syncing order:', error);
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
      { error: error.message || 'Synchronisation fehlgeschlagen' },
      { status: 500 }
    );
  }
}