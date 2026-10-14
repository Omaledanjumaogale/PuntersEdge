# Standalone candidate probability engine

`engine.py` uses Python's standard library. Football fitting in `train.py` additionally requires SciPy. These candidates have no demonstrated strike rate until evaluated on genuine historical data. The training tests use synthetic unit fixtures solely to check correctness.

Run checks from the workspace root:

```powershell
python -m unittest discover -s model -v
```

Supply a UTF-8 CSV of genuine completed football fixtures with this header:

```csv
fixture_id,league,home,away,kickoff,available_at,home_goals,away_goals,odds_snapshot_at
```

`available_at` means the timestamp when the **final result** became available. All timestamps require timezone offsets, such as `2026-01-01T12:00:00Z`. Team identifiers must exactly match the application identifiers. Duplicate fixtures, negative scores, naive timestamps, result availability before kickoff and post-kickoff odds snapshots are rejected. `odds_snapshot_at` is optional; evaluation rejects supplied odds snapshots later than the prediction horizon. Odds values are not used by this fitter, and no ROI is calculated.

Train one league and export parameters to the application's JS-compatible schema:

```powershell
python model/train.py train --csv real-results.csv --league EPL --cutoff 2026-07-01T00:00:00Z --version candidate-1 --output candidate-1.json
```

The command filters training rows to results strictly available before the cutoff. Output contains `version`, `league`, `trainedThrough`, `intercept`, `homeAdvantage`, `rho` and `teams`, where each team identifier maps to `{ "attack": number, "defence": number }`. Additional metadata records sample count and fixed hyperparameters. `validated` and `calibrated` remain false. `trainedThrough` is the cutoff and must be strictly **earlier** than a future inference's `predictionAt`; use a prior cutoff when making same-day predictions. There is no fitted calibrator in this module.

Evaluate a genuine latest holdout with expanding-window retraining:

```powershell
python model/train.py evaluate --csv real-results.csv --league EPL --holdout-start 2026-08-01T00:00:00Z --horizon-minutes 60 --min-training 50 --output holdout.json
```

Every forecast is timestamped sixty minutes before kickoff by default. Each refit admits only results whose kickoff and final-result availability strictly precede that timestamp. The report provides full scored predictions, skips, multiclass Brier score (sum across the three outcomes, range 0–2) and log loss. It contains no tuple-keyed grids. Unknown teams and failed fits are skipped with explicit reasons. Models can learn from earlier holdout results only after those results become available, matching an expanding-window operational policy.

Fix penalty, time decay and all selection thresholds using separate earlier training/validation periods. Reserve another earlier window for an external calibrator. Freeze these decisions before the latest holdout; the evaluator does not enforce or invent those upstream experiment decisions. Compare holdout scores with bookmaker and simple historical baselines, assess calibration and subgroup sample sizes, and run prospective shadow predictions before enabling recommendations.

Scope limits: football uses a Dixon–Coles low-score correction; basketball uses continuous normal approximations without discrete pushes; hockey/baseball count outputs concern regulation only; tennis assumes independent constant serve-point probabilities and standard advantage games with a seven-point win-by-two tiebreak at six-all in every set. Special formats, retirements, overtime and shootouts require separate models. Probability outputs and operational confidence gates are separate; the default gate abstains.
