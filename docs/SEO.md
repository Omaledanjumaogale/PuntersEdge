# Search and AI discovery

The root server load builds route-specific canonical metadata and a single JSON-LD graph. The SEO component renders it in `svelte:head`; application pages remain server-rendered. Set PUBLIC_SITE_URL to the verified production origin for canonical consistency. Never publish invented sister-platform URLs or unsupported credentials, results, ratings, translations or guarantees.

Robots names the requested AI crawlers, blocks private and analysis-board routes, and points to the parent ecosystem sitemap. The application sitemap is `/sitemap.xml`; add its absolute production URL to robots.txt once the origin is verified. Cross-domain URLs belong in the owning site's sitemap. Sitemap lastmod values are verified committed page timestamps in `src/lib/content-dates.ts`; refresh those values from git when publishing editorial changes. They do not claim that a live feed refreshed.

The machine-readable indexes `/llms.txt`, `/llms-full.txt` and `/.well-known/ai-agent-manifest.json` describe real routes, data sources, sampling and uncertainty. `/rss.xml` is an empty valid feed until dated editorial entries actually exist. No blog, translated page or fixtures are fabricated to fill a feed.

For editorial pages, use PageTemplate, TLDRBlock, AuthorCard, FAQSection and RelatedLinks. Supply real publication and modification dates. Assemble page-specific Article/FAQ schema in the server load only when its text is visible on the page; merge it into the graph rather than adding competing script blocks. Use semantic headings with stable IDs. A FAQ example is visible on the homepage. Do not invent professional credentials or imply predictions guarantee outcomes.

## Publication checks

1. Verify PUBLIC_SITE_URL and add the application's absolute Sitemap directive.
2. Confirm page source includes canonical, descriptions and the JSON-LD graph.
3. Check `/sitemap.xml`, `/robots.txt`, `/llms.txt` and `/rss.xml` from production.
4. Validate real structured data with Schema.org Validator and Google Rich Results Test.
5. Submit the application sitemap in Search Console. Parent-domain modifications require access to that site's repository; this change does not edit ewinproject.org.
6. Run Lighthouse at phone widths and monitor production Core Web Vitals; no score is claimed before measurement.

Only English content is presently published. Add hreflang after translations exist; do not signal untranslated locales. Markdown integration is unnecessary for this application until editorial Markdown content exists. Open Graph cards use text until a genuine dedicated 1200 × 630 share image is supplied.

## Implementation map

1. Crawl configuration: `static/robots.txt`, `llms.txt`, `llms-full.txt`, `.well-known/ai-agent-manifest.json`, sitemap/RSS endpoints, `hooks.server.ts`.
2. Metadata: typed `src/lib/types/seo.ts`, `seo.ts`, `SEO.svelte`, server layout/page loaders and root layout wiring.
3. Schema: `src/lib/schema/{types,builders,graph}.ts`, Organization/WebSite/Person/Breadcrumb/FAQ/Article/HowTo/Service/Product builders. JSON-LD is assembled in loaders and rendered in the document head; serialization escapes HTML script delimiters.
4. Content components: `PageTemplate`, `FAQSection`, `AuthorCard`, `TLDRBlock`, `RelatedLinks`, `EcosystemBanner`. Homepage answers and FAQs have corresponding server schema. Source links identify model/provider documentation rather than claiming invented credentials or endorsements.
5. Existing page integration: public homepage, sport dashboards and glossary render on the server. The membership page exposes the actual NGN price and manual-renewal terms. No nonexistent blog/docs route or translated content is fabricated.
6. Deployment: configure canonical origin, deploy SSR worker and static assets, then use Search Console and external schema validators. Those hosted submissions are not performed by local builds.
7. Follow-up enhancements: real translations before hreflang, measured Lighthouse budgets, verified sister-domain catalog and parent repository changes, authored articles with accurate dates/credentials, and external citation monitoring. Localization and search-console registration remain separate work; this repository cannot edit unselected mother/sister applications.

### Quick wins

- Server-render meaningful public content and metadata.
- Publish explicit canonical URLs and escaped JSON-LD.
- Serve robots and AI-readable page indexes.
- Link the verified E-WIN mother entity in the banner and organization graph.
- Keep data freshness, sample labels, pricing and private-route indexing behavior explicit.

## Current completion and verification status

Implemented in this repository: server rendering is enabled; the root layout renders the server-built SEO configuration; per-route canonicals, description/Open Graph/Twitter metadata, robots directives and one escaped JSON-LD graph are available. The graph includes Organization, WebSite, Person and Breadcrumb entities, with homepage FAQ and Service entities. The mandatory E-WIN banner is visible on the homepage. Public discovery endpoints and reusable editorial components are present.

The Results page now focuses on published pre-match predictions and retained settled performance. API request quotas, provider error logs and backend operational details belong in the authenticated administrator console. User-facing text should identify sample data and prediction uncertainty without exposing operational logs. Finished projections are displayed only while the backend makes them available during its 12-hour post-finish viewing window; do not enforce that access restriction only in the browser.

Not completed by this repository change: Search Console verification or sitemap submission, edits to the mother application or other sister repositories, verified translated content and hreflang, external Rich Results/Schema.org hosted validation, production Lighthouse/Core Web Vitals measurement, and proof that an LLM will cite the site. AEO/GEO improves machine-readable discoverability; it does not guarantee indexing, rankings, trust assessments or citations.

No author professional credentials, endorsements, aggregate ratings, fabricated dates or original performance statistics are asserted. Editorial article templates support dates only when supplied by real published content. The existing sitemap timestamp map describes committed content changes, not fixture freshness. Provider quota logs remain private operational data.

### Local checks performed

The local Vite server returned HTTP 200 for `/`, `/glossary`, `/results` and `/sitemap.xml`. Raw response HTML for all three pages contained an H1, canonical link, description and exactly one parseable Schema.org JSON-LD graph. The homepage graph contained Organization, WebSite, Person, Service, FAQPage and BreadcrumbList; glossary/results had the global entity and breadcrumb graph. The sitemap parsed as valid XML with 10 public entries. Results rendered the published-prediction introduction without the former quotas or source-log UI. These checks establish local SSR and document structure, not production crawler indexing or hosted validator approval.
