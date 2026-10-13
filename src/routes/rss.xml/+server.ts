import type { RequestHandler } from './$types';
const siteUrl = import.meta.env.PUBLIC_SITE_URL as string | undefined;
export const prerender = false;
export const GET: RequestHandler = ({ url }) => {
 const origin = siteUrl ? new URL(siteUrl).origin : url.origin;
 const escape = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 // No fabricated dated articles or results. The feed is ready for published content.
 return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>PuntersEdge</title><link>${escape(origin)}</link><description>Sports analytics updates. Live source status is available on the Results page.</description><language>en-NG</language></channel></rss>`,{headers:{'Content-Type':'application/rss+xml; charset=utf-8'}});
};
