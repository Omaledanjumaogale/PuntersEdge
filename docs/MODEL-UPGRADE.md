# Evidence-gated models and evaluation

This upgrade repairs market semantics and adds model training/registry integration. It does not establish an advantage over bookmaker prices. The repository includes fitted score-only candidates for Premier League football, NBA, EuroLeague, NHL and MLB; every candidate remains unapproved. Tennis's exact standard-format scoring engine is available offline under training/model, with no tennis provider, UI or live settlement integration.

## Behavior

Production inputs always carry model-evidence state. No validated segment, missing independent strengths, missing/stale source quote timestamps, unsupported domain or live-state use yields PASS and zero stake. Existing probabilities and informational markets remain visible. Grades and analytical-agent agreement are not historical confidence ratings. The quote gate uses source updates within fifteen minutes, distinct from retrieval time; providers that omit updates cannot supply eligible quoted verdicts. The Odds API and API-Sports parser retain their supplied update fields. OddsPapi timestamps are unknown until an explicitly verified provider field is implemented.

Integer basketball totals/spreads use a discretized-normal approximation with explicit win/push/loss. Hockey integer totals exclude push outcomes from under wins and use conditional probabilities for pricing. Regulation hockey 1X2 is separate from final moneyline. Fitted baseball candidates use a full-final-score negative-binomial distribution conditioned on no tie, avoiding the baseline's single-extra-run resolver. Baseline assumptions remain unvalidated.

Generative commentary is disabled by default: the subscription-protected explanation action returns a deterministic account of supplied facts and missing evidence. ALLOW_GENERATIVE_EXPLANATIONS=true restores the existing optional LLM path; that path cannot be guaranteed hallucination-free. No LLM trains or changes numeric probabilities. Existing free-model-only AIHubMix restrictions remain.

## Model registry

NHL fitted artifacts also use full-final-score conditioning without adding another overtime goal. They suppress regulation markets because training used final scores. Regulation-specific fitting requires actual period scores.

An administrator can import immutable JSON at /admin/models. The backend validates identity, past training cutoff, mapped team coefficients, finite parameters and supported dispersion. Import starts in shadow mode. Activation uses the fitted input for prospective forecasts and retires previous active candidates for that sport/league; it never grants approval or stakes. Retiring restores the baseline. There is deliberately no UI approval shortcut: promotion requires further chronological market-relative and prospective evidence and a reviewed promotion implementation.

Feed ingest reads active model artifacts. Clients receive the same fitted inputs and fixed candidate ensemble weight. Exact provider team IDs and league labels must match. Unseen teams fall back to an explicitly unapproved baseline; never invent their strength. Register NBA/basketball home/away point regressions with fitted margin/total dispersion; these are score baselines, not possession models. No claim of learned injury, goalie or starter-pitcher impact is made.

## History and evaluation

Full publications are stored as separate immutable compressed blobs under forecast_publications. Scheduler arguments contain storage IDs rather than serialized histories; the serving-store publication list contains at most 200 small identities. Protected publication lookup preserves prior inputs and artifact identity. Historical views reapply current eligibility gates and cannot reactivate old stakes.

v3 snapshot publications retain prior forecast/selection records and evaluate the latest actually published pre-kickoff snapshot. v2 records remain frozen. Push, unconditional win/loss and quote/evidence metadata are retained. Seven-day local correction retention is separate from twelve-hour UI review; longer durable correction reconciliation remains a follow-up. The existing aggregate Wilson interval still counts dependent market rows and should not be interpreted as independent-fixture statistical evidence.

Local training assets:

- training/model/train.py: genuine CSV Dixon-Coles likelihood fitting and pre-kickoff walk-forward evaluator.
- training/benchmark.py: fixed score-only attack/defence regression, chronological 60% train/20% calibration/20% holdout, historical availability assumed kickoff plus 48 hours. No random splitting or holdout tuning.
- training/artifacts/: full-history refits for future shadow forecasts, not the parameters used to score the earlier holdout. No held-out calibration claim is transferred to a refitted model.
- training/reports/: raw/calibrated proper scores, denominators, high-probability filter coverage and comparisons. Small production cohorts cannot justify promotion.
- scripts/compare-champion.mjs: reconstructed table/standings proxy on matched holdout fixtures; not replay of production settings or historical quotes.
- scripts/compare-production-history.mjs: original frozen verdict comparison only for exact-name league/team mappings with earlier model cutoff.

Raw provider responses, credentials and exported subscriber archives stay under ignored training/private and .env.local. No data is fabricated. Historical odds and publication timestamps were unavailable, so no executable ROI, CLV or bookmaker-relative accuracy is reported. Temperature calibration degraded several held-out results; do not promote based on a high strike-rate subgroup alone.

## Quotas and running

Provider limits remain 100 daily per sport with 10 reserved, OddsPapi 250 monthly with 10 reserved, and The Odds API 500 monthly with 12 reserved; monthly budgets divide capacity across remaining days and reconcile provider headers. Existing ingest reserves durable quota before network requests. Research requests were bounded and cached; no historical odds credits were consumed. Collection scripts are offline tools, not scheduled production jobs; reruns skip cached responses. Coordinate manual collection with live ingest and preserve at least thirty API-Sports requests per sport.

Install Python requirements, then run python training/benchmark.py only with the private provider responses. Run node scripts/compare-champion.mjs afterward. CSV tooling and exact tennis format limitations are in training/model/README.md. Use npm test, npm run check, npm run check:backend, npm run test:backend, npm run build and Python correctness tests before release.

Measured results are in TRAINING-RESULTS.md. No production rollout or guaranteed strike-rate claim is implied by mathematical tests or a successful build.
