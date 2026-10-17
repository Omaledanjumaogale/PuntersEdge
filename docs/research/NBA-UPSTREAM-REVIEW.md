# NBA and multi-sport upstream source review

Reviewed 17 October 2026. These are source inspections, not executions or independent replications of upstream performance. No upstream model, dataset, dependency installer or training script was executed. No upstream code was copied into PuntersEdge.

## Pinned sources and reuse boundary

| Repository | Inspected commit | Licence found at this revision | Decision |
| --- | --- | --- | --- |
| [NBA-Betting/NBA_Betting](https://github.com/NBA-Betting/NBA_Betting/tree/2cf683b3edfa1ae89aa824289645d479574fd185) | `2cf683b3edfa1ae89aa824289645d479574fd185` | MIT (`LICENSE`) | Architectural ideas are useful; preserve MIT notice if code is later adapted. |
| [day-mon/sports-betting-ai](https://github.com/day-mon/sports-betting-ai/tree/200445470ba59ffcb5fc9d447c58853cfdf128d8) | `200445470ba59ffcb5fc9d447c58853cfdf128d8` | No licence file located in the recursive tree | Study concepts only; do not copy code, assets or weights without permission. |
| [kyleskom/NBA-Machine-Learning-Sports-Betting](https://github.com/kyleskom/NBA-Machine-Learning-Sports-Betting/tree/8e36b0b72ecc5082aa8976dff742cdf910b3aa36) | `8e36b0b72ecc5082aa8976dff742cdf910b3aa36` | No licence file located in the recursive tree | Independently implement established statistical methods; do not copy code, weights or data without permission. |
| [JamesQuintero/Sports-Odds-Algorithms](https://github.com/JamesQuintero/Sports-Odds-Algorithms/tree/39aa75b05efd1fdaf60406da305944d43056f5c1) | `39aa75b05efd1fdaf60406da305944d43056f5c1` | No licence file located in the recursive tree | Do not copy source or fitted polynomial constants. |

The first repository was shallow-cloned. The other three clones stalled while fetching larger histories/artifacts and were stopped; the pinned GitHub API trees and selected raw source files were inspected instead. This is not a claim of exhaustive inspection of every file. Public availability alone does not grant redistribution rights. A software licence also does not establish rights to NBA, sportsbook or scraped historical data.

## NBA-Betting/NBA_Betting

**Architecture observed.** SQLite/SQLAlchemy collection and feature snapshots feed AutoGluon classification and regression, with Flask/Dash presentation. The public repository is archived. `src/etl/feature_creation.py` computes rest differences, season phase, shifted rolling performance and home/away differences. `src/predictions/generator.py` selects a model whose training cutoff precedes the requested date and distinguishes independent `standard` and market-informed `vegas` variants.

Useful primary evidence:

- [Feature construction](https://github.com/NBA-Betting/NBA_Betting/blob/2cf683b3edfa1ae89aa824289645d479574fd185/src/etl/feature_creation.py): rolling and expanding statistics use `shift(1)`; rest differences and separate season windows are explicit.
- [Training utilities](https://github.com/NBA-Betting/NBA_Betting/blob/2cf683b3edfa1ae89aa824289645d479574fd185/src/utils/modeling_utils.py): train/test date ranges, home/majority baselines and market-margin regression baseline are explicit. Overlapping ranges produce a warning rather than an exception.
- [Trainer](https://github.com/NBA-Betting/NBA_Betting/blob/2cf683b3edfa1ae89aa824289645d479574fd185/src/modeling/trainer.py): classification optimizes accuracy; regression optimizes mean absolute error. The inspected evaluation reports accuracy, precision and recall. This does not establish calibrated betting probabilities.
- [Prediction generation](https://github.com/NBA-Betting/NBA_Betting/blob/2cf683b3edfa1ae89aa824289645d479574fd185/src/predictions/generator.py): prediction dates are screened against training end dates, but persistence uses `INSERT OR REPLACE` keyed by game/model variant. A regenerated historical prediction can overwrite its earlier timestamp and price; that pattern is unsuitable for PuntersEdge's immutable pre-match performance record.

**Adopt as independently tested requirements:** point-in-time rest and form features; explicit independent versus market-informed labels; frozen training cutoff routing; same-cohort baselines. **Do not adopt unchanged:** warning-only overlap handling, accuracy as the sole selection objective, replacing original published records, or generic assumed-payout ROI utilities. Actual bookmaker prices, prediction timestamps, settlement rules and quote availability must govern economic evaluation.

## kyleskom/NBA-Machine-Learning-Sports-Betting

**Architecture observed.** Daily NBA team-stat and sportsbook snapshots are joined in SQLite; separate moneyline and three-class totals models produce predictions, expected-value calculations and optional Kelly sizing. Current code is more developed than older descriptions of a single neural-network model.

- [Moneyline XGBoost training](https://github.com/kyleskom/NBA-Machine-Learning-Sports-Betting/blob/8e36b0b72ecc5082aa8976dff742cdf910b3aa36/src/Train-Models/XGBoost_Model_ML.py): sorts by `Date` when present, reserves the last 10% as test data, tunes with `TimeSeriesSplit` and validation log loss, then fits optional sigmoid/isotonic calibration on a trailing calibration slice. A separate calibration artifact is saved.
- [Totals XGBoost training](https://github.com/kyleskom/NBA-Machine-Learning-Sports-Betting/blob/8e36b0b72ecc5082aa8976dff742cdf910b3aa36/src/Train-Models/XGBoost_Model_UO.py): explicitly models under/over/push, retains the offered total line as a feature and removes the final score/target columns.
- [Current neural training](https://github.com/kyleskom/NBA-Machine-Learning-Sports-Betting/blob/8e36b0b72ecc5082aa8976dff742cdf910b3aa36/src/Train-Models/NN_Model_ML.py): sequential training/validation/test slices, validation-based model selection and an unseen final evaluation. Do not assume its current source still uses the random train/test split found in older versions elsewhere.
- [Game dataset construction](https://github.com/kyleskom/NBA-Machine-Learning-Sports-Betting/blob/8e36b0b72ecc5082aa8976dff742cdf910b3aa36/src/Process-Data/Create_Games.py): matches a game's date to a dated team table, adds rest days, final-score labels and the sportsbook total. Date matching alone does not prove that the snapshot excluded the target game's statistics or that a historical total was available when the recommendation would have been made.
- [Snapshot acquisition](https://github.com/kyleskom/NBA-Machine-Learning-Sports-Betting/blob/8e36b0b72ecc5082aa8976dff742cdf910b3aa36/src/Process-Data/Get_Data.py): formats a configured NBA endpoint for each date. The exact endpoint's date bounds and actual collection times require separate verification before treating its historical database as point-in-time safe.

**Adopt independently:** chronological selection, proper scoring rules, distinct calibration artifacts, explicit push outcomes and line-conditioned totals. **Strengthen:** require valid dates rather than sorting only when available; split by fixture/date group, use result-availability gaps, keep calibration separate from early-stopping selection, persist feature order and source/model hashes, and compare predictions to the same timestamped quote cohort. A Kelly formula cannot repair uncalibrated probabilities, stale quotes or uncertain settlement. Upstream accuracy and serialized filenames are not PuntersEdge performance evidence.

## day-mon/sports-betting-ai (Accuribet)

**Architecture observed.** Python/TensorFlow training, Rust/Actix inference, Postgres history, Redis caching and a SolidJS/Tailwind frontend. The README describes an academic project and approximately 60% test accuracy; that is an upstream claim, not a reproducible edge demonstration.

- [Training script](https://github.com/day-mon/sports-betting-ai/blob/200445470ba59ffcb5fc9d447c58853cfdf128d8/AI/train_model.py): shuffles all rows using `sample(frac=1)`, removes dates and labels from features, uses an 80/20 split, and trains a large dense softmax network for 500 epochs. No separate time-ordered calibration or validation period is shown. Randomly mixing seasons can make retrospective accuracy a poor estimate of future performance.
- [Inference helper](https://github.com/day-mon/sports-betting-ai/blob/200445470ba59ffcb5fc9d447c58853cfdf128d8/API/src/util/nn_helper.rs): loads a TensorFlow SavedModel inside the per-row loop; parse failures become zero; the maximum softmax output is returned as confidence. Neither a high softmax score nor substituted zeros establishes an honest probability.
- [API orchestration](https://github.com/day-mon/sports-betting-ai/blob/200445470ba59ffcb5fc9d447c58853cfdf128d8/API/src/routes/nn.rs): caches predictions by model, game IDs and date. Injury retrieval can fail while basic fixtures remain available.

**Adopt conceptually:** prediction caching, fixture identity, graceful separation of missing enrichment from fixture availability. PuntersEdge's existing scheduled R2 snapshots better suit its free-tier budget than introducing another hosted inference service. **Reject:** randomized temporal evaluation, zero-filled invalid features, raw softmax confidence as calibrated truth and loading a large model for every fixture row. Do not copy the unlicensed implementation or its design assets.

## JamesQuintero/Sports-Odds-Algorithms

**Architecture observed.** Python scraping, team-form summaries, hand-weighted scores and fixed polynomial transforms for NBA/NHL/MLB, with historical CSV/strategy simulation. This is a heuristic system rather than a modern fitted probability model.

- [Algorithm](https://github.com/JamesQuintero/Sports-Odds-Algorithms/blob/39aa75b05efd1fdaf60406da305944d43056f5c1/algo.py): `calculate_V2` maps hand-scaled form variables into fixed quadratic/cubic expressions; constants differ by league. Averaging related form indicators does not make the resulting number a calibrated probability.
- [Backtester](https://github.com/JamesQuintero/Sports-Odds-Algorithms/blob/39aa75b05efd1fdaf60406da305944d43056f5c1/backtester.py): iterates historical dates and compares a selected algorithm to results/odds. A date-loop is useful but does not itself prove separate coefficient selection, unseen testing or historical quote availability.
- [Documented fitting process](https://github.com/JamesQuintero/Sports-Odds-Algorithms/blob/39aa75b05efd1fdaf60406da305944d43056f5c1/README.md): describes tuning variable levels against backtests, then hardcoding fitted polynomial relationships. Without a held-out period this introduces selection optimism.

**Adopt conceptually:** readable form-factor explanations and date-by-date replay. **Reject:** importing polynomial constants, unverified percentage labels, selecting a strategy and reporting its success on the same backtest, or extrapolating past playoff anecdotes into future profitability. Source licensing and scraped-data rights are unresolved at the inspected revision.

## Integration priorities for PuntersEdge

1. Keep immutable, timestamped pre-match predictions and the exact quotes used. Never regenerate old recommendations and count them as original forecasts.
2. Evaluate each sport/market/line on chronological train, calibration and test windows with explicit availability gaps. A totals model is conditional on its actual line; winner accuracy cannot validate totals or handicaps.
3. Publish accuracy alongside Brier score, log loss, sample counts, calibration buckets and matched bookmaker baselines. Use uncertainty intervals before interpreting apparent improvements.
4. Distinguish independent forecasts, market-informed forecasts and quoted-price value. Unpriced selections may remain selectable, but cannot demonstrate positive expected value or a full quoted accumulator payout.
5. Keep scheduled training and bulk artifacts outside request-serving Convex/Workers hot paths. Cache compact published projections; retraining does not belong in a fixture page request.
6. Promote challengers only after a reproducible improvement on untouched data. The existence of these repositories supplies research directions, not trained-model superiority or profit guarantees.
