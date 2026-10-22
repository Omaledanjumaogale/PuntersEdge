# Evidence shortlist history and sport navigation

22 October 2026, Africa/Lagos.

The private `/admin/evidence/history` page has its own shared-navigation entry and an upcoming/history link pair. The scheduled evidence publisher records selections meeting default-v1 rules before kickoff in private daily R2 shards. Records preserve the last qualifying pre-match selection, original publication time and probability, and the recurrence count/interval known at qualification. Final scores and exact-market settlement update separately. Earlier completed matches are never retroactively labelled as shortlisted; temporary per-browser filter settings do not change the canonical recorded shortlist.

The history UI offers Lagos kickoff date, sport, outcome and text filters, completed/win/loss counters, score and regulation-score context, and 50-row incremental rendering without limiting the stored history. Pending, returned, partial and ungraded outcomes remain distinct. Raw historical matches and goal sequences are not copied into new Convex tables: the backend stores a compact day index in existing protected evidence metadata, with daily R2 bodies fetched only when opened. Full R2 history is retained by day; corrections are checked during the hot eight-day window and unresolved days remain visible as ungraded afterward.

History access requires active super-admin membership plus the backend administrator/MFA check before R2 access or conditional responses. Arbitrary date/path access is blocked. The page is explicitly prerendered to avoid the earlier deployment recovery 404 failure mode.

Basketball/NBA have explicit winner, spread, match-total and team-total Over/Under filters. They use the same exact-line cohort matching and evidence thresholds as other sports; insufficient evidence does not become an invented recommendation. Football accordions use light green tint, hockey sky blue, basketball/NBA amber and baseball violet, with text labels retained so colour is supplementary. History rows use matching sport accents.

Validation: 23 focused shortlist/research/history tests passed, including pre-kickoff freezing, completed settlement, loss correction, no retrospective backfill, and all basketball filter families. Four protected API tests passed, including history date access and backend authorization before conditional reads. Full CI/deployment and the first production history publication are recorded in the task response.

## Production bootstrap and ingest correction

The first history publication recorded 3,040 qualifying options across seven kickoff dates, starting 22 October 2026. None were backfilled as completed picks. Bootstrap read zero historical archive bodies. The initial collector workflow 39757402912 was cancelled before completion and does not prove collection acceptance. A no-op shadow input field was removed to avoid mass pre-match republication. Archive uploads now use bounded four-fixture concurrency, cleanup deletes at most 20 expired objects per tick, and the runner emits count-only stage diagnostics. The durable outbox replay path remains intact; 28 focused research, shortlist, history and storage tests passed. Backend history route tests passed; local Svelte checking passed. Final deployment and the bounded production retry are recorded in the task response.
