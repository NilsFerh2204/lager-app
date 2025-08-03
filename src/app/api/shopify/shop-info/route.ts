import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const shopDomain = process.env.SHOPIFY_STORE_DOMAIN;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-01';

    if (!shopDomain || !accessToken) {
      return NextResponse.json(
        { error: 'Shopify credentials not configured' },
        { status: 500 }
      );
    }

    const url = `https://${shopDomain}/admin/api/${apiVersion}/shop.json`;
    
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Shop info error: ${response.status}`);
    }

    const data = await response.json();
    const shop = data.shop;

    // Vereinfachte Shop-Info zurückgeben
    return NextResponse.json({
      name: shop.name,
      email: shop.email,
      domain: shop.domain,
      currency: shop.currency,
      shop_owner: shop.shop_owner,
      phone: shop.phone,
      address1: shop.address1,
      city: shop.city,
      zip: shop.zip,
      country: shop.country,
      image: shop.image || null, // Shop-Logo falls vorhanden
    });
  } catch (error: any) {
    console.error('Error fetching shop info:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch shop info' },
      { status: 500 }
    );
  }
}