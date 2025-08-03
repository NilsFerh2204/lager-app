import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://chsrszvsccovlpzyzdka.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoc3JzenZzY2Nvdmxwenl6ZGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMTk0MTksImV4cCI6MjA2OTc5NTQxOX0.TJwBaIAXoOLhlpYM1F_-2Z6nJtOVoAOzU3EhpkBc3zw';

if (!supabaseUrl) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
});

// Debug logging
console.log('Supabase initialized with URL:', supabaseUrl);