import { NextRequest, NextResponse } from 'next/server';

// Das Passwort
const CORRECT_PASSWORD = 'Lichtenraderfeuerwerkverkauf2025!';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    // Prüfe Passwort
    if (password === CORRECT_PASSWORD) {
      // Erstelle Response mit Cookie
      const response = NextResponse.json(
        { success: true, message: 'Login erfolgreich' },
        { status: 200 }
      );

      // Setze Auth Cookie (gültig für 7 Tage)
      response.cookies.set('auth-token', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 Tage
        path: '/',
      });

      return response;
    } else {
      return NextResponse.json(
        { success: false, message: 'Falsches Passwort' },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Fehler beim Login' },
      { status: 500 }
    );
  }
}

// Logout Endpoint
export async function DELETE(request: NextRequest) {
  const response = NextResponse.json(
    { success: true, message: 'Logout erfolgreich' },
    { status: 200 }
  );

  // Lösche Auth Cookie
  response.cookies.delete('auth-token');

  return response;
}