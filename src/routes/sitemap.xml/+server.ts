import type { RequestHandler } from './$types';
const siteUrl = import.meta.env.PUBLIC_SITE_URL as string | undefined;
import { contentDates } from '#lib/content-dates.ts';
import { publicPages, privateRoute } from '#lib/seo.ts';
export const prerender = false;
const escape = (value: string) => value.replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
export const GET: RequestHandler = ({ url }) => {
 const origin = siteUrl ? new URL(siteUrl).origin : url.origin;
 // Only published public pages belong in this domain's sitemap. Other domains
 // publish their own sitemaps; fixtures are deliberately omitted until indexed.
 const entries = publicPages.filter(page => !privateRoute(page.path)).map(page => `<url><loc>${escape(new URL(page.path,origin).href)}</loc>${contentDates[page.path] ? `<lastmod>${contentDates[page.path]}</lastmod>` : ''}<changefreq>${page.path === '/glossary' ? 'monthly' : 'daily'}</changefreq><priority>${page.path === '/' ? '1.0' : '0.7'}</priority></url>`).join('');
 return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`, {headers:{'Content-Type':'application/xml; charset=utf-8'}});
};
