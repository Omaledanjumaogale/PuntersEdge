# Tennis training and validation status

Live tennis recommendations are **not validated**. A scoring formula, passing software tests and a small historical accuracy number cannot substitute for current out-of-sample evidence. Owner authorization to enable tennis is recorded; the missing requirement is measured model and data quality, not further approval.

## Provider observations on 17 October 2026

- API-Sports' official product catalogue does not list a tennis API: https://api-sports.io/ . No invented tennis hostname is used.
- The deployed The Odds API account accepted `/v4/sports?all=true` with `x-requests-last: 0`: 47 tennis competition keys. The documentation says sports and events discovery are quota-free: https://the-odds-api.com/liveapi/guides/v4/ . The separate tennis coverage page describes winner odds and limited game totals/spreads; paid history is not a service-point training dataset: https://the-odds-api.com/sports/tennis-odds.html .
- The deployed OddsPapi account reports 250 monthly requests and tennis sport ID 12. Two individually reserved calls were used: one fixtures response returned 1,968 records from 1–8 October; one completed-match score response returned `result`, `p1`, `p2` and `fulltime` set/game scores. Neither returned service-point counts. No result was relabelled a service statistic. Account and usage responses remain private.
- OddsPapi v4 scores are per fixture; large historical result collection would consume the shared allowance: https://oddspapi.io/us/docs/get-scores . Its v4 history endpoint supplies prices, not player serve counts: https://oddspapi.io/us/docs/get-historical-odds .

The Odds API application budget was lowered to the owner's 250-credit monthly ceiling (238 spendable after reserve), even when its account reports a larger plan. OddsPapi remains capped at 250 (240 after reserve). Discovery does not fetch odds, scores or historical prices and stops if a discovery endpoint reports a charge.

## Actual historical training experiment

Source: Shruti Jauhari, Aniket Morankar and Ernest Fokoue (2014), *Tennis Major Tournament Match Statistics*, UCI Machine Learning Repository, DOI https://doi.org/10.24432/C54C7K , CC BY 4.0. Source and archive: https://archive.ics.uci.edu/dataset/300/tennis+major+tournament+match+statistics . Changes: normalized alternate final-score column names; derived service-point denominators from service points won and opponent total points won; excluded incomplete records and retirements. No raw data is committed.

Run `python training/tennis_research.py` with the original archive at `training/private/uci-tennis.zip`. The committed report records Australian/French training, Wimbledon calibration and US Open evaluation blocks. Artificial block-order tokens are only ordering identifiers; they are not fabricated historical match timestamps. Parameters fitted on 235 eligible men's and 251 women's training matches. Only 20 men's test fixtures met the player-history thresholds: winner Brier 0.2298, log loss 0.6464; first-set winner Brier 0.2546, log loss 0.6997. No women's test forecasts qualified. Wimbledon total-point fields are blank, preventing calibration. Some women's first-set headings are duplicated/mislabelled and are not guessed. These 2013 results do not validate a 2026 model, a profitable price or a strike-rate promise.

## Additional public-source assessment on 17 October 2026

Valuebetennis publishes annual results CSVs and advertises CC BY 4.0 commercial reuse: https://www.valuebetennis.com/donnees.htm . The downloaded 2026 file contains 70,086 rows, 51,076 populated score fields, 41,987 opening-odds pairs and only 1,698 duration values. SHA-256: `aafbaccc400e96001365e001cf968f43361e5cb9961f252e31fbcba5016482ef`. It has no service-point counts or result-availability timestamps. Its methodology also cites tennis-data.co.uk and Jeff Sackmann, so source provenance needs clarification before production reuse: https://www.valuebetennis.com/methodologie.htm . This file is quarantined locally; it is not fitted, uploaded or presented as licensed point-stat history. A results-based rating model would be a separate candidate, not a substitute dataset silently fed to the point model.

Live Tennis API's current public academic page expressly limits the free full dataset to non-commercial academic research and teaching: https://livetennisapi.com/data/academic . Its Zenodo public sample has timestamp corrections in version 1.0.2 and warns about partial point tapes: https://zenodo.org/records/23018680 . Its free API covers scores/fixtures, while completed point history is on a paid plan: https://livetennisapi.com/tennis-live-data-api . No paid plan was purchased, no academic exemption assumed and no new account or provider contact created.

## Connected implementation details

- Private administrator R2 upload accepts source/license metadata and up to 5,000 rows / 8 MB. Raw history and fitted artifacts stay in R2; Convex holds a compact report.
- Daily workflow discovers up to two active tournament schedules through quota-free endpoints, loads private history, fits player serve/return models with surface weighting, evaluates chronological raw/calibrated probabilities and publishes private admin evidence.
- Actual result availability precedes every fitted cutoff. Calibration uses earlier results only; evaluation uses a separate final chronological block. No current-match service statistics enter that match's forecast. Unknown first server is marginalized; known-server input must itself predate prediction time. Player ordering is canonicalized to avoid winner-first file leakage.
- Settlement supports match/first-set winners, match/first-set game totals and game handicaps, including integer refunds and Asian quarter lines. Retirement policy must be supplied explicitly; unsupported final-set rules and incomplete scores abstain. Set-by-set provider normalization does not infer rules or service points.
- Existing five-sport serving models, public tennis markets and betslip types are not changed by the shadow report. No live activation path can be triggered by the dataset upload or research benchmark.

## Dataset contract

The JSON contains `license: {source, name, commercialUseApproved: true}` and a `rows` list. Each row requires stable string `id`, `playerA`, `playerB`; actual millisecond `startedAt`, `completedAt`, `availableAt`; `status: completed`; `surface: hard|clay|grass`; `tour: ATP|WTA`; `bestOf: 3|5`; `rules: standard_singles_7_point_tiebreak_each_set`; `serveA` and `serveB` containing integer `won` and `total`; and `winner: a|b`. Optional `firstSetWinner` supports that market's labels. Retired, walkover and unsupported-format rows are excluded. The UI confirmation does not itself establish source rights; the operator must have the stated permission.

## Remaining before live publication

Obtain recent, licensed service/return histories and reliably mapped player IDs; verified event formats and bookmaker retirement rules; fresh executable quotes; independent chronological calibration and at least 100 held-out forecasts per market, plus prospective monitoring. Passing the minimum sample threshold alone is not approval: baseline comparison, calibration error, uncertainty, quote freshness and settlement/provider acceptance must be reviewed. The daily job must report waiting rather than invent missing data. No profitability claim is made.
