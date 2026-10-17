# Valuebetennis results-only tennis challenger

Attribution: Valuebetennis, *Résultats et cotes de tennis depuis 2021*, https://www.valuebetennis.com/donnees.htm . The source explicitly publishes these season CSVs under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), including commercial use with attribution. We download and retain its licence notice and the CC licence page alongside source hashes. This is not permission to use unrelated non-commercial corpora. Backend-only processing does not itself establish non-commercial use.

Run `python training/tennis_results.py fetch`, then `python training/tennis_results.py train`. Raw files and fitted parameters live under ignored `training/private/valuebetennis/`; `scripts/tennis-results.mjs restore|store` keeps them in private R2. Only small reports pass through Convex. The daily tennis job restores old source snapshots, refreshes the 2026 CSV, evaluates the candidate and retains the updated source hashes and fitted tables. Public sports-provider credits are not used by this download or training.

The downloaded seasons contain 467,343 raw records (2021–2026), approximately 71.5 MB including licence snapshots. The parser accepts 260,072 records and excludes 207,271 duplicate, unsupported, incomplete, inconsistent or future records. Missing/retired/walkover scorelines, unsupported surfaces and nonstandard sets are excluded. This covers men's and women's singles across several event tiers, including ITF and Challenger; ATP/WTA labels follow the source's `genre` field and do not mean main-tour-only coverage.

The candidate uses separate men's/women's and match/first-set Elo ratings, K=24, 50% global plus 50% surface strength, and requires ten prior labelled matches for both players. IDs are canonicalized without sorting by winner. Match scores are labels only; current-match outcomes never enter that match's prediction. No service-point counts are inferred. Initial history is 2021–2023, calibration uses 2024 only, and evaluation uses 2025–2026 in order. Earlier evaluation-period results may update later ratings after a seven-day delay; the 2024 calibrator remains frozen.

The export lacks actual completion/publication and odds-observation timestamps. The seven-day delay is an explicitly assumed retrospective scenario, not a claim that results or odds were historically available at those times. These are not prospective or executable-price betting results.

## Measured 2026 results

| Source cohort | Market | Evaluated matches | Calibrated accuracy | Calibrated Brier |
| --- | --- | ---: | ---: | ---: |
| Men's singles | Match winner | 10,998 | 65.62% | 0.2145 |
| Women's singles | Match winner | 7,479 | 66.83% | 0.2084 |
| Men's singles | First-set winner | 10,998 | 62.17% | 0.2286 |
| Women's singles | First-set winner | 7,479 | 62.87% | 0.2247 |

On the identical subset with opening odds, the candidate does **not** outperform the no-margin bookmaker benchmark: men's Brier 0.2158 versus 0.1967 across 9,804 matches; women's 0.2137 versus 0.1909 across 6,118 matches (lower is better). First-set odds were not supplied, so match-winner odds are not misused as their benchmark. These measured limitations prevent a claim that this candidate beats bookmakers. There is no ROI or guaranteed strike-rate claim.

`training/reports/tennis-results-research.json` contains the raw/calibrated scores, calibration errors, matched-subset comparisons and 2025 results. The source fingerprint manifest is retained beside that report. The admin Model Registry displays the report separately from the service-point engine and old UCI experiment. Live tennis markets remain disabled pending prospective validation, identity mapping, fresh quotes and provider-specific settlement acceptance.

## Market add-control verification

`scripts/qa-market-buttons.mjs` runs against a local Vite server using clearly synthetic fixture data. Install Playwright separately or set `PLAYWRIGHT_MODULE` to an available runtime's `index.js`. It verifies real add/remove button actions, local betslip persistence, missing-price protection, 44px touch targets, collapsed accordions, descending model probabilities and no horizontal overflow at 320/390/1440px. It does not authenticate or write production tickets.
