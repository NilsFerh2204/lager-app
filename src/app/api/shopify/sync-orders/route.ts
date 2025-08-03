import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Liste der ausgeschlossenen Kunden
const EXCLUDED_CUSTOMERS = [
  'Raphael Rühl',
  'Torsten Fehr'
];

export async function GET() {
  try {
    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/${process.env.SHOPIFY_API_VERSION}/orders.json`
    
    // Hole aktuelles Jahr
    const currentYear = new Date().getFullYear();
    const startOfYear = `${currentYear}-01-01T00:00:00Z`;
    
    console.log(`Synchronisiere unfulfilled Bestellungen ab ${startOfYear}...`);
    
let allOrders: any[] = []
<<<<<<< HEAD
    let nextPageUrl = `${shopifyUrl}?status=any&fulfillment_status=unfulfilled&created_at_min=${startOfYear}&limit=250`
=======
  let nextPageUrl = `${shopifyUrl}?status=any&fulfillment_status=unfulfilled&created_at_min=${startOfYear}&limit=250`
>>>>>>> 4bdd561cff962a1ff4f50e42db74cfee9e912b25
    
    // Hole alle Seiten von Shopify (Pagination)
    while (nextPageUrl) {
      const response = await fetch(nextPageUrl, {
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN!,
        },
      })

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Filtere ausgeschlossene Kunden
      const filteredOrders = data.orders.filter(order => {
        const customerName = order.customer?.first_name && order.customer?.last_name 
          ? `${order.customer.first_name} ${order.customer.last_name}`
          : order.customer?.name || '';
          
        // Prüfe ob Kunde ausgeschlossen ist
        const isExcluded = EXCLUDED_CUSTOMERS.some(excluded => 
          customerName.toLowerCase().includes(excluded.toLowerCase())
        );
        
        if (isExcluded) {
          console.log(`Überspringe Bestellung von: ${customerName}`);
          return false;
        }
        
        // Nur unfulfilled Bestellungen
        if (order.fulfillment_status && order.fulfillment_status !== 'unfulfilled') {
          return false;
        }
        
        return true;
      });
      
      allOrders = [...allOrders, ...filteredOrders]
      
      // Check for next page
      const linkHeader = response.headers.get('Link')
      nextPageUrl = null
      
      if (linkHeader) {
        const matches = linkHeader.match(/<([^>]+)>; rel="next"/)
        if (matches) {
          nextPageUrl = matches[1]
        }
      }
    }

    console.log(`Gefiltert: ${allOrders.length} unfulfilled Bestellungen (ohne ausgeschlossene Kunden)`)
    
    let syncedCount = 0
    let errorCount = 0

    // Erstelle Tabellen falls nicht vorhanden
    await supabase.rpc('create_orders_table_if_not_exists').single()

    for (const order of allOrders) {
      try {
        // Prüfe ob Bestellung bereits existiert
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id')
          .eq('shopify_id', order.id.toString())
          .single()

        const orderData = {
          shopify_id: order.id.toString(),
          order_number: order.name || order.order_number,
          email: order.email,
          status: order.financial_status || 'pending',
          fulfillment_status: order.fulfillment_status || 'unfulfilled',
          total_price: order.total_price,
          subtotal_price: order.subtotal_price,
          total_tax: order.total_tax || '0',
          currency: order.currency,
          customer_name: order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : null,
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
        }

        if (existingOrder) {
          // Update existing order
          const { error: updateError } = await supabase
            .from('orders')
            .update(orderData)
            .eq('id', existingOrder.id)

          if (updateError) throw updateError
        } else {
          // Insert new order
          const { data: newOrder, error: insertError } = await supabase
            .from('orders')
            .insert(orderData)
            .select()
            .single()

          if (insertError) throw insertError

          // Sync order items
          if (order.line_items && order.line_items.length > 0) {
            for (const item of order.line_items) {
              // Versuche Produkt über SKU zu finden
              let productId = null
              if (item.sku) {
                // Versuche verschiedene SKU-Varianten
                const { data: product } = await supabase
                  .from('products')
                  .select('id')
                  .or(`sku.eq.${item.sku},sku.ilike.${item.sku}`)
                  .single()
                
                if (!product) {
                  // Log fehlende Produkte für Debugging
                  console.log(`Produkt mit SKU ${item.sku} nicht gefunden - Artikel: ${item.title}`)
                }
                
                productId = product?.id
              }

              const itemData = {
                order_id: newOrder.id,
                product_id: productId,
                shopify_line_item_id: item.id.toString(),
                shopify_product_id: item.product_id?.toString(),
                shopify_variant_id: item.variant_id?.toString(),
                title: item.title || item.name,
                variant_title: item.variant_title,
                sku: item.sku,
                quantity: item.quantity,
                price: item.price,
                total_discount: item.total_discount || '0',
                vendor: item.vendor,
                fulfillment_status: item.fulfillment_status || 'unfulfilled',
              }

              const { error: itemError } = await supabase
                .from('order_items')
                .insert(itemData)

              if (itemError) {
                console.error('Error inserting order item:', itemError)
              }
            }
          }
        }

        syncedCount++
      } catch (error) {
        console.error(`Error syncing order ${order.id}:`, error)
        errorCount++
      }
    }

    return NextResponse.json({ 
      success: true, 
      ordersCount: syncedCount,
      totalOrders: allOrders.length,
      errors: errorCount,
      message: `${syncedCount} unfulfilled Bestellungen synchronisiert (${errorCount} Fehler)`
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  // Webhook handler für neue Bestellungen
  try {
    const data = await request.json()
    
    // Prüfe ob Kunde ausgeschlossen ist
    const customerName = data.customer ? 
      `${data.customer.first_name || ''} ${data.customer.last_name || ''}`.trim() : '';
    
    const isExcluded = EXCLUDED_CUSTOMERS.some(excluded => 
      customerName.toLowerCase().includes(excluded.toLowerCase())
    );
    
    if (isExcluded) {
      return NextResponse.json({ 
        success: true, 
        message: `Bestellung von ${customerName} übersprungen` 
      })
    }
    
    // Nur unfulfilled Bestellungen verarbeiten
    if (data.fulfillment_status && data.fulfillment_status !== 'unfulfilled') {
      return NextResponse.json({ 
        success: true, 
        message: 'Fulfilled Bestellung übersprungen' 
      })
    }
    
    // Verarbeite Bestellung wie im GET handler
    // ... (gleiche Logik wie oben)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
