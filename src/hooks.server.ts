import type { Handle } from '@sveltejs/kit/hooks';
import { privateRoute } from '#lib/seo.ts';
export const handle: Handle = async ({ event, resolve }) => {
 const response = await resolve(event);
 response.headers.set('X-Content-Type-Options', 'nosniff');
 response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
 if (privateRoute(event.url.pathname)) {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Cache-Control', 'private, no-store');
 } else if (['/sitemap.xml','/rss.xml'].includes(event.url.pathname)) response.headers.set('Cache-Control', 'public, max-age=300');
 return response;
};
