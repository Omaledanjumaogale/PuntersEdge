import { redirect } from '@sveltejs/kit';
import { runtimeEnv } from '#lib/server/cloudflare.ts';
import type { PageServerLoad } from './$types';

/**
 * E-WIN SSO return. Exchanges the one-time Hub ticket for a local Better Auth
 * session (server-to-server), then sets the session cookie the membership
 * reader forwards to Convex. Identity is never accepted from the browser alone.
 */
const LOGIN_PATH = '/login';
const FALLBACK_LANDING = '/account';

const bounce = (reason: string, next: string): never =>
  redirect(303, `${LOGIN_PATH}?ewin=${reason}&next=${encodeURIComponent(next)}`);

export const load: PageServerLoad = async ({ url, cookies, fetch, platform }) => {
  const ticket = url.searchParams.get('ewin_ticket') ?? '';
  const rawNext = url.searchParams.get('next') ?? '';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes('\\') ? rawNext : FALLBACK_LANDING;
  if (!ticket) return bounce('missing_ticket', next);

  const runtime = runtimeEnv(platform) as Record<string, string | undefined>;
  const convexUrl = runtime.PUBLIC_CONVEX_URL;
  if (!convexUrl) return bounce('unconfigured', next);

  let token: string | undefined;
  try {
    // Convex names a function "module:function" on /api/action; the "/" form
    // belongs to /api/run/{identifier}.
    const response = await fetch(`${convexUrl}/api/action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'ewin:redeem', format: 'json', args: [{ ticket }] }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = response.ok ? ((await response.json().catch(() => null)) as { status?: string; value?: { token?: string } } | null) : null;
    token = body?.status === 'success' ? body.value?.token : undefined;
  } catch {
    token = undefined;
  }
  if (!token) return bounce('failed', next);

  const secure = url.protocol === 'https:';
  const attributes = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure, maxAge: 60 * 60 * 24 * 30 };
  cookies.set('better-auth.session_token', token, attributes);
  if (secure) cookies.set('__Secure-better-auth.session_token', token, attributes);
  redirect(303, next);
};
