import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Mobile routes should always be accessible
  if (pathname.startsWith('/mobile')) {
    return NextResponse.next();
  }
  
  // Public routes that don't need authentication
  const publicRoutes = ['/', '/login', '/api/auth/login'];
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }
  
  // Check if user is authenticated
  const isAuthenticated = request.cookies.get('auth-token');
  
  // Login page
  if (pathname === '/login') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/(desktop)/dashboard', request.url));
    }
    return NextResponse.next();
  }
  
  // Protected desktop routes
  if (pathname.startsWith('/(desktop)') || pathname.startsWith('/dashboard')) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};