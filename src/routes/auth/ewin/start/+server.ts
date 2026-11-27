import type { RequestHandler } from './$types';

/**
 * Entry for the "Continue with E-WIN" button. Bounces to the Hub, which
 * requires an authenticated member and returns with a one-time ticket.
 */
const HUB = 'https://ewinproject.org';
const PLATFORM = 'puntersedge';

function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\') ? raw : '';
}

export const GET: RequestHandler = ({ url }) => {
  const next = safeNext(url.searchParams.get('next'));
  const callback = `${url.origin}/auth/ewin/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`;
  const target = `${HUB}/api/sso/start?platform=${PLATFORM}&return=${encodeURIComponent(callback)}`;
  return new Response(null, { status: 302, headers: { location: target, 'cache-control': 'no-store' } });
};
