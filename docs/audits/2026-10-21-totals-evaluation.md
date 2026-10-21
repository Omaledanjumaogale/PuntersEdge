# Ranked machine output and totals evidence

Date: 21 October 2026 (Africa/Lagos).

Generated tickets, fallback previews and eligible-option lists now display Model % descending. The optimizer still chooses legs by its existing push-adjusted joint-probability objective and actual odds constraints; sorting the result does not change the legs or economics. This distinction matters for whole-line markets, whose conditional model percentage can differ from outright win probability.

Fixed-line tests cover match totals and each team's totals for football, NBA, other basketball, hockey and baseball. Supported first-half, first-quarter, first-period, regulation, first-five-innings and first-inning forecasts also have complementary probability, team-identity and lower/higher projection checks. The functions under test are the distribution functions actually used to generate market options. Hockey/baseball no longer hide an option merely because its estimated edge exceeds 25%; the existing eligibility and zero-stake rules still apply.

Continuous evaluation now separates candidate-selected >=55% outright-probability cohorts into match Over/Under, home-team Over/Under and away-team Over/Under. Each uses the candidate and incumbent on the same fixtures, line and direction, chosen before reading results. Reports include fixture counts, Brier/log loss, mean forecast, observed wins, probability calibration gap and reliability bins with observed-rate intervals. No calibration function is fitted using this holdout. No quote or ROI is invented. Promotion additionally withholds a candidate when any direction with at least40 fixtures regresses in Brier or log loss by more than2%; sparse cohorts are explicitly insufficient and the pre-existing global/temporal evidence gates remain required.

The registry exposes these cohorts inside a collapsed evidence panel. This makes it possible to examine the user's observation that totals/team totals perform well without treating it as an established overall strike-rate improvement. Results from a fresh run are recorded below.

Tennis remains a separate informational winner/first-set implementation. Its unsupported point-stat totals/handicaps are not activated or falsely included as tested live markets.

## Acceptance

- Local application suite: 177 passed before the final optimizer-order regression addition; the targeted machine/cross-sport suite then passed all33 tests. Final CI counts are recorded below.
- Python tests: seven continuous-training tests and six diagnostic tests passed. They verify that a direction regression blocks a candidate despite an aggregate improvement, that sparse cohorts stay insufficient and that candidate-selected sides do not double fixture counts.
- Frontend local check: zero errors and zero warnings.
- Responsive synthetic browser QA passed at320,390 and1440px, including42 distinct fixtures with varied model percentages in descending order, team Under filtering, deduplication, mobile analysis navigation and no overflow/page errors.
- Runtime source release: `b3f01e9`. Backend CI/deploy: https://github.com/Omaledanjumaogale/PuntersEdge/actions/runs/39630703521. Frontend CI/deploy: https://github.com/Omaledanjumaogale/PuntersEdge/actions/runs/39630707365. Refreshed training: https://github.com/Omaledanjumaogale/PuntersEdge/actions/runs/39630717707.

No improved profitability or accuracy claim is made by the code change alone. Fresh training conclusions and final release checks follow.


## Responsive and synchronization acceptance

The machine browser regression passed at320,390 and1440px with42 varied fixture percentages in descending order, no duplicate event copies, working team Under filter and analysis navigation, and no page errors/overflow. The direction evidence panel passed at390 and1440px, including collapsed defaults, visible regression and insufficient-sample states.

That panel test initially reproduced a real cached-callback issue in betslip sync: registration ran inside a reactive effect, and an immediate callback read and wrote its `ready` state, causing repeated subscriptions. Registration now runs untracked while auth/owner dependencies remain tracked. The identical immediate-callback browser test then passed. The first mock also lacked a mutation method; that test-harness error was corrected before diagnosing the reactive loop. No failed run was treated as acceptance.

## Final evaluation and promotion enforcement

The fresh production evaluation completed using 33,965 retained rows and qualified zero model replacements. Existing serving models were retained; the new reports do not establish an improved strike rate. Selected-direction samples remain too small to substantiate a broad totals advantage. The backend now independently validates all six direction cohorts and recomputes the non-regression gate rather than trusting a submitted boolean. A forged aggregate-success report with a regressing totals cohort is rejected by the backend regression test (26 security tests passed); backend TypeScript checking passed.

The cached-subscription fix and evidence-panel QA shipped in `00079be`; frontend deployment succeeded: https://github.com/Omaledanjumaogale/PuntersEdge/actions/runs/39631391894.

Final backend release `4dc0415` passed application tests, backend tests, backend TypeScript and production deployment: https://github.com/Omaledanjumaogale/PuntersEdge/actions/runs/39632816662. Read-only production browser checks passed at390 and1440px with dark/light theme switching, reduced motion, no horizontal overflow and no page errors. Authenticated machine/evidence interactions were exercised with synthetic local data rather than customer accounts; those are not physical-device acceptance claims.
