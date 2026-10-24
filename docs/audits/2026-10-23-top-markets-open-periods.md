# Top markets and open basketball period forecasts — 23 October 2026

## Admission policy
Supported published basketball/NBA first-half and first-quarter match totals, team totals and handicaps are automatically admitted to the admin shortlist without minimum Model %, sample size, strike rate or Wilson-floor screening. Other markets retain their existing rules. Explicit sport, market, scope, search and kickoff-window filters still apply. Finite model probability, supported settlement identity, deduplication, stale-catalog and pre-kickoff/live-state protections remain.

All yellow scoring-family accordions are grouped under Top markets, then sport. Other markets appear separately. Market accordions still start collapsed. Fixture/option Model % ranking and betslip controls are retained.

## Evidence integrity and persistence
The original published probability is unchanged. Missing history is represented as zero observations with an unavailable strike rate and no fabricated examples or confidence meter. Rows admitted without sufficient evidence say Forecast only / historical screening suspended. Available measured recurrence may still be viewed without implying validation. Bet slip notes retain the forecast-only basis.

The existing R2 history recorder now records these forecasts before kickoff with `period-open-v1` and an evidence-tier marker, then settles from verified period scores. Completed historical forecasts are not backfilled. The history UI can filter historical-screened and forecast-only records separately. No new Convex table, provider request schedule or Worker polling added; existing compressed archives grow with the additional recorded selections.

The catalog preview admitted all 864 basketball/NBA period options across 12 fixtures. Diagnostic breakdown: the earlier 926 combined period count included 62 football first-half options, which are outside this basketball/NBA exception. Counts continue to change with kickoff, refresh and deduplication.

## Verification
Focused tests cover sub-threshold admission, no invented recurrence, unchanged strict football/full-game rules, scope/market/sport filters, started/live exclusion, duplicate removal, distinct history tier and actual first-half/quarter settlement. Final application, browser, build and deployment outcomes are recorded in the release response.
