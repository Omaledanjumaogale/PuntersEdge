# Football upstream source review

Reviewed 17 October 2026. These are source observations, not reproduced backtests or evidence that any repository beats a bookmaker. Repositories were cloned shallowly outside the application at `../research/upstream/`; no upstream installers, notebooks, training code, models or scrapers were executed. Ordinary repository analysis is separate from the parent investigation's REA artifact/runtime work.

## Pinned sources and licences

| Repository | Inspected commit | Code licence | Evidence |
| --- | --- | --- | --- |
| [georgedouzas/sports-betting](https://github.com/georgedouzas/sports-betting) | `eb4cedf376663fac68f508e50b83fd832e74dfd4` | MIT; Georgios Douzas, 2019 | `LICENSE` |
| [kochlisGit/ProphitBet-Soccer-Bets-Predictor](https://github.com/kochlisGit/ProphitBet-Soccer-Bets-Predictor) | `49fb86be553a62ed714acc1e2d99c73f6dcd27ea` | MIT; Vasileios Kochliaridis, 2024 | `LICENSE.txt` |
| [martineastwood/penaltyblog](https://github.com/martineastwood/penaltyblog) | `6a51173454cba172f2e7b2d8374c1770f257b86a` | MIT; Martin Eastwood, 2021 | `LICENCE` |
| [probberechts/soccerdata](https://github.com/probberechts/soccerdata) | `ad91d050c0fed02e2487cd3201efd6a338ce6b55` | Apache 2.0, with incorporated MIT `footballdata` notice | `LICENSE.rst` |

All links below pin the reviewed commit. Code licensing does not grant rights to every scraped dataset, provider response, trained artifact or bookmaker interaction. Retain applicable copyright/licence notices if copying substantial source. This review copies no implementation.

## Findings and adoption decisions

### sports-betting: availability-aware data contracts and forward evaluation

The package separates `sources`, `dataloaders`, `evaluation`, and `execution`. [Model selection](https://github.com/georgedouzas/sports-betting/blob/eb4cedf376663fac68f508e50b83fd832e74dfd4/src/sportsbet/evaluation/_model_selection.py) sorts rows by date, requires `TimeSeriesSplit`, fits only the training indices, and evaluates future test indices. It reports fold dates, bet counts, yield, ROI, and final cash. [Leakage regression tests](https://github.com/georgedouzas/sports-betting/blob/eb4cedf376663fac68f508e50b83fd832e74dfd4/tests/dataloaders/test_leakage.py) explicitly check that a half-time statistic cannot be paired with a pre-match quoted price; intentionally requesting later information raises an error. Missing form must not silently erase an otherwise valid fixture.

Adopt the invariant: every feature must have been available at the prediction/quote timestamp, not merely before the final whistle. Keep actual observation times, kickoff time, quote time and result availability as separate fields. Preserve no-history fixtures as explicit unavailable/limited-history records. Make grouped date blocks, a settlement embargo and independent calibration windows stronger requirements than a row-based chronological split alone: simultaneous fixtures can straddle a default `TimeSeriesSplit`, and date order does not itself prove result availability.

[OddsComparisonBettor](https://github.com/georgedouzas/sports-betting/blob/eb4cedf376663fac68f508e50b83fd832e74dfd4/src/sportsbet/evaluation/_rules.py) derives consensus probability as reciprocal mean decimal odds minus an `alpha` adjustment. This is a market-derived baseline, not an independent statistical model. Its parameter and apparent return must not be transferred into PuntersEdge as established edge. The repository's browser/API bet execution is outside PuntersEdge's prediction product and is not adopted.

### penaltyblog: consistent market arithmetic from one score distribution

[FootballProbabilityGrid](https://github.com/martineastwood/penaltyblog/blob/6a51173454cba172f2e7b2d8374c1770f257b86a/penaltyblog/models/football_probability_grid.py) normalizes an exact-score matrix, precomputes score/total grids and caches common sums. Winner, draw, double chance, BTTS, team goals, totals and handicap outputs derive from that same distribution. It treats integer lines as pushes and quarter lines as equal half-stakes on adjacent lines. Draw-no-bet probabilities condition on a non-draw; that conditional probability must be distinguished from unconditional probability of winning a stake.

Adopt shared-distribution conservation checks: winner probabilities sum to one; over/under/push sum to one for a single line; complementary handicap sides have consistent settlements; quarter lines retain split-stake settlement semantics. A quarter-line `win` value in this API is an averaged stake fraction across two lines, not necessarily the probability of a full ticket win. PuntersEdge should preserve separate full-win, half-win, push, half-loss and loss states and label its displayed percentage accordingly. Existing PuntersEdge Poisson/Dixon-Coles and count primitives already use a common grid; do not advertise this existing principle as a newly trained improvement.

[DixonColesGoalModel](https://github.com/martineastwood/penaltyblog/blob/6a51173454cba172f2e7b2d8374c1770f257b86a/penaltyblog/models/dixon_coles.py) accepts per-match weights and neutral-venue flags. [dixon_coles_weights](https://github.com/martineastwood/penaltyblog/blob/6a51173454cba172f2e7b2d8374c1770f257b86a/penaltyblog/models/utils.py) supplies exponential date decay. These are challenger features to fit within historical training windows, not constants to copy into all leagues. Initial parameter values are optimizer starting points, not discovered bookmaker coefficients. Negative-binomial and bivariate alternatives exist but their presence is not proof they improve our holdout.

[Implied probability methods](https://github.com/martineastwood/penaltyblog/blob/6a51173454cba172f2e7b2d8374c1770f257b86a/penaltyblog/implied/implied.py) support several margin-removal assumptions. Report sensitivity across reasonable methods on complete mutually exclusive outcomes from a consistent bookmaker snapshot; never normalize a mixture of unrelated best prices and call it that bookmaker's probability. The [backtester](https://github.com/martineastwood/penaltyblog/blob/6a51173454cba172f2e7b2d8374c1770f257b86a/penaltyblog/backtest/backtest.py) exposes only earlier dates as `lookback`; trainer authors still must avoid exposing the current row's final statistics or future quote.

### ProphitBet: useful lagged features; reject shuffled validation as deployment evidence

[StatisticsEngine](https://github.com/kochlisGit/ProphitBet-Soccer-Bets-Predictor/blob/49fb86be553a62ed714acc1e2d99c73f6dcd27ea/src/preprocessing/statistics.py) requires ascending dates, groups by season, and computes previous-match rolling statistics using `shift(1)`. Home/away form and opponent scoring are reasonable challenger features when timestamps establish that the earlier result was known. Fixed row shifts are insufficient for same-day overlapping games, rescheduling, missing event times or delayed publication.

[Trainer](https://github.com/kochlisGit/ProphitBet-Soccer-Bets-Predictor/blob/49fb86be553a62ed714acc1e2d99c73f6dcd27ea/src/models/trainer.py) has two different evaluation paths. Ordinary `cross_validation` uses shuffled `StratifiedKFold`; this mixes past and future and is rejected for prospective sports-performance claims. The sliding path uses [descending date holdouts](https://github.com/kochlisGit/ProphitBet-Soccer-Bets-Predictor/blob/49fb86be553a62ed714acc1e2d99c73f6dcd27ea/src/preprocessing/selection.py), a better starting point that still needs availability embargoes and untouched final evaluation.

[ClassificationModel.fit](https://github.com/kochlisGit/ProphitBet-Soccer-Bets-Predictor/blob/49fb86be553a62ed714acc1e2d99c73f6dcd27ea/src/models/model.py) wraps classifiers with isotonic `CalibratedClassifierCV` without a chronological splitter; preprocessing/sampling happens before that inner split. Do not inherit its calibration protocol. Fit preprocessing on each historical training fold; calibrate on a later untouched window with adequate sample size; evaluate a third later window using Brier/log loss and reliability, not accuracy alone. Its reported metrics are classification accuracy/F1/precision/recall; they are not calibrated probability or profitability evidence. Do not load upstream pickle files.

### soccerdata: stable identities, explicit source boundaries and cache-first acquisition

[BaseReader](https://github.com/probberechts/soccerdata/blob/ad91d050c0fed02e2487cd3201efd6a338ce6b55/soccerdata/_common.py) offers file caching, maximum-age checks, league translation, season handling and configurable request delays. [Configuration](https://github.com/probberechts/soccerdata/blob/ad91d050c0fed02e2487cd3201efd6a338ce6b55/soccerdata/_config.py) centralizes canonical league/source mappings and explicit team-name replacements. [MatchHistory](https://github.com/probberechts/soccerdata/blob/ad91d050c0fed02e2487cd3201efd6a338ce6b55/soccerdata/match_history.py) downloads league/season CSVs, caches completed seasons, refreshes the current season and maps team names.

Adopt auditable source-ID crosswalks, immutable historical cache objects with hashes, bounded current-season refresh, request budgets, attribution and collision detection. Keep large source files/ratings in private R2; keep only small access/metadata records in Convex. Do not copy its fallback missing kickoff time (`12:00`) into a timestamp presented as verified. Keep missing event/observation times explicit and apply conservative exclusions for backtesting. Do not adopt Tor/proxy rotation or scraping as a way around provider limits or unavailable licences. The repository is an acquisition toolkit, not a trained prediction model, and its source support does not prove current endpoint access.

## Acceptance criteria before a challenger affects user probabilities

1. Reproducible training manifest includes source/permission, checksum, observed availability basis and cutoff; no downloaded executable models are loaded.
2. Train, hyperparameter selection, calibration and final evaluation remain chronological and distinct; simultaneous events/results are blocked together and availability embargoes apply.
3. Publish per-sport, league, market family and time-scope sample counts, Brier/log loss, reliability intervals and paired incumbent comparisons. Cluster correlated options by fixture/date rather than treating every option as independent evidence.
4. Compare against bookmaker probability on the same quoted fixture subset and real pre-match snapshots. Without prices, publish a projection; do not claim demonstrated price edge or simulate a purchased price.
5. Candidate promotion requires improvement on untouched data with uncertainty, no material market-family regression, settlement parity, and no fabricated input values. A model that does not pass is retained as a documented research challenger.

None of the inspected repositories establishes PuntersEdge's future accuracy, ROI, safe staking amount or recovery of previous losses. No externally quoted repository performance was reproduced in this review.
