import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client für Browser
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server Client Funktion für API Routes
export const getSupabaseClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey);
};

// Admin Client für Server-seitige Operationen
export const getSupabaseAdmin = () => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseServiceKey) {
    return createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabase;
};

// Types
export type Database = {
  public: {
    Tables: {
      products: {
        Row: {
          id: string;
          shopify_id: string | null;
          name: string;
          sku: string;
          current_stock: number;
          minimum_stock: number;
          storage_location: string | null;
          last_sync: string | null;
          last_inventory_update: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
      };
    };
  };
};