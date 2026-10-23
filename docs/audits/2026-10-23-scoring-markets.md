# Football and basketball scoring release — 23 October 2026

## Implemented
- Newly published forecasts use versioned, fixed alternative first-half/quarter total and home/away team-total lines, with complementary Over/Under probabilities. Legacy archived forecasts retain their original single-line policy. Missing fitted team mappings yield no invented forecast.
- Evidence shortlist adds exact-period filtering and yellow scoring-family headers (football BTTS, totals, team totals, handicap; basketball/NBA scoring families). Existing automated catalog qualification, exact-line recurrence, confidence and pre-kickoff checks remain intact. Empty/unsupported groups are omitted; a yellow header does not claim validated betting value.
- Sports dashboards explain available scoring coverage. Fixture market accordions highlight period, BTTS and full projection groups in yellow.
- Results UI moved to `/admin/results`, with super-admin display guard and existing server admin-route access policy. User `/results` becomes a legacy link to the advanced machine. Shared desktop/drawer/mobile navigation promotes the bet machine; landing copy and notification fallback no longer advertise the removed user Results page.
- The existing statistics research request asks for explicit half-time fields, retaining only valid observed first-half counts. No inferred halves, no new scheduled request allocation; six research requests/day and existing API budget remain enforced. First-half shots/fouls/throw-ins/goal kicks are not enabled without sufficient archived data.

## Executed assessment
- Read retained production R2 catalog: 53 separate sport/version/source/scope/family scoring segments assessed with original pre-kickoff probabilities and verified binary outcomes. Lines within each fixture are averaged for validation loss. Earlier labels must be available before the later holdout. Temperature selected only on earlier data. Zero candidates passed all requirements; live probabilities retained.
- Collected 34,067 retained training rows through the existing collection flow, refit existing competition/scope models, compared against incumbents on chronological unseen results. Zero serving updates qualified. Evaluation successfully published to existing admin learning records. This corpus includes scopes/sports; it is not 34,067 independent samples per market.
- Daily refits now explicitly include BTTS Yes/No proper-score non-regression, preventing goal-total gains from concealing BTTS degradation. Eight Python tests include an adverse BTTS candidate.
- The archived probability assessment is regenerated inside the existing evidence refresh and shown in a collapsed admin assessment panel. No separate polling schedule or new Convex table added.

## Provider reference
API-Football's October 2024 release documents `half` on fixtures/statistics: https://www.api-football.com/news/post/api-football-new-release-available. Actual per-league/account historical coverage still requires collection; documentation is not evidence of a fitted event model.

## Acceptance boundaries
No higher future win rate, profitable executable price, live event-market readiness or blanket calibration approval is claimed. New lines must gather their own published outcome evidence before shortlist qualification. Synthetic browser QA and local tests are distinct from real authenticated production acceptance. Final checks and deployment outcomes are recorded in the release response.

Verification: 220 JavaScript tests, eight Python training tests, Svelte zero errors/warnings, production build/static shell validation passed. Synthetic admin/user browser checks passed at 390 and 1440 pixels with yellow scoring headers, collapsed groups, 80-fixture pagination, add/remove betslip actions, history filters, replacement user navigation and admin Results rendering. Existing backend authorization is unchanged; real authenticated production click-through is not represented by the synthetic harness.
