# Ranked machine output and totals evidence

Date: 21 October 2026 (Africa/Lagos).

Generated tickets, fallback previews and eligible-option lists now display Model % descending. The optimizer still chooses legs by its existing push-adjusted joint-probability objective and actual odds constraints; sorting the result does not change the legs or economics. This distinction matters for whole-line markets, whose conditional model percentage can differ from outright win probability.

Fixed-line tests cover match totals and each team's totals for football, NBA, other basketball, hockey and baseball. Supported first-half, first-quarter, first-period, regulation, first-five-innings and first-inning forecasts also have complementary probability, team-identity and lower/higher projection checks. The functions under test are the distribution functions actually used to generate market options. Hockey/baseball no longer hide an option merely because its estimated edge exceeds 25%; the existing eligibility and zero-stake rules still apply.

Continuous evaluation now separates candidate-selected >=55% outright-probability cohorts into match Over/Under, home-team Over/Under and away-team Over/Under. Each uses the candidate and incumbent on the same fixtures, line and direction, chosen before reading results. Reports include fixture counts, Brier/log loss, mean forecast, observed wins, probability calibration gap and reliability bins with observed-rate intervals. No calibration function is fitted using this holdout. No quote or ROI is invented. Promotion additionally withholds a candidate when any direction with at least40 fixtures regresses in Brier or log loss by more than2%; sparse cohorts are explicitly insufficient and the pre-existing global/temporal evidence gates remain required.

The registry exposes these cohorts inside a collapsed evidence panel. This makes it possible to examine the user's observation that totals/team totals perform well without treating it as an established overall strike-rate improvement. Results from a fresh run are recorded below.

Tennis remains a separate informational winner/first-set implementation. Its unsupported point-stat totals/handicaps are not activated or falsely included as tested live markets.

## Acceptance

Pending final CI, responsive QA, deployment and refreshed evaluation. No improved profitability or accuracy claim is made by the code change alone.
