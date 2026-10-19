# Market identity and responsive ticket search

Home identity uses light green and away identity uses light blue. Daylight mode
uses darker matching shades for contrast. Market names are rendered as escaped
text segments rather than injected HTML. Double-chance options can display both
colours; neutral totals and draws do not acquire an invented home/away side.
Period team totals identify their side from the stable market key even when the
selection itself says only Over or Under. Tennis uses the same two colours but
labels Player 1 / Player 2: tennis display order does not establish a home venue.

Repeated generation excludes previously shown fixture combinations during the
current rule session. It ranks qualifying combinations by estimated all-win
probability, with one selection per fixture, real quoted odds, the selected sports
and markets, the minimum model percentage and the existing 5% target-odds window.
Changing rules resets the session history. Different tickets can overlap in some
fixtures; merely changing a market on the same fixture set does not count as a
different combination. No randomization or probability inflation is introduced.

The optional positive expected-value filter remains available. Without it, a
probability-first ticket may contain negative estimated-value prices. The search
does not establish calibrated live profit or guarantee wins. Combined probability
assumes independent fixtures. It is a bounded beam search over up to 200 eligible
selections, not proof of a global optimum. The worker caps expansion evaluations;
if no further combination is found, the last ticket remains available and the UI
explains the limitation instead of repeating it or weakening the filters.

Ticket search runs in a dedicated Web Worker. Rule changes and page teardown
terminate obsolete work; a generation identifier rejects late results. A timeout
and visible busy/error states prevent silent waiting. The full eligible shortlist
still supports manual addition to the slip, including unpriced choices. Generated
target-odds tickets continue to require actual prices.

Single-match lookup no longer builds the full board. A weak per-input cache
reuses numerical forecasts for unchanged pricing settings and clock value; new
input objects, model-weight/Kelly changes and clock ticks cause a rebuild, so
quote-age checks remain active. Fixture and publication indexes replace repeated
linear membership scans. Candidate alternative ranking is computed once per
fixture rather than once per selection. Full-page view-transition snapshots were
removed; navigation now has a lightweight progress indicator and code preload on
hover.

The football parameter fit reuses a bounded coarse probability grid keyed by its
dependence parameter. The original floating-point iteration order, loss and local
refinement are unchanged. A reference regression test asserts exact numerical
equality across targets and dependence parameters. This is a computation change,
not a retrained or newly approved forecasting model.

Local evidence: the same captured 33-fixture / 1,856-option engine sample took
1,620 ms before and 827 ms after grid reuse (one run each; not a controlled device
benchmark). Browser QA at 390 and 1440 pixels checked side colours, no page
overflow, repeated distinct tickets, pricing-setting invalidation, clock/quote-age
invalidation and a 200-selection worker search with concurrent event-loop ticks.
These local synthetic-account checks do not establish real-phone latency or an
authenticated production account acceptance test.
