import type { RequestHandler } from './$types';

/** Same-origin proxy keeps Better Auth session cookies HttpOnly on Pages. */
const proxy: RequestHandler = async ({ request, url, fetch, platform }) => {
  const environment = platform?.env as Record<string, string | undefined> | undefined;
  const convexUrl = environment?.PUBLIC_CONVEX_URL || import.meta.env.PUBLIC_CONVEX_URL;
  const site = environment?.PUBLIC_CONVEX_SITE_URL || import.meta.env.PUBLIC_CONVEX_SITE_URL || convexUrl?.replace('.convex.cloud', '.convex.site');
  if (!site) return new Response('Authentication is not configured.', { status: 503 });
  const target = new URL(url.pathname + url.search, site);
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('x-better-auth-forwarded-host', url.host);
  headers.set('x-better-auth-forwarded-proto', url.protocol.slice(0, -1));
  let response: Response;
  try { response = await fetch(target, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
    redirect: 'manual', signal: AbortSignal.timeout(20000),
  }); } catch { return Response.json({message:'The account backend is unavailable. Please try again later.'},{status:503,headers:{'Cache-Control':'no-store'}}); }
  const outputHeaders = new Headers(response.headers);
  outputHeaders.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, headers: outputHeaders });
};
export const GET = proxy;
export const POST = proxy;
