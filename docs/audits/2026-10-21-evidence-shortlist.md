# Administrator evidence shortlist

21 October 2026, Africa/Lagos.

## Behavior

A dedicated shared-navigation entry opens `/admin/evidence`. The page groups upcoming published selections by sport, period, exact outcome and line. It shows rank, teams/players, league/tournament/country, kickoff, frozen published Model %, recurrence counts, wins/losses/returns/partials, historical strike rate, a red–amber–green confidence meter and the recorded price when one existed. Groups count every qualifying option, initially rendering 50 rows with a show-more control; no 30-fixture truncation is imposed.

The default screen requires Model >=65%, at least20 comparable binary outcomes, observed strike >=60%, and a 95% Wilson lower bound >=50%. All thresholds are visible and adjustable. Same-league matching is optional. Groups are ordered by their strongest qualifying row; rows retain overall ranks and sort by the lower bound, observed rate, Model % and sample size. Current feed status removes live/finished fixtures, and the local clock removes started fixtures every30 seconds. New published fixtures and results enter with normal scheduled ingest refreshes.

## What comparable and confidence mean

Matching keys contain sport, engine version, selection artifact version, normalized input-source class, exact settlement signature/line/scope and a 10-point Model % band. League matching can narrow the pool further. Different lines, sides, periods and fitted versions are not pooled. These criteria describe similarity; they do not claim that every tactical, injury or scheduling circumstance is identical.

The meter is the lower end of a two-sided 95% Wilson interval for the cohort's observed binary win rate. It is not a fixture win probability, a Bayesian probability that the strategy works, or a guaranteed return. Pushes and partial returns are reported separately and excluded from that binary rate. Screening many cohorts and relationships between fixtures limit inferential claims; this screen is exploratory, not proof of an independently validated betting strategy. Method reference: https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm.

Original pre-match snapshots supply the probability and market identity. Historical results are settled from the authoritative recorded final/period scores without refitting predictions. Duplicate aliases/provider copies cannot inflate the same fixture/outcome cohort. Up to five recent examples per cohort expose the recorded fixture, competition, pick, probability, outcome and score, with protected download of the original publication. Missing/invalid publications are reported, never reconstructed after kickoff. Unsupported market keys do not receive invented histories.

## Architecture and cost

The scheduled runner maintains a compact fixture ledger and cohort report in private R2. The first bootstrap reads retained archive-backed production fixtures (including legacy Convex files); subsequent refreshes reuse that history and inspect current ingest state, with a daily audit for older corrections. Historical records remain in R2 rather than expanding the Convex aggregate document. Convex holds only a protected version/pointer/coverage record. Catalog publication uses compare-and-swap to reject a stale writer. Superseded report/state objects have a24-hour reader grace period.

`/api/admin/evidence` checks active super-admin membership and then the backend administrator/MFA gate before reading R2 or returning304. Responses are private/no-store. The browser loads the report once and refreshes with feed generation changes or explicit action, rather than querying every ledger row per user interaction. Personal model-weight settings do not alter this page's frozen published projections.

## Acceptance

Validation and production bootstrap results will be recorded after release checks.
