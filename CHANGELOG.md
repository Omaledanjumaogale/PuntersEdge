# Changelog

## 2026-10-30 — Admin daily rollover research

- Automatically settle frozen daily tickets from verified provider results, show green winning-day ticks, and calculate separate streaks and 30-day accuracy for each odds target.
- Add a private 30-day calendar with 2×, 3×, 5× and 10× combined ticket targets, evidence metrics, risk illustrations and betslip actions.
- Select only matching fresh bookmaker quotes with sufficient comparable history and positive conservative screening edge. Prevent duplicate events within or across the day's tickets.
- Keep unsupported targets empty and clearly distinguish descriptive historical evidence from validated future returns. Reuse the existing evidence catalog without new provider calls or database tables.

## 2026-10-25 — Evidence refresh recovery

- Retry transient direct-R2 failures safely, isolate publication stages and allow publication-only recovery without additional sports-provider calls.
- Keep future published forecasts available when the scheduled runner is delayed, with an accurate data-age notice. Expire stale past-game status independently.
- Subscribe directly to evidence metadata and retry in the background, on return and on network recovery. Bound hanging requests and preserve the current page state.
- Track provider status observation times independently of odds updates; prevent older feed copies from resurrecting known final results.
- Add automated refresh regression tests and mobile/desktop browser coverage for delayed data, catalog-only updates and failed-request recovery.

## 2026-10-21 — Ranked shortlists and totals evaluation

- Sort all machine output by the visible Model % descending while retaining the optimizer's chosen legs and push-adjusted combination calculation.
- Extend fixed-line Under/Over and complementary team-total checks across football, NBA, other basketball, hockey, baseball and supported periods.
- Preserve hockey/baseball options that fail the price-edge quality screen while retaining PASS/zero-stake safeguards.
- Add candidate-selected Over/Under evaluation cohorts for match totals and each team, with paired serving comparisons, reliability bins, observed win rates and calibration gaps. Prevent sufficiently sampled directional regressions from qualifying a serving update.
- Expose this direction evidence in the model registry; historical win rates do not imply executable-price ROI.


## 2026-10-21 — Complete shortlists and coupon market cards

- Remove the ten-fixture fallback limit; show every matching event once, while keeping quoted accumulators subject to their actual odds target.
- Deduplicate repeated event/option copies, replace same-event manual machine choices, and search beyond the old 200-option pool cap within the existing computation budget.
- Add team-total Over/Under filters and correctly classify full-game and period forecasts. Remove Today/Tomorrow kickoff presets and map older saved presets to rolling windows.
- Retain both basketball total directions when price discrepancies fail value screening; those selections remain unapproved with zero recommended stake.
- Restore high-contrast coupon cards across markets, pick tickets, machine previews, slips and tennis. Preserve model percentages, identity colours, notes and add controls.
- Make working-slip fixture names touch-friendly analysis links and identify the team in period-total labels.


## 2026-10-20 — Audit remediation

- Add authenticator enrollment, challenged sign-in, one-use recovery codes and server-enforced owner MFA with old-session revocation.
- Add searchable members, bounded payment checks, an audited dispute inbox and independent access holds.
- Add account exports, staged personal-data erasure, privacy notices and bounded daily retention.
- Generate per-page script hash policies within Cloudflare limits and collect bounded, sanitized CSP reports.
- Record dataset permissions, attribution and remaining external acceptance in the remediation report.

## 2026-10-19 — Member access, billing and integration audit

- Give every member independent access controls and preserve trial dates on status-only edits.
- Add server-verified Korapay checkout alongside Flutterwave, restore transfer instructions, record payment attempts and reconcile callbacks with bounded retries.
- Show renewal prompts, pending-verification signups and private account/payment histories in user management.
- Patch authentication dependencies, persist sensitive-action rate limits, protect against framing, and exclude tester/tennis pages from shared offline caching.
- Repair the explanation service after private R2 migration and add a platform audit with remaining acceptance gaps.

## 2026-10-19 — Ticket preview and black theme

- Populate a clearly labelled probability-ranked shortlist when eligible forecasts exist but quoted combinations cannot meet target odds. Keep missing prices unpriced and exclude them from combined odds.
- Move rule naming and saving beside the generator; link directly to saved rules and reuse against current fixtures.
- Replace navy dark-theme surfaces with black and charcoal; preserve the daylight palette and add lightweight glass highlights, hover feedback and reduced-motion support.
- Cover multiple model thresholds, unpriced shortlist deduplication, save/reuse and mobile/desktop theme behavior.

## [1.0.0.2] - 2026-10-16

- Move scheduled fixture processing, hot state, feed delivery and new forecast archives to private Cloudflare R2 storage.
- Keep Convex for accounts, access checks, saved tickets and small feed/archive metadata.
- Stop unchanged half-hour forecast republications, batch performance counters, isolate provider quota writes, and load detailed performance only in its admin workspace.
- Preserve full forecast evidence in immutable archives, compact duplicated explanation text in hot settlement copies, and retry pending archive/result/notification metadata through a durable outbox.
- Serve the limited public preview directly from R2; authorize every private feed and archive download.
- Reduce anonymous polling and exclude fixtures without a usable projection from delivered feeds.

## [1.0.0.1] - 2026-10-14

- Inspect fitted candidates in the protected model registry and run shadow forecasts without unsupported stake recommendations.
- See source-backed quote age and an explicit unvalidated estimate state; stale or missing evidence cannot become a current recommendation.
- Price whole-line basketball and hockey markets with push outcomes, keep regulation separate from final results, and use final-score NHL/MLB candidates without adding another extra-play goal or run.
- Keep prior publications and model identities in durable archives for reproducible comparisons.
- Receive deterministic explanations of supplied facts and missing inputs by default.
- Train and evaluate score-only candidates on authorized API-Sports histories, with chronological comparisons and documented limits. The results do not establish bookmaker superiority.
- Evaluate and serve separately fitted period totals, team totals and handicaps; price Asian quarter outcomes explicitly and track five-state probability scores.
- Show green favourable-estimate indicators, cross-market choice notes and explicit screening grade rules while preserving validation gates; repair Cloudflare dependency installation.
