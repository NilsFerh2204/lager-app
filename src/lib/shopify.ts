import { supabase } from './supabase';

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  vendor: string;
  product_type: string;
  tags: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  image?: ShopifyImage;
}

interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string;
  inventory_quantity: number;
  inventory_item_id: number;
  barcode: string | null;
}

interface ShopifyImage {
  id: number;
  src: string;
  alt: string | null;
}

interface ShopifyInventoryLevel {
  inventory_item_id: number;
  location_id: number;
  available: number;
}

export class ShopifyAPI {
  private shopDomain: string;
  private accessToken: string;
  private apiVersion: string;

  constructor() {
    this.shopDomain = process.env.SHOPIFY_STORE_DOMAIN || '';
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN || '';
    this.apiVersion = process.env.SHOPIFY_API_VERSION || '2024-01';

    if (!this.shopDomain || !this.accessToken) {
      throw new Error('Shopify credentials not configured');
    }
  }

  // Shop-Info mit Logo abrufen
  async getShopInfo() {
    const url = `https://${this.shopDomain}/admin/api/${this.apiVersion}/shop.json`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Shop info error: ${response.status}`);
      }

      const data = await response.json();
      return data.shop;
    } catch (error) {
      console.error('Error fetching shop info:', error);
      throw error;
    }
  }

  // Alle Produkte mit Pagination abrufen
  async getAllProducts(): Promise<ShopifyProduct[]> {
    let allProducts: ShopifyProduct[] = [];
    let nextPageUrl = `https://${this.shopDomain}/admin/api/${this.apiVersion}/products.json?limit=250`;
    
    console.log('Fetching all products from Shopify...');
    
    while (nextPageUrl) {
      try {
        const response = await fetch(nextPageUrl, {
          headers: {
            'X-Shopify-Access-Token': this.accessToken,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        allProducts = [...allProducts, ...data.products];
        
        console.log(`Fetched ${data.products.length} products. Total: ${allProducts.length}`);
        
        // Check for next page
        const linkHeader = response.headers.get('Link');
        nextPageUrl = '';
        
        if (linkHeader) {
          const matches = linkHeader.match(/<([^>]+)>; rel="next"/);
          if (matches) {
            nextPageUrl = matches[1];
          }
        }
      } catch (error) {
        console.error('Error fetching products:', error);
        throw error;
      }
    }
    
    console.log(`Total products fetched: ${allProducts.length}`);
    return allProducts;
  }

  // Inventory Levels für alle Produkte abrufen
  async getInventoryLevels(inventoryItemIds: number[]): Promise<Map<number, number>> {
    const inventoryMap = new Map<number, number>();
    
    // Shopify API erlaubt max 50 IDs pro Request
    const chunks = [];
    for (let i = 0; i < inventoryItemIds.length; i += 50) {
      chunks.push(inventoryItemIds.slice(i, i + 50));
    }
    
    console.log(`Fetching inventory for ${inventoryItemIds.length} items in ${chunks.length} batches...`);
    
    for (const chunk of chunks) {
      const ids = chunk.join(',');
      const url = `https://${this.shopDomain}/admin/api/${this.apiVersion}/inventory_levels.json?inventory_item_ids=${ids}&limit=250`;
      
      try {
        const response = await fetch(url, {
          headers: {
            'X-Shopify-Access-Token': this.accessToken,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error(`Inventory error for chunk: ${response.status}`);
          continue;
        }

        const data = await response.json();
        
        data.inventory_levels.forEach((level: ShopifyInventoryLevel) => {
          const current = inventoryMap.get(level.inventory_item_id) || 0;
          inventoryMap.set(level.inventory_item_id, current + level.available);
        });
      } catch (error) {
        console.error('Error fetching inventory levels:', error);
      }
    }
    
    console.log(`Inventory levels fetched for ${inventoryMap.size} items`);
    return inventoryMap;
  }

  // Produkte mit aktuellem Lagerbestand synchronisieren
  async syncProducts() {
    try {
      console.log('Starting Shopify sync...');
      
      // 1. Alle Produkte abrufen
      const products = await this.getAllProducts();
      
      // 2. Inventory Item IDs sammeln
      const inventoryItemIds: number[] = [];
      products.forEach(product => {
        product.variants.forEach(variant => {
          if (variant.inventory_item_id) {
            inventoryItemIds.push(variant.inventory_item_id);
          }
        });
      });
      
      // 3. Aktuelle Lagerbestände abrufen
      const inventoryLevels = await this.getInventoryLevels(inventoryItemIds);
      
      // 4. Produkte in Supabase aktualisieren
      let created = 0;
      let updated = 0;
      let errors = 0;
      
      for (const product of products) {
        for (const variant of product.variants) {
          try {
            // Aktuellen Lagerbestand aus Inventory Levels
            const currentStock = inventoryLevels.get(variant.inventory_item_id) || 0;
            
            // Hauptbild verwenden
            const imageUrl = product.images?.[0]?.src || product.image?.src || null;
            
            const productData = {
              shopify_id: product.id.toString(),
              shopify_variant_id: variant.id.toString(),
              shopify_handle: product.handle,
              sku: variant.sku || `${product.id}-${variant.id}`,
              barcode: variant.barcode,
              name: variant.title === 'Default Title' ? product.title : `${product.title} - ${variant.title}`,
              description: product.body_html?.replace(/<[^>]*>/g, '') || null,
              price: parseFloat(variant.price),
              current_stock: currentStock, // Aktueller Lagerbestand aus Inventory
              min_stock: 5,
              unit: 'Stück',
              category: product.product_type || 'Uncategorized',
              vendor: product.vendor,
              tags: product.tags,
              image_url: imageUrl,
              updated_at: new Date().toISOString(),
            };

            // Prüfen ob Produkt existiert
            const { data: existing } = await supabase
              .from('products')
              .select('id')
              .eq('shopify_variant_id', variant.id.toString())
              .single();

            if (existing) {
              await supabase
                .from('products')
                .update(productData)
                .eq('shopify_variant_id', variant.id.toString());
              updated++;
            } else {
              await supabase
                .from('products')
                .insert([productData]);
              created++;
            }
            
            // Progress log
            if ((created + updated) % 50 === 0) {
              console.log(`Progress: ${created + updated} products processed...`);
            }
          } catch (error) {
            console.error(`Error syncing variant ${variant.id}:`, error);
            errors++;
          }
        }
      }
      
      console.log(`Sync completed: ${created} created, ${updated} updated, ${errors} errors`);
      return { created, updated, errors, total: products.length };
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }

  // Einzelnes Produkt aktualisieren
  async updateProductInventory(variantId: string, quantity: number) {
    try {
      const url = `https://${this.shopDomain}/admin/api/${this.apiVersion}/variants/${variantId}.json`;
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variant: {
            inventory_quantity: quantity
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Update failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating inventory:', error);
      throw error;
    }
  }
}

export default ShopifyAPI;