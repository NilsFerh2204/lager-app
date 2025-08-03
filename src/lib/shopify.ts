import { supabase } from '@/lib/supabase';

const SHOPIFY_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_SHOP_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = '2024-01';

export class ShopifyAPI {
  private domain: string;
  private token: string;

  constructor() {
    this.domain = SHOPIFY_DOMAIN || '';
    this.token = SHOPIFY_ACCESS_TOKEN || '';
  }

  async fetchFromShopify(endpoint: string) {
    const url = `https://${this.domain}/admin/api/${API_VERSION}/${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': this.token,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Shopify fetch error:', error);
      throw error;
    }
  }

  async syncProducts() {
    try {
      // Hole Produkte von Shopify
      const data = await this.fetchFromShopify('products.json?limit=250');
      const shopifyProducts = data.products;

      let created = 0;
      let updated = 0;
      let errors = 0;

      for (const product of shopifyProducts) {
        try {
          // Prüfe ob Produkt bereits existiert
          const { data: existing } = await supabase
            .from('products')
            .select('id')
            .eq('shopify_id', product.id.toString())
            .single();

          const productData = {
            shopify_id: product.id.toString(),
            sku: product.variants[0]?.sku || `SHOP-${product.id}`,
            barcode: product.variants[0]?.barcode || null,
            name: product.title,
            description: product.body_html?.replace(/<[^>]*>/g, '') || null,
            price: parseFloat(product.variants[0]?.price || '0'),
            current_stock: product.variants[0]?.inventory_quantity || 0,
            min_stock: 10, // Standard-Mindestbestand
            category: product.product_type || 'Sonstiges',
            image_url: product.image?.src || null,
            shopify_handle: product.handle,
            shopify_variant_id: product.variants[0]?.id.toString() || null,
            shopify_inventory_item_id: product.variants[0]?.inventory_item_id?.toString() || null,
            last_shopify_sync: new Date().toISOString(),
          };

          if (existing) {
            // Update
            await supabase
              .from('products')
              .update(productData)
              .eq('id', existing.id);
            updated++;
          } else {
            // Create
            await supabase
              .from('products')
              .insert(productData);
            created++;
          }
        } catch (err) {
          console.error(`Error syncing product ${product.id}:`, err);
          errors++;
        }
      }

      // Log the sync
      await supabase
        .from('shopify_sync_log')
        .insert({
          sync_type: 'manual',
          status: 'completed',
          products_created: created,
          products_updated: updated,
          products_deleted: 0,
          completed_at: new Date().toISOString(),
        });

      return { created, updated, errors };
    } catch (error) {
      console.error('Sync error:', error);
      throw error;
    }
  }
}