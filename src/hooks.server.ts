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
 if(path.startsWith('/api/')){
  if(response.headers.get('Content-Type')?.includes('text/html'))return new Response(JSON.stringify({error:'The API endpoint is unavailable. Please try again shortly.'}),{status:response.status>=400?response.status:502,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-PuntersEdge-API':'1','X-Content-Type-Options':'nosniff'}});
  response.headers.set('X-PuntersEdge-API','1');
 }
 response.headers.set('X-Content-Type-Options', 'nosniff');
 response.headers.set('X-Frame-Options','DENY');
 response.headers.set('Content-Security-Policy',path.startsWith('/api/')?"default-src 'none'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'":"frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
 response.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
 if (privateRoute(event.url.pathname)) {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Cache-Control', 'private, no-store');
 } else if (['/sitemap.xml','/rss.xml'].includes(event.url.pathname)) response.headers.set('Cache-Control', 'public, max-age=300');
 return response;
};
