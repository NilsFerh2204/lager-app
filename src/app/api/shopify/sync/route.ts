import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  console.log('Starting Shopify sync...');
  
  try {
    const shopDomain = process.env.SHOPIFY_STORE_DOMAIN;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-01';

    console.log('Shop Domain:', shopDomain);
    console.log('API Version:', apiVersion);
    console.log('Access Token exists:', !!accessToken);

    if (!shopDomain || !accessToken) {
      console.error('Missing Shopify credentials');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Shopify credentials not configured',
          details: {
            hasDomain: !!shopDomain,
            hasToken: !!accessToken
          }
        },
        { status: 500 }
      );
    }

    // Test Shopify connection first
    const testUrl = `https://${shopDomain}/admin/api/${apiVersion}/shop.json`;
    console.log('Testing connection to:', testUrl);
    
    const testResponse = await fetch(testUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!testResponse.ok) {
      console.error('Shopify connection test failed:', testResponse.status);
      const errorText = await testResponse.text();
      console.error('Error response:', errorText);
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Shopify connection failed: ${testResponse.status}`,
          details: errorText
        },
        { status: 500 }
      );
    }

    console.log('Shopify connection successful');

    // Fetch all products with pagination
    let allProducts: any[] = [];
    let nextPageUrl = `https://${shopDomain}/admin/api/${apiVersion}/products.json?limit=250`;
    let pageCount = 0;

    while (nextPageUrl && pageCount < 20) { // Safety limit
      pageCount++;
      console.log(`Fetching page ${pageCount}...`);
      
      const response = await fetch(nextPageUrl, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch products page ${pageCount}:`, response.status);
        break;
      }

      const data = await response.json();
      const products = data.products || [];
      allProducts = [...allProducts, ...products];
      
      console.log(`Page ${pageCount}: ${products.length} products. Total: ${allProducts.length}`);

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

    console.log(`Total products fetched: ${allProducts.length}`);

    // Collect all inventory item IDs
    const inventoryItemIds: number[] = [];
    allProducts.forEach(product => {
      product.variants?.forEach((variant: any) => {
        if (variant.inventory_item_id) {
          inventoryItemIds.push(variant.inventory_item_id);
        }
      });
    });

    console.log(`Total inventory items to fetch: ${inventoryItemIds.length}`);

    // Fetch inventory levels in batches
    const inventoryMap = new Map<number, number>();
    const batchSize = 50;
    
    for (let i = 0; i < inventoryItemIds.length; i += batchSize) {
      const batch = inventoryItemIds.slice(i, i + batchSize);
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
        console.error('Error fetching inventory batch:', error);
      }
    }

    console.log(`Inventory levels fetched for ${inventoryMap.size} items`);

    // Update database
    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const product of allProducts) {
      for (const variant of (product.variants || [])) {
        try {
          // Get current stock from inventory levels
          const currentStock = inventoryMap.get(variant.inventory_item_id) || variant.inventory_quantity || 0;
          
          // Get main image
          const imageUrl = product.images?.[0]?.src || product.image?.src || null;
          
          const productData = {
            shopify_id: product.id.toString(),
            shopify_variant_id: variant.id.toString(),
            shopify_handle: product.handle,
            sku: variant.sku || `${product.id}-${variant.id}`,
            barcode: variant.barcode,
            name: variant.title === 'Default Title' ? product.title : `${product.title} - ${variant.title}`,
            description: product.body_html?.replace(/<[^>]*>/g, '').substring(0, 500) || null,
            price: parseFloat(variant.price) || 0,
            current_stock: currentStock,
            min_stock: 5,
            unit: 'Stück',
            category: product.product_type || 'Feuerwerk',
            vendor: product.vendor || 'Lichtenrader',
            tags: product.tags || '',
            image_url: imageUrl,
            updated_at: new Date().toISOString(),
          };

          // Check if product exists by SKU or variant ID
          const { data: existing } = await supabase
            .from('products')
            .select('id')
            .or(`shopify_variant_id.eq.${variant.id},sku.eq.${productData.sku}`)
            .single();

          if (existing) {
            const { error: updateError } = await supabase
              .from('products')
              .update(productData)
              .eq('id', existing.id);
              
            if (updateError) {
              console.error(`Update error for ${variant.sku}:`, updateError);
              errors++;
            } else {
              updated++;
            }
          } else {
            const { error: insertError } = await supabase
              .from('products')
              .insert([productData]);
              
            if (insertError) {
              console.error(`Insert error for ${variant.sku}:`, insertError);
              errors++;
            } else {
              created++;
            }
          }

          // Log progress every 50 items
          if ((created + updated) % 50 === 0) {
            console.log(`Progress: ${created} created, ${updated} updated, ${errors} errors`);
          }
        } catch (error) {
          console.error(`Error processing variant ${variant.id}:`, error);
          errors++;
        }
      }
    }

    const summary = {
      success: true,
      message: `Sync abgeschlossen: ${created} erstellt, ${updated} aktualisiert, ${errors} Fehler`,
      results: {
        totalProducts: allProducts.length,
        created,
        updated,
        errors,
        inventoryItemsProcessed: inventoryMap.size
      }
    };

    console.log('Sync completed:', summary);
    return NextResponse.json(summary);

  } catch (error: any) {
    console.error('Sync failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Synchronisation fehlgeschlagen',
        stack: error.stack
      },
      { status: 500 }
    );
  }
}