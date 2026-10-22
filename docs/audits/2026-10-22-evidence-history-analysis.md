# Evidence history analysis — 22 October 2026

The admin history now groups frozen pre-match selections by sport, market and fixture using the same presentation order as the upcoming shortlist. Related handicap/total lines remain distinct ranked rows. All accordions start closed.

Filters: retained date or all retained dates, sport, market family and settlement period, direction, exact line, minimum/maximum Model %, minimum saved Wilson confidence floor, recurrence strike and binary sample, text and displayed outcome. Final score and settlement notes remain visible with each selection.

The dashboard computes wins/losses, binary strike rate and its Wilson 95% interval, distinct fixtures, mean published probability, pending/other counts, loss probability range and Model-band breakdown. The outcome display selector never changes the underlying denominator. Multiple options from a fixture are correlated; these counts are exploratory historical evidence, not independent validation or guaranteed profit. Returned/partial/ungraded results do not inflate binary performance.

Only selections actually recorded before kickoff are included. Earlier finished matches are not backfilled. Day shards stay in protected R2 storage; no new Convex tables or polling added. All-date loading is four concurrent requests per batch; unchanged versioned days are cached within the authenticated page and cleared on access loss.

Verification: focused threshold/line/scope/settlement/ranking tests plus the full application suite. Synthetic browser QA exercises the admin interface; this is distinct from a real authenticated production data acceptance test. Existing server-side membership and MFA checks are unchanged.

Acceptance: 216 application tests passed before final presentation changes. Svelte check passed with zero errors/warnings. Synthetic browser checks passed at 320, 390 and 1440 pixels with no page overflow or JavaScript errors; final 390px interaction also exercised minimum Model %, confidence floor, exact line and outcome-denominator independence. A final check/test run and production workflow are recorded in the release response.
