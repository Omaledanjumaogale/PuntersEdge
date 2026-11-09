# Changelog

## 2026-11-09 — Ranked overview and consistent published forecasts

- Rank market overview buttons by descending Model %, with numbered ranks, market icons, clear selection labels, consistent spacing and visible selected/focus states.
- Share compact published probabilities and settlement identities across the board, sports, market choices, fixture analysis and overview. Keep current quotes separate, retain missing published lines as unpriced options, and omit private recurrence information.
- Retain published analysis when current inputs cannot rebuild it or a future fixture sits beyond the normal seven-day input window. Match stale past-status handling to the evidence shortlist; replace the board's silent 40-fixture cutoff with an explicit count and Show more button.
- Resolve exact odds-provider team names against retained training identities so supported full-game and period models attach to more NBA, football, hockey and baseball fixtures. Unknown identities and unsupported leagues remain unmapped.
- Retry stale/interrupted feed metadata in the background without page reloads and add a manual published-fixture refresh action. Preserve provider caps, R2 bulk storage and small Convex metadata.

## 2026-11-09 — Compact market prediction overview

- Add a shared reference-inspired prediction tile overview to fixture market analysis across football, basketball/NBA, hockey, baseball and the supported tennis workspace.
- Show each market's highest existing Model % selection, recorded bookmaker odds or an explicit Unpriced label, and a fixture-leading model shortcut. Preserve original probabilities, prices, analysis and betslip actions.
- Use keyboard-operable market shortcuts to open the matching accordion. Keep all markets collapsed initially, preserve home/away colors, fit small screens, and respect reduced-motion preferences.

## 2026-11-06 — Result recovery and market accountability

- Keep the full scheduler job history in R2 and bound Convex's copy to 512 fields to prevent the observed 1024-field commit failure.
- Publish evidence and preview from retained state even after an ingest failure; isolate rollover settlement as its own retryable publication stage.
- Store and show per-leg verified rollover outcomes and final scores. Mark a ticket lost as soon as one verified leg loses, while keeping absent results pending. Preserve sport, league, tournament and country metadata on saved tickets.
- Recover uniquely matched final results from bounded, cached public scoreboards for supported competitions, with explicit period scores and no inferred winners or extra paid calls.
- Extend archived calibration assessment to all supported sports and market families, separate winner orientations and use daily uncertainty blocks. Show recorded model bands in the private evidence console. Existing serving probabilities remain unchanged unless chronological evaluation qualifies an improvement.

## 2026-10-31 — Rollover population and midnight refresh

- Build the rollover pool from supported published forecasts instead of the stricter evidence-shortlist display filter. Rank by frozen Model %, with comparable historical evidence as a tie-breaker; offer positive model-implied value as an optional filter.
- Match the latest bookmaker price by exact canonical market and line, including football totals aliases. Accept recorded quotes up to 36 hours old, display their observation time, and never use estimated fair odds or renew missing timestamps.
- Follow the Lagos day change without reloading the app, refresh both the feed and evidence catalog, preserve explicitly selected history, and align the page clock with the evidence response. Add a midnight publication run using the existing provider budget meters.
- Keep duplicate prevention, automatic settlement and immutable saved tickets. Restore the betslip action on automatically recorded tickets. Unreachable targets remain explicit rather than receiving fabricated prices or repeated events.

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
