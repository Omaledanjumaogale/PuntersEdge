# Page availability, Worker requests and unpriced selections

## Incident observed 17 October 2026

Production `/`, `/board` and `/match` returned HTTP 404 with the literal body `Not Found`, while the service worker and manifest returned HTTP 200. The Pages project API confirmed `fail_open: true`. The old deployment rendered page HTML entirely through Functions and had no static page assets. Bypassing an unavailable Function therefore left no page to serve. The owner reported the shared request allowance exhausted. This combination matches Pages' documented fail-open behavior; application exceptions alone do not establish the account's exact quota counter.

Available account analytics for 17 October UTC showed roughly 72,150 successful requests to `ewin-standalone-connect` and 11,961 to `ewin-email-service`, plus smaller Workers. These are a sampled/account analytics observation, not a complete per-route billing reconciliation or a claim that PuntersEdge caused every request. The account's free request allowance is shared by Workers and Pages Functions. Cloudflare documents 100,000 daily requests, resetting at midnight UTC (01:00 WAT). Moving text generation to a free LLM does not replace routing, authentication, authorization or private R2 access, and does not reset this allowance.

References: https://developers.cloudflare.com/pages/functions/routing/ ; https://developers.cloudflare.com/workers/platform/limits/ .

## Implemented resilience

- Page HTML is generated at build time, with no user/profile/feed data. Query-dependent login/recovery values initialize in the browser; the private admin console initializes client-side. Public metadata remains in static HTML.
- `_routes.json` invokes Functions only for API/discovery endpoints. App pages, hashed bundles, fonts, icons and photos use Pages static serving. The build emits a branded static 404 recovery page with working navigation, and the app supplies a recovery error page.
- The build bypasses page membership redirects only while generating these empty shells. API membership checks and Convex subscription/admin checks continue to protect all real data and mutations. Static visibility of a console shell does not grant access.
- A failed navigation response now falls back to the service worker's public cached shell. Private pages, API responses and private feed data remain excluded from the shared offline cache.
- The Pages workflow rejects builds missing key static shells or with catch-all Worker invocation, then checks actual production HTML after deployment. These checks detect this page-availability regression; they cannot guarantee live API uptime under a shared exhausted allowance.
- Sports ingestion and model training already run in GitHub Actions. Bulk archives and fitted parameters remain in private R2; Convex retains account/access records and compact metadata. No extra LLM service or recurring Worker polling was introduced.

Dynamic API services can still be unavailable until the shared quota resets. Reducing the other account Workers' traffic requires tracing their callers and request loops; this PuntersEdge release does not silently alter those applications.

## Unpriced betslip contract

Every upcoming published market option is selectable independently of bookmaker price and PASS grade. Finished/live/postponed fixtures retain their pre-match restrictions. `odds: 0` is the persisted unpriced marker; the UI and PDF/share output display `Unpriced`, never 0.00 or a model fair estimate as an offered price. Existing priced records need no migration.

`slipPricing` calculates the product of quoted prices only: 2.00 × 3.00 plus one unpriced selection displays quoted-subset odds 6.00. There is no additive accumulator calculation. A wholly unpriced slip has no quoted odds and no calculable payout. Mixed-ticket odds/returns are explicitly labelled as the quoted subset; full-ticket expected profit is unavailable. Draft sync, saved history, editing, PDF and sharing preserve unpriced choices.

The advanced machine lists unpriced qualifying options for manual selection. Its target-odds optimizer uses real quotes only, because it cannot reach a numerical odds target from unknown prices. No fair odds or inferred quote is substituted.
