import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const shopDomain = process.env.SHOPIFY_STORE_DOMAIN;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-01';

    if (!shopDomain || !accessToken) {
      return NextResponse.json(
        { success: false, error: 'Shopify-Konfiguration fehlt' },
        { status: 500 }
      );
    }

    const supabase = getSupabaseClient();

    // Hole alle Produkte mit Pagination
    let allProducts: any[] = [];
    let nextPageUrl: string | null = `https://${shopDomain}/admin/api/${apiVersion}/products.json?limit=250`;
    let pageCount = 0;
    
    console.log('Starting Shopify product sync...');
    
    while (nextPageUrl && pageCount < 50) { // Sicherheitslimit
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
      allProducts = [...allProducts, ...(data.products || [])];
      
      console.log(`Page ${pageCount}: ${data.products?.length || 0} products. Total: ${allProducts.length}`);
      
      // Check for next page
      const linkHeader = response.headers.get('Link');
      nextPageUrl = null;
      
      if (linkHeader) {
        const matches = linkHeader.match(/<([^>]+)>; rel="next"/);
        if (matches?.[1]) {
          nextPageUrl = matches[1];
        }
      }
    }

    console.log(`Total products fetched: ${allProducts.length}`);

    // Hole Inventory Levels
    const inventoryItemIds: number[] = [];
    allProducts.forEach(product => {
      product.variants?.forEach((variant: any) => {
        if (variant.inventory_item_id) {
          inventoryItemIds.push(variant.inventory_item_id);
        }
      });
    });

    console.log(`Fetching inventory for ${inventoryItemIds.length} items...`);

    // Inventory in Batches holen (max 50 pro Request)
    const inventoryMap = new Map<number, number>();
    for (let i = 0; i < inventoryItemIds.length; i += 50) {
      const batch = inventoryItemIds.slice(i, i + 50);
      const ids = batch.join(',');
      const inventoryUrl = `https://${shopDomain}/admin/api/${apiVersion}/inventory_levels.json?inventory_item_ids=${ids}&limit=250`;
      
      try {
        const invResponse = await fetch(inventoryUrl, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        });

        if (invResponse.ok) {
          const invData = await invResponse.json();
          invData.inventory_levels?.forEach((level: any) => {
            const current = inventoryMap.get(level.inventory_item_id) || 0;
            inventoryMap.set(level.inventory_item_id, current + level.available);
          });
        }
      } catch (error) {
        console.error('Inventory fetch error:', error);
      }
    }

    console.log(`Inventory levels fetched for ${inventoryMap.size} items`);

    // Produkte in Datenbank speichern
    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const product of allProducts) {
      for (const variant of (product.variants || [])) {
        try {
          // Aktueller Lagerbestand aus Inventory Levels
          const currentStock = inventoryMap.get(variant.inventory_item_id) || variant.inventory_quantity || 0;
          
          // Hauptbild
          const imageUrl = product.images?.[0]?.src || product.image?.src || null;
          
          const productData = {
            shopify_id: String(product.id),
            shopify_variant_id: String(variant.id),
            shopify_handle: product.handle || '',
            sku: variant.sku || `${product.id}-${variant.id}`,
            barcode: variant.barcode || null,
            name: variant.title === 'Default Title' ? product.title : `${product.title} - ${variant.title}`,
            description: product.body_html?.replace(/<[^>]*>/g, '').substring(0, 500) || null,
            price: parseFloat(variant.price || '0'),
            current_stock: currentStock,
            min_stock: 5,
            unit: 'Stück',
            category: product.product_type || 'Feuerwerk',
            vendor: product.vendor || 'Lichtenrader',
            tags: product.tags || '',
            image_url: imageUrl,
            updated_at: new Date().toISOString(),
          };

          // Check if product exists
          const { data: existing } = await supabase
            .from('products')
            .select('id')
            .or(`shopify_variant_id.eq.${variant.id},sku.eq.${productData.sku}`)
            .single();

          if (existing) {
            const { error } = await supabase
              .from('products')
              .update(productData)
              .eq('id', existing.id);
            
            if (error) {
              console.error('Update error:', error);
              errors++;
            } else {
              updated++;
            }
          } else {
            const { error } = await supabase
              .from('products')
              .insert([productData]);
            
            if (error) {
              console.error('Insert error:', error);
              errors++;
            } else {
              created++;
            }
          }

          // Progress log
          if ((created + updated) % 50 === 0) {
            console.log(`Progress: ${created} created, ${updated} updated`);
          }
        } catch (error) {
          console.error('Error syncing variant:', variant.sku, error);
          errors++;
        }
      }
    }

    const message = `Sync abgeschlossen: ${created} erstellt, ${updated} aktualisiert, ${errors} Fehler`;
    console.log(message);

    return NextResponse.json({
      success: true,
      message,
      results: {
        totalProducts: allProducts.length,
        totalVariants: inventoryItemIds.length,
        created,
        updated,
        errors,
        inventoryItemsProcessed: inventoryMap.size
      }
    });

  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Synchronisation fehlgeschlagen',
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
    endpoint: '/api/shopify/sync',
    method: 'POST',
    description: 'Synchronisiert alle Produkte und Lagerbestände von Shopify'
  });
}
