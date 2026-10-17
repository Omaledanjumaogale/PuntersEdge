import type { Handle } from '@sveltejs/kit/hooks';
import {premiumPath} from '#lib/access-routes.ts';
import {membership} from '#lib/server/membership.ts';
import { privateRoute } from '#lib/seo.ts';
import {building} from '$app/env';
export const handle: Handle = async ({ event, resolve }) => {
 const path=event.url.pathname;
 if(!building&&(premiumPath(path)||path==='/admin'||path.startsWith('/admin/'))){
  const access=await membership(event);
  if(!access.active||(path.startsWith('/admin')&&access.role!=='super_admin')){
   const location=path.startsWith('/admin')?'/subscribe':`/board?upgrade=1&next=${encodeURIComponent(path+event.url.search)}`;
   return new Response(null,{status:303,headers:{Location:location,'Cache-Control':'private, no-store','Vary':'Cookie'}});
  }
 }
 const response = await resolve(event);
 response.headers.set('X-Content-Type-Options', 'nosniff');
 response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
 if (privateRoute(event.url.pathname)) {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Cache-Control', 'private, no-store');
 } else if (['/sitemap.xml','/rss.xml'].includes(event.url.pathname)) response.headers.set('Cache-Control', 'public, max-age=300');
 return response;
};
