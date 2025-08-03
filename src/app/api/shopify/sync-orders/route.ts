import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-01';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  return NextResponse.json({ 
    status: 'ready',
    endpoint: '/api/shopify/sync-orders',
    method: 'POST',
    description: 'Synchronisiert Bestellungen von Shopify'
  });
}

export async function POST() {
  try {
    if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
      throw new Error('Shopify credentials missing');
    }

    console.log('Starting orders sync from Shopify...');

    // Fetch orders from Shopify (last 90 days)
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 90);
    
    const ordersUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=250&created_at_min=${sinceDate.toISOString()}`;
    
    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    if (!ordersResponse.ok) {
      const errorText = await ordersResponse.text();
      console.error('Shopify API Error:', errorText);
      throw new Error(`Shopify API error: ${ordersResponse.status}`);
    }

    const ordersData = await ordersResponse.json();
    const orders = ordersData.orders || [];

    console.log(`Fetched ${orders.length} orders from Shopify`);

    let syncedCount = 0;
    let errorCount = 0;

    // Process each order
    for (const order of orders) {
      try {
        // Prepare order data
        const orderData = {
          shopify_id: order.id.toString(),
          order_number: order.order_number?.toString() || order.name,
          email: order.email || order.contact_email,
          status: order.cancelled_at ? 'cancelled' : 'active',
          fulfillment_status: order.fulfillment_status || 'unfulfilled',
          financial_status: order.financial_status || 'pending',
          total_price: parseFloat(order.total_price || 0),
          subtotal_price: parseFloat(order.subtotal_price || 0),
          total_tax: parseFloat(order.total_tax || 0),
          currency: order.currency || 'EUR',
          customer_name: order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : 
                        order.billing_address ? `${order.billing_address.first_name || ''} ${order.billing_address.last_name || ''}`.trim() : 
                        'Unbekannt',
          customer_email: order.customer?.email || order.email || order.contact_email,
          customer_phone: order.customer?.phone || order.phone || order.billing_address?.phone,
          shipping_name: order.shipping_address ? `${order.shipping_address.first_name || ''} ${order.shipping_address.last_name || ''}`.trim() : null,
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
        };

        // Upsert order
        const { data: upsertedOrder, error: orderError } = await supabase
          .from('orders')
          .upsert(orderData, { onConflict: 'shopify_id' })
          .select()
          .single();

        if (orderError) {
          console.error(`Error upserting order ${order.order_number}:`, orderError);
          errorCount++;
          continue;
        }

        // Process line items
        if (order.line_items && order.line_items.length > 0) {
          // Delete existing line items for this order
          await supabase
            .from('order_items')
            .delete()
            .eq('order_id', upsertedOrder.id);

          // Prepare line items
          const lineItems = await Promise.all(order.line_items.map(async (item: any) => {
            // Try to find the product by SKU
            let productId = null;
            if (item.sku) {
              const { data: product } = await supabase
                .from('products')
                .select('id')
                .eq('sku', item.sku)
                .single();
              
              productId = product?.id || null;
            }

            return {
              order_id: upsertedOrder.id,
              product_id: productId,
              shopify_line_item_id: item.id?.toString(),
              shopify_product_id: item.product_id?.toString(),
              shopify_variant_id: item.variant_id?.toString(),
              title: item.title || item.name || 'Unbekanntes Produkt',
              variant_title: item.variant_title,
              sku: item.sku || '',
              quantity: parseInt(item.quantity || 1),
              price: parseFloat(item.price || 0),
              total_discount: parseFloat(item.total_discount || 0),
              vendor: item.vendor,
              fulfillment_status: item.fulfillment_status,
              requires_shipping: item.requires_shipping !== false,
            };
          }));

          // Insert line items
          const { error: itemsError } = await supabase
            .from('order_items')
            .insert(lineItems);

          if (itemsError) {
            console.error(`Error inserting line items for order ${order.order_number}:`, itemsError);
            errorCount++;
          }
        }

        syncedCount++;
      } catch (error) {
        console.error(`Error processing order ${order.order_number}:`, error);
        errorCount++;
      }
    }

    console.log(`Orders sync completed: ${syncedCount} synced, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      message: `${syncedCount} Bestellungen synchronisiert${errorCount > 0 ? `, ${errorCount} Fehler` : ''}`,
      synced: syncedCount,
      errors: errorCount,
      total: orders.length
    });

  } catch (error: any) {
    console.error('Orders sync error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Sync fehlgeschlagen',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}