import type { PageSEO, SEOConfig } from '#lib/types/seo.ts';
import { buildPageGraph } from '#lib/schema/graph.ts';
export const defaultSEO = { title: 'PuntersEdge — sports analytics across five sports', description: 'Compare sports fixtures, scores, bookmaker prices and model probabilities for football, NBA, basketball, ice hockey and baseball. Analysis is not a guarantee.' };
export const publicPages = [
 { path: '/', name: 'Sports analytics', description: defaultSEO.description },
 { path: '/sports', name: 'Sports', description: 'Explore football, NBA, basketball, ice hockey and baseball analysis.' },
 ...[['football','Football'],['nba','NBA'],['basketball','Basketball'],['hockey','Ice hockey'],['baseball','Baseball']].map(([path,name]) => ({path: `/${path}`,name: `${name} analysis`,description: `${name} fixtures, scores, bookmaker prices and model probabilities. Check the data badge for provider freshness.`})),
 { path: '/board', name: 'Analysis board', description: 'Compare model probabilities with bookmaker prices across supported sports.' },
 { path: '/value-bets', name: 'Value analysis', description: 'Explore estimated price differences and the uncertainty behind each model pick.' },
 { path: '/bookmakers', name: 'Bookmaker comparison', description: 'Compare bookmaker margins and available prices.' },
 { path: '/results', name: 'Results and published projections', description: 'Review published pre-match probabilities, settled verdicts and confirmed final scores. Past results do not guarantee future outcomes.' },
 { path: '/glossary', name: 'Sports analytics glossary', description: 'Understand probability, expected value, bookmaker margins and stake sizing.' }
];
export function buildMeta(page: PageSEO): SEOConfig { page = { ...page, image: page.image ?? new URL('/screenshots/board-desktop.png', page.canonical).href }; return { ...page, robots: page.robots ?? 'index, follow', openGraph: { title: page.title, description: page.description, url: page.canonical, type: page.type ?? 'website', image: page.image, locale: 'en_NG' }, twitter: { card: page.image ? 'summary_large_image' : 'summary', title: page.title, description: page.description, image: page.image }, jsonLd: buildPageGraph(page.schemas ?? []) }; }
export const privateRoute = (pathname: string) => /^\/(admin|bet-machine|betslips|account|settings|login|signup|auth|api|sports|football|nba|basketball|hockey|baseball|tennis|match|results|bookmakers|glossary|value-bets|reset-password)(?:\/|$)/.test(pathname);
