// Shopify API Wrapper - Build Safe Version
export class ShopifyAPI {
  private shopDomain: string = '';
  private accessToken: string = '';
  private apiVersion: string = '';

  constructor() {
    // Environment variables werden zur LAUFZEIT geladen, nicht beim Build
    if (typeof process !== 'undefined' && process.env) {
      this.shopDomain = process.env.SHOPIFY_STORE_DOMAIN || '';
      this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN || '';
      this.apiVersion = process.env.SHOPIFY_API_VERSION || '2024-01';
    }
  }

  private getHeaders() {
    return {
      'X-Shopify-Access-Token': this.accessToken,
      'Content-Type': 'application/json',
    };
  }

  async syncProducts() {
    if (!this.shopDomain || !this.accessToken) {
      throw new Error('Shopify credentials not configured');
    }

    try {
      const url = `https://${this.shopDomain}/admin/api/${this.apiVersion}/products.json?limit=250`;
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Dynamically import Supabase
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase not configured');
      }
      
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      let created = 0;
      let updated = 0;

      for (const product of data.products || []) {
        for (const variant of product.variants || []) {
          const productData = {
            shopify_id: String(product.id),
            shopify_variant_id: String(variant.id),
            sku: variant.sku || `${product.id}-${variant.id}`,
            name: product.title,
            price: parseFloat(variant.price || '0'),
            current_stock: variant.inventory_quantity || 0,
            min_stock: 5,
            unit: 'Stück',
            category: product.product_type || 'Feuerwerk',
            updated_at: new Date().toISOString(),
          };

          const { data: existing } = await supabase
            .from('products')
            .select('id')
            .eq('shopify_variant_id', String(variant.id))
            .single();

          if (existing) {
            await supabase
              .from('products')
              .update(productData)
              .eq('id', existing.id);
            updated++;
          } else {
            await supabase
              .from('products')
              .insert([productData]);
            created++;
          }
        }
      }

      return { created, updated, total: data.products?.length || 0 };
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }
}

export default ShopifyAPI;
