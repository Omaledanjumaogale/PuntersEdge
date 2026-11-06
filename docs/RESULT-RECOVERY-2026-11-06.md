# Result recovery and market evaluation — 6 November 2026

## Released changes

- Keep complete scheduler refresh times in R2; send only the most recent 512 job entries to Convex. This repairs the observed `1026 > maximum 1024` commit error without discarding the full refresh history.
- Isolate evidence publication, preview publication and rollover settlement. A failed ingest still attempts publication from retained state and preserves the original failure for CI reporting.
- Recover missed result dates for published odds-only fixtures within 14 days through the existing quota-metered planner. Provider caps, reservations and denied-date caching remain in effect.
- Add bounded public-scoreboard recovery for explicitly supported competitions: at most four requests per tick and a six-hour per-competition/date cache. Only uniquely matched completed events are accepted. Supplied basketball and hockey period scores are preserved; football extra-time/shootout results are excluded from regulation settlement.
- Store per-leg rollover outcomes, final scores and fixture metadata. A confirmed losing leg settles the ticket as lost immediately. Other legs continue refreshing until all settle. Wins, losses and returns have distinct calendar/card indicators.
- Extend the private archived-probability assessment to supported sports and market families, including separate winner directions and double-chance options. Show original model bands and recorded outcomes; calculate uncertainty using daily clusters instead of pretending that many lines on one match are independent observations.

## Production verification

Feature commit: `32b0160`.

- Backend deployment: https://github.com/Omaledanjumaogale/PuntersEdge/actions/runs/42255348458 — passed 264 unit tests, 87 backend tests, backend type checking and deployment.
- Pages deployment: https://github.com/Omaledanjumaogale/PuntersEdge/actions/runs/42255375277 — passed checks, build, deployment and production route/API acceptance.
- Sports/R2 refresh: https://github.com/Omaledanjumaogale/PuntersEdge/actions/runs/42255462802 — succeeded.
- Mobile/desktop component QA passed at 390px and 1440px: all four targets populated with controlled data, automatic recording and saved-ticket metadata worked, midnight repopulated without duplicates, and no horizontal overflow occurred. This does not establish a live authenticated browser result or betting performance.
- Fresh metadata audit: Convex scheduler summary has 512 entries; evidence contains 1,130 finished fixtures and 56,263 settled market-option outcomes, with no missing archives. Option counts are not independent match counts.
- All 13 existing rollover tickets were enrolled in continued settlement. All 35 saved legs have league metadata after backfill. Source records do not contain their countries; the UI explicitly identifies missing country data.

## Model evaluation and current data limitations

The retained result corpus has 34,224 rows across 14 serving segments. A fresh chronological refit/evaluation completed and was published; zero replacements qualified under the non-regression and unseen-result checks. Existing serving probabilities were therefore retained. This release does not claim improved strike rate or ROI.

API-Sports currently reports account suspension across the configured sports. The owner instructed work to proceed while access recovers. Missing verified final scores remain pending; neither an elapsed kickoff nor a missing feed is converted into a loss, win or void. Public recovery covers only supported competitions and unique matches. Once provider access returns, missed-day recovery and automatic settlement continue under the existing budgets.

No production database reset, provider cap increase, fabricated bookmaker price, retrospective prediction rewrite, or manual winning label was performed. Bulk state and history remain in R2.
