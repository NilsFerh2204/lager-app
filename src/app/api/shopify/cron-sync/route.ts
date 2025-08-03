import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Vercel Cron Job Authentifizierung
    const authHeader = headers().get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // Nur von Vercel Cron oder mit richtigem Secret erlauben
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Starting automatic sync at', new Date().toISOString());

    // Produkte synchronisieren
    const syncProductsResponse = await fetch(
      `${request.nextUrl.origin}/api/shopify/sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const productsResult = await syncProductsResponse.json();

    // Optional: Bestellungen synchronisieren
    let ordersResult = null;
    try {
      const syncOrdersResponse = await fetch(
        `${request.nextUrl.origin}/api/shopify/sync-orders`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      ordersResult = await syncOrdersResponse.json();
    } catch (error) {
      console.error('Order sync failed:', error);
    }

    const timestamp = new Date().toISOString();
    
    console.log('Automatic sync completed at', timestamp);
    console.log('Products:', productsResult);
    console.log('Orders:', ordersResult);

    return NextResponse.json({
      success: true,
      timestamp,
      message: 'Automatic sync completed',
      results: {
        products: productsResult,
        orders: ordersResult
      }
    });

  } catch (error: any) {
    console.error('Cron sync error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Cron sync failed',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}