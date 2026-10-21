# Betslip evidence, settlement and complete market track record

21 October 2026, Africa/Lagos.

Generated ticket previews and eligible options now show sport, league/tournament and country where recorded. The machine carries metadata explicitly instead of relying on individual market rows. Machine evidence and up to three alternative picks persist through working-slip sync, named-history saves and edits. A collapsed evidence panel remains readable after completion, independently of the board review window. Legacy selections without snapshots are identified honestly; no retrospective rationale is fabricated.

Working slips display scores and verdicts. Cloud draft queries resolve retained fixture states. Named histories preserve final scores/evidence after archive removal and continue overlaying corrected final scores while archives remain. Full-game projection totals, team totals and handicaps now settle; period projections use explicit observed period scores, never substitute final scores. Ingest and database metadata now retain those period scores.

Removed arbitrary ticket fixture-count caps; the persisted-item budget is 700,000 UTF-8 bytes to remain below Convex document limits. The backend regression covers saving and editing 151 fixtures and rejects oversized payloads explicitly. Combined-odds numeric overflow is still rejected rather than storing an invented return. This is larger-ticket support, not literally unlimited storage. History retains its existing 100-ticket account limit.

The old public track-record panel counted featured executable verdicts, at most one per fixture; it was not the complete market ledger. Removed that panel and enhanced the administrator track record. Published fixtures, fixtures with graded outcomes and settled market-option counts are distinct. Sport, semantic market direction, scope, exact market, grade and version breakdowns are available. All settleable published options count, including PASS/unpriced projections; ROI uses actual quoted prices only. Multiple lines/opposite sides within a fixture are correlated and are not independent observations. Pending/missing outcomes never become wins/losses.

Retained snapshots get one-time semantic-dimension reindexing. The maintenance script reindexes older archive-backed rows from their original published selections and outcomes, subtracting previous aggregates before adding replacements. No forecasts are generated after the result, and a missing archive is reported rather than guessed. Heavy evidence remains in R2; Convex stores compact aggregates and private user snapshots. Saved-slip settlement pages were reduced to ten documents per mutation to bound read/write work for larger tickets.

## Verification

- 185 application tests passed; Svelte check reported zero errors and zero warnings, and the production build completed.
- Backend regression tests cover 151-selection draft/history saves and edits, size guards, evidence retention after completion/archive removal, corrected final-score overlays, period-score settlement and atomic migration replay/races. Full backend CI passed; local resource-related timeouts in unrelated billing tests passed on an isolated rerun (14/14) without extending timeouts.
- Synthetic history QA passed at 320, 390 and 1440px with 151 visible selections, metadata, saved evidence and live callback-driven score/verdict updates. Machine QA passed at the same widths with 42 ranked, distinct fixtures and explicit country/tournament assertions. Admin track-record counts and sport/direction filters passed at 390 and 1440px. No page errors or horizontal document overflow were observed; screenshots were visually inspected.
- Read-only production QA passed at 390 and 1440px for dark/light themes, reduced motion and overflow. `/results` returned HTTP 200 and no longer contained the old public featured-only performance panel.
- Frontend runtime `5ebb152`: https://github.com/Omaledanjumaogale/PuntersEdge/actions/runs/39674470885 (successful). Backend runtime `b95a6c7`: https://github.com/Omaledanjumaogale/PuntersEdge/actions/runs/39674847476 (successful). Legacy-reader follow-up: https://github.com/Omaledanjumaogale/PuntersEdge/actions/runs/39675242502.

The verified retained ledger contained 1,090 published fixtures, 521 fixtures with graded outcomes, 26,900 settled market-option outcomes and 24 featured executable verdicts. These are different measures. The 26,900 outcomes include correlated lines and opposite sides, not 26,900 independent betting recommendations.

Scores/verdicts follow available provider/feed updates, generally the existing approximately 30-minute ingest schedule; this release does not claim second-by-second live scoring. Browser authentication/integration scenarios used synthetic local accounts, not customer-session writes or physical-device acceptance. Legacy selections missing an original evidence snapshot display that limitation explicitly.

## Historical dimension catch-up

Initial R2-only maintenance completed 127 additional snapshots and identified 176 legacy evidence files outside R2. Existing all-market outcome totals were retained throughout. The internal maintenance reader was extended to private Convex storage URLs, while original immutable files and publications remain unchanged. Migrations use batches of up to twenty fixtures and flush aggregate writes once per sport/batch. A source-fingerprint check rejects a stale migration if a newer result arrived meanwhile. Final catch-up counts follow.


Final legacy catch-up completed 176 snapshots with zero missing archives and zero stale-source skips. Verification found zero settled snapshots without semantic direction categories. Direction-group outcome counts sum to exactly 26,900, matching the complete all-market ledger; published fixture, settled fixture and featured-verdict counts remained unchanged (1,090 / 521 / 24). No historical prediction or result was invented to fill a gap.

The final backend follow-up `cdfcf0c` passed all 78 backend tests, application tests, TypeScript and production deployment: https://github.com/Omaledanjumaogale/PuntersEdge/actions/runs/39675242502. The deployment does not require a frontend rebuild because the follow-up affects internal maintenance only. Both frontend and backend production releases are verified successful.
