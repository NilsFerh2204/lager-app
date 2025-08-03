import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Prüfe ob User eingeloggt ist (Cookie vorhanden)
  const isAuthenticated = request.cookies.get('auth-token')
  
  // Login-Seite immer erlauben
  if (request.nextUrl.pathname === '/login') {
    // Wenn bereits eingeloggt, redirect zu Dashboard
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }
  
  // API routes für Login erlauben
  if (request.nextUrl.pathname === '/api/auth/login') {
    return NextResponse.next()
  }
  
  // Alle anderen Seiten brauchen Authentifizierung
  if (!isAuthenticated) {
    // Redirect zu Login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }
  
  return NextResponse.next()
}

// Schütze alle Seiten außer Login und public assets
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
}