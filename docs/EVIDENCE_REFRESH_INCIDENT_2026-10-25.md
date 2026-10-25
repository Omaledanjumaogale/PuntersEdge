# Evidence shortlist refresh incident: 25 October 2026

## Confirmed cause

The sports ingest workflow succeeded and published a catalog containing 193 upcoming fixtures, 1,078 historical fixtures and 53,687 settled options. A protected read during investigation found 2,318 eligible option rows. There was no missing R2 catalog.

GitHub scheduled executions were several hours apart despite the configured `7,37 * * * *` schedule. For example, scheduled runs were created at 10:20, 14:53, 18:35 and 20:55 WAT on 25 October. The previous release hid the entire catalog after one hour, including still-future forecasts. This made valid published selections disappear between delayed executions.

The evidence page also depended on changes to the main feed's `generatedAt` to fetch its catalog. A catalog-only publication or temporary request failure could leave an already-open page behind until focus or manual refresh. The stale warning still referred to the older 48-hour rule.

## Changes

- Subscribe directly to the protected evidence metadata. Fetch only when its catalog version changes. Conditional requests avoid repeatedly downloading unchanged R2 data.
- Retry independently every five minutes while visible, and after returning to the page or recovering network connectivity. Preserve the current view and accordion state; do not reload the application.
- Abort requests after 20 seconds, retry after failures and serialize overlapping refresh requests.
- Continue displaying future pre-match publications during runner delays, with an accurate data-age notice.
- Remove confirmed finished fixtures immediately. Require a status observation less than one hour old to retain past fixtures; continue enforcing the one-hour grace for unconfirmed scheduled kickoffs.
- Keep provider status observation times separate from price updates and catalog generation times. An older scheduled/live copy cannot resurrect a known finished fixture.
- Preserve evidence history, frozen model percentages and verified-result settlement. Keep bulk data in R2 and small metadata in Convex. Do not increase provider budgets or ingestion frequency.

## Verification

- Regression tests cover delayed publications, fresh/stale live status, final-status precedence, retries after failure, hidden-tab behavior, resume and request deduplication.
- `scripts/qa-evidence-refresh.mjs` exercises the rendered Svelte page at 390px and 1440px with synthetic administrator access and intercepted evidence responses. It verifies catalog subscription changes, polling without a feed change, 304 handling, failure recovery, no stale-live rows, no page errors and no horizontal overflow.
- Deployment CI runs frontend checks, the full unit suite, production build and public/protected route-shell smoke checks. Actual production catalog counts are checked independently of the synthetic browser tests.

## Operational limit

GitHub schedules are best effort. Browser retries can discover a new catalog but cannot cause a delayed runner to fetch new provider data. Future forecasts remain dated; stale past-game status is hidden. History can settle a result only after its provider supplies a verified final score. No guessed scores or model percentages are generated to fill a gap.
