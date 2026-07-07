/**
 * middleware.ts — Session gate for the whole app.
 *
 * Every page and API route requires a valid household session cookie, except:
 *   - /login and /api/auth/* (the way in)
 *   - PWA + static assets (/_next, /icons, /sw.js, /manifest.json,
 *     /offline.html, favicon) so the service worker can always install and
 *     serve the offline shell.
 *
 * Unauthenticated API calls get a 401 JSON body; page navigations redirect to
 * /login. Offline usage is unaffected: the service worker serves cached pages
 * without hitting this middleware, and the 90-day cookie means a shopper's
 * queued mutations still sync when connectivity returns.
 */
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifyToken } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;

  if (session) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized — sign in first' }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/((?!login|api/auth|_next|icons|sw\\.js|manifest\\.json|offline\\.html|favicon\\.ico).*)',
  ],
};
