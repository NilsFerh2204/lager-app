import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const shopDomain = process.env.SHOPIFY_STORE_DOMAIN;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-01';

    // Check environment variables
    const envCheck = {
      hasDomain: !!shopDomain,
      hasToken: !!accessToken,
      domain: shopDomain || 'NOT SET',
      apiVersion: apiVersion,
      tokenLength: accessToken ? accessToken.length : 0
    };

    if (!shopDomain || !accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Missing Shopify credentials',
        environment: envCheck
      });
    }

    // Test 1: Shop Info
    const shopUrl = `https://${shopDomain}/admin/api/${apiVersion}/shop.json`;
    console.log('Testing shop URL:', shopUrl);
    
    const shopResponse = await fetch(shopUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!shopResponse.ok) {
      const errorText = await shopResponse.text();
      return NextResponse.json({
        success: false,
        error: `Shop API failed: ${shopResponse.status}`,
        details: errorText,
        environment: envCheck
      });
    }

    const shopData = await shopResponse.json();

    // Test 2: Products Count
    const productsUrl = `https://${shopDomain}/admin/api/${apiVersion}/products/count.json`;
    const countResponse = await fetch(productsUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    let productCount = 0;
    if (countResponse.ok) {
      const countData = await countResponse.json();
      productCount = countData.count;
    }

    // Test 3: Sample Product
    const sampleUrl = `https://${shopDomain}/admin/api/${apiVersion}/products.json?limit=1`;
    const sampleResponse = await fetch(sampleUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    let sampleProduct = null;
    if (sampleResponse.ok) {
      const sampleData = await sampleResponse.json();
      sampleProduct = sampleData.products?.[0];
    }

    return NextResponse.json({
      success: true,
      message: 'Shopify connection successful',
      shop: {
        name: shopData.shop.name,
        email: shopData.shop.email,
        domain: shopData.shop.domain,
        currency: shopData.shop.currency,
        productCount: productCount
      },
      sampleProduct: sampleProduct ? {
        title: sampleProduct.title,
        sku: sampleProduct.variants?.[0]?.sku,
        price: sampleProduct.variants?.[0]?.price,
        inventory: sampleProduct.variants?.[0]?.inventory_quantity
      } : null,
      environment: envCheck
    });

  } catch (error: any) {
    console.error('Test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}