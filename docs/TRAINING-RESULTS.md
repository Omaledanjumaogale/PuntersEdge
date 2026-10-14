# Real-data candidate results — 14 October 2026

All candidates are unapproved. No bookmaker-beating claim is supported. Data came from the authorized API-Sports account; raw responses and production archive remain ignored locally. Final-score publication times were unavailable, so the experiment assumes outcomes became available 48 hours after kickoff. It is a retrospective score-only baseline, not an as-of injury/lineup dataset. Fixed regularization and a 180-day half-life were used; no hyperparameter was selected on the latest holdout.

| Sport / competition | Scored holdout | Candidate winner strike rate | Historical-frequency baseline | Reconstructed app baseline |
|---|---:|---:|---:|---:|
| Football / Premier League | 208 | 45.67% | 39.90% | 48.08% |
| NBA | 556 | 65.47% | 54.68% | 63.85% |
| Basketball / EuroLeague | 133 | 72.93% | 64.66% | 72.18% |
| Hockey / NHL | 604 | 56.95% | 58.44% | 56.79% |
| Baseball / MLB | 1,156 | 54.33% | 51.38% | 53.37% |

These are most-probable-outcome accuracies, not profits or selected-bet strike rates. Football omitted 23 holdout fixtures with unseen teams. The reconstructed application baseline uses the same earlier results and fixed tables/standings, no historical odds, and therefore is not a reproduction of the actual production champion. NHL's candidate loses to the simple favourite-side frequency baseline on strike rate. Football loses to the reconstructed app baseline on strike rate; it cannot be marketed as an across-the-board improvement.

| ≥70% calibrated probability subset | Wins / selections | Coverage of scored holdout |
|---|---:|---:|
| Football | 19 / 31 | 14.90% |
| NBA | 80 / 95 | 17.09% |
| EuroLeague | 11 / 12 | 9.02% |
| NHL | 10 / 11 | 1.82% |
| MLB | 4 / 6 | 0.52% |

The threshold was fixed at 70%; it was not optimized on the holdout. Small subgroups have substantial uncertainty and reduced coverage. Football's 70% bucket realized only 61.3%, highlighting calibration weakness. A high strike rate on eleven or twelve games is insufficient to promise future wins. Decimal odds were unavailable; these subgroups may have negative expected return even if their strike rate is high.

Temperature calibration was fitted only on the middle chronological period. It worsened held-out Brier/log loss for football, NBA, EuroLeague and NHL; only MLB showed a small improvement. Raw and calibrated scores are both retained in training/reports. Full-history refits for future shadow use are not automatically calibrated; they intentionally carry validated=false and calibrated=false.

The production archive export contained 248 snapshots, 73 settled: football 136, NBA 31, basketball 41, hockey 35, baseball 5. On original frozen verdicts, exact-name league/team mapping permitted only one EuroLeague, three hockey and one baseball comparison. Candidate Brier scores were worse in those tiny cohorts. This does not establish either superiority or reliable inferiority; it does block a credible improvement claim.

No historical bookmaker quote dataset was downloaded, so no paired market proper-score comparison, executable ROI, CLV, exchange costs or money movement is claimed. NBA/NHL/MLB responses include provider-returned season phases; phase-specific validation is still required. Mean/dispersion models omit lineup, goalie, pitcher, possession and weather data. Football uses a Poisson score candidate (rho=0) in this benchmark; the more general fitted Dixon-Coles trainer is supplied separately.

API-Sports collection used one status and one 2024 history request per sport, five older-season requests, one basketball league lookup and two corrected basketball season requests. The initial football credential probe used one additional status request. Cached responses prevent repeated collection. No OddsPapi or The Odds API credits were consumed by this experiment. The existing live quota budget retains its reserves and monthly pacing.

Promotion requires timestamped executable odds, source-provenance features, broader exact-ID mapping, fixture/block uncertainty analysis and prospective shadow evidence. Existing model probabilities remain estimates; none of these results justifies describing every punter as a champion.
