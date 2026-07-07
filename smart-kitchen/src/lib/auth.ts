/**
 * auth.ts — Lightweight household session auth.
 *
 * Design: a household shares one passcode (HOUSEHOLD_PASSCODE). Each member
 * logs in with their name + the passcode and receives a long-lived, HMAC-signed
 * session cookie. This is deliberately simple — the right weight for a
 * self-hosted family app — while still keeping the API closed to strangers.
 *
 * Tokens are signed with Web Crypto (crypto.subtle) so the SAME code runs in
 * the Edge runtime (middleware.ts) and the Node runtime (route handlers).
 * Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256 signature).
 */

export const SESSION_COOKIE = 'sk_session';
export const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export interface Session {
  uid: string;
  name: string;
  exp: number; // epoch ms
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET || 'dev-insecure-secret-change-me';
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createToken(session: Session): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify(session)));
  const key = await hmacKey();
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
  return `${payload}.${b64url(sig)}`;
}

export async function verifyToken(token: string): Promise<Session | null> {
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const key = await hmacKey();
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      b64urlDecode(sig),
      enc.encode(payload)
    );
    if (!valid) return null;
    const session = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as Session;
    if (!session.exp || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

/** Read + verify the session cookie from a request (works in Node routes). */
export async function getSession(req: Request): Promise<Session | null> {
  const cookie = req.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  return verifyToken(decodeURIComponent(match[1]));
}

/** Serialize the session cookie header value. */
export function sessionCookie(token: string, maxAgeMs = SESSION_TTL_MS): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeMs / 1000)}${secure}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
