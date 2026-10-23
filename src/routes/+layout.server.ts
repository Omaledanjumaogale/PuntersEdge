import type { LayoutServerLoad } from './$types';
const siteUrl = import.meta.env.PUBLIC_SITE_URL as string | undefined;
import { buildMeta, defaultSEO, publicPages, privateRoute } from '#lib/seo.ts';
import { buildOrganizationSchema, buildWebSiteSchema, buildBreadcrumbSchema, buildPersonSchema, buildServiceSchema, buildFAQSchema } from '#lib/schema/builders.ts';
export const load: LayoutServerLoad = ({ url }) => {
 const origin = siteUrl ? new URL(siteUrl).origin : url.origin;
 const route = publicPages.find(p => p.path === url.pathname);
 const canonical = new URL(url.pathname, origin).href;
 // Match IDs identify public fixtures; discard tracking parameters from canonicals.
 if (url.pathname === '/match') {
  return { seo: buildMeta({ ...defaultSEO, title: 'Match analysis — PuntersEdge', canonical, robots: 'noindex, follow', schemas: [buildOrganizationSchema(origin), buildWebSiteSchema(origin)] }) };
 }
 return { seo: buildMeta({ title: route ? `${route.name} — PuntersEdge` : defaultSEO.title, description: route?.description ?? defaultSEO.description, canonical, robots: privateRoute(url.pathname) ? 'noindex, nofollow' : 'index, follow', schemas: [buildOrganizationSchema(origin), buildWebSiteSchema(origin), buildPersonSchema(), ...(url.pathname === '/' ? [buildServiceSchema(origin), buildFAQSchema([{ question:'What does Exclusive VIP Punter cost?', answer:'Exclusive VIP Punter costs ₦10,000 per month. It unlocks sports dashboards, full match analysis, the advanced bet machine, saved tickets and notification settings. The admin console is reserved for the super administrator.' }, { question:'What can free visitors see?', answer:'Free visitors can browse the landing page and a limited preview board. Clicking a fixture displays a dismissible VIP subscription invitation; full match analysis requires an active subscription.' }, { question: 'Are sports predictions guaranteed?', answer: 'No. Model probabilities describe uncertain outcomes. An estimated edge does not guarantee a winning bet.' }, { question: 'How do I know whether the data is live?', answer: 'Check the provider data badge and its refresh timestamp. Provider limits and outages may delay updates.' }, { question: 'Which sports does PuntersEdge cover?', answer: 'PuntersEdge supports football, NBA, basketball, ice hockey and baseball, with sport-specific scoring models.' }])] : []), buildBreadcrumbSchema(url.pathname === '/' ? [{name: 'PuntersEdge',url: origin}] : [{name: 'PuntersEdge',url: origin},{name: route?.name ?? 'Page',url: canonical}])] }) };
};
