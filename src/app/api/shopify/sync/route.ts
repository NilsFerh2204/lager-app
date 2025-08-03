import { NextRequest, NextResponse } from 'next/server';
import { ShopifyAPI } from '@/lib/shopify';

export async function POST(request: NextRequest) {
  try {
    const shopify = new ShopifyAPI();
    const results = await shopify.syncProducts();
    
    return NextResponse.json({
      success: true,
      message: `Sync abgeschlossen: ${results.created} erstellt, ${results.updated} aktualisiert`,
      results
    });
  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Synchronisation fehlgeschlagen' 
      },
      { status: 500 }
    );
  }
}