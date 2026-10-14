# Upgrade verification

The code and research package are on codex/calibrated-model-upgrade. It is not a production rollout. Existing remote main was fetched and unchanged during implementation.

Verification includes complete JavaScript tests, backend access/settlement/model-registry tests, Python model and CSV/CLI tests, frontend and backend type checks, production builds and narrow probability/freshness regression tests. Initial parallel backend tests timed out on this Windows host; a single-worker run passed. This does not establish external provider acceptance or live model accuracy.

Browser smoke at 390×844: landing, board and model-registry access-boundary URLs returned 200 with zero page errors and no horizontal overflow. Anonymous model-registry navigation hit the entitlement/access flow; administrator controls are covered by backend tests rather than an authenticated live-browser claim. Local /api/preview returned 503 because the local server was not configured with the complete deployment environment; provider-backed authenticated preview was not verified. No service credential was exposed to the browser.

Independent adversarial review found missing-provenance fail-open behavior, mixed artifact performance groups, stale collection quotas, NHL final/regulation confusion and oversized publication-history scheduler arguments. These were repaired. Original publications now remain separate compressed storage records with idempotent identity; scheduler arguments contain storage IDs. The serving store keeps bounded small publication metadata.

Documented remaining limitations: unapproved candidates, no historical executable odds, small production comparison cohorts, retrospective result-availability assumptions, missing injury/goalie/pitcher features, no tennis feed/UI, long-term archive correction reconciliation and dependent-market confidence intervals. The branch includes no mechanism that automatically approves betting stakes based on these limited benchmarks.

Credentials, raw responses and production archives remain ignored locally. Secret scanning checks staged bytes before push. No deployment, wager, payment or account role change is performed by this verification package.

Expanded market verification covers 14 independently fitted sport/scope combinations, five-state Asian settlement, real period-score extraction, scope-specific model attribution, monotonic archive revisions and categorical probability accounting. Four Python market regressions and 19 targeted JavaScript regressions passed. Complete multi-market results and their limitations are in MARKET-BACKTESTS.md.

Remote delivery: branch codex/calibrated-model-upgrade is pushed and draft PR #1 is open. Cloudflare Pages automatically reported Build failed for commit 6f6f55a although the local Cloudflare build passed. GitHub exposes no detailed log. The local Wrangler session is unauthenticated and dashboard browser automation timed out, so the cause and a successful remote preview remain unverified. CodeSnif is neutral pending its setup. Production has not been deployed by this task.

Release follow-up: Cloudflare API logs identified the preview failure as npm ERESOLVE: Better Auth optional SvelteKit 2 peer declaration conflicts with SvelteKit 3. Repository .npmrc now matches the existing deployment workflow legacy-peer-deps setting. Green indicators require a current executable quote, independent fitted evidence, supported likelihood/value rules and positive EV after a five-point probability sensitivity haircut. Estimated screening grades remain distinct from validated value grades; unapproved candidates have zero stake and PASS. Choice notes rank every available option by stressed EV, include the probability/price/push inputs, and explain missing evidence.
