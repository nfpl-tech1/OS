import { NextRequest, NextResponse } from 'next/server';


export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Let API proxy calls pass through
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const session = req.cookies.get('os_session');
  const isLoginPage = pathname === '/login';

  // 2. Auth Guard: If no session and not on login, go to login
  if (!session && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // 3. REMOVED: The session + login -> dashboard redirect.
  // This was causing the loop when the session cookie existed but was invalid at the API level.

  return NextResponse.next();
}

export const config = {
  matcher: ['/','/login','/dashboard/:path'],
};
