# Multi-market historical backtests

These are chronological score-distribution evaluations, not evidence of profitable betting or improved live performance. The first 60% of each scoped dataset trains the model; the last 20% is untouched evaluation. A 48-hour result-availability assumption separates training from future fixtures. Periods are trained independently from observed period scores. Missing periods are excluded, never replaced by zero. Full-game NHL and MLB tied finals are excluded to match the decisive-final score model; observed period ties are retained. The middle 20% is unused for this experiment.

Total and team lines vary by fixture: floor of its earlier-fitted predicted score plus 0.5. Offsets are fixed in advance. These are theoretical lines without historical bookmaker prices. Handicaps use fixed lines, including quarter Asian lines; full win, half win, push, half loss and loss are scored separately. Brier here is the five-state sum of squared errors and differs from the binary Brier in the winner report. Rows within a fixture are dependent; do not count them as independent games.

The table shows every supported scope at the central total/team lines and one predefined handicap, including weak results. High-probability results count only full wins when the model assigned at least 70% outright-win probability. A high strike rate on an easy line can carry a low payout and does not demonstrate an edge.

| Sport | Scope | Market policy | Full wins / fixtures | Strike rate | Five-state Brier | Full wins / >=70% subset |
|---|---|---|---|---|---|---|
| baseball | first_five | total over offset +0 | 459/1172 | 39.2% | 0.476 | 0/0 |
| baseball | first_five | home over offset +0 | 454/1172 | 38.7% | 0.478 | 0/0 |
| baseball | first_five | away over offset +0 | 447/1172 | 38.1% | 0.472 | 0/0 |
| baseball | first_five | handicap home -0.25 | 511/1172 | 43.6% | 0.612 | 0/0 |
| baseball | first_inning | total over offset +0 | 390/1172 | 33.3% | 0.428 | 0/0 |
| baseball | first_inning | home over offset +0 | 342/1172 | 29.2% | 0.420 | 0/0 |
| baseball | first_inning | away over offset +0 | 319/1172 | 27.2% | 0.401 | 0/0 |
| baseball | first_inning | handicap home -0.25 | 284/1172 | 24.2% | 0.608 | 0/0 |
| baseball | full | total over offset +0 | 462/1156 | 40.0% | 0.489 | 0/0 |
| baseball | full | home over offset +0 | 451/1156 | 39.0% | 0.484 | 0/0 |
| baseball | full | away over offset +0 | 465/1156 | 40.2% | 0.482 | 0/0 |
| baseball | full | handicap home -0.25 | 594/1156 | 51.4% | 0.493 | 2/3 |
| basketball | first_half | total over offset +0 | 81/133 | 60.9% | 0.499 | 0/0 |
| basketball | first_half | home over offset +0 | 74/133 | 55.6% | 0.498 | 0/0 |
| basketball | first_half | away over offset +0 | 73/133 | 54.9% | 0.502 | 0/0 |
| basketball | first_half | handicap home +0 | 75/133 | 56.4% | 0.476 | 9/12 |
| basketball | first_quarter | total over offset +0 | 78/133 | 58.6% | 0.499 | 0/0 |
| basketball | first_quarter | home over offset +0 | 75/133 | 56.4% | 0.502 | 0/0 |
| basketball | first_quarter | away over offset +0 | 75/133 | 56.4% | 0.496 | 0/0 |
| basketball | first_quarter | handicap home +0 | 71/133 | 53.4% | 0.547 | 6/9 |
| basketball | full | total over offset +0 | 81/133 | 60.9% | 0.501 | 0/0 |
| basketball | full | home over offset +0 | 81/133 | 60.9% | 0.499 | 0/0 |
| basketball | full | away over offset +0 | 79/133 | 59.4% | 0.502 | 0/0 |
| basketball | full | handicap home +0 | 86/133 | 64.7% | 0.391 | 28/35 |
| football | first_half | total over offset +0 | 75/208 | 36.1% | 0.448 | 0/0 |
| football | first_half | home over offset +0 | 97/208 | 46.6% | 0.476 | 0/0 |
| football | first_half | away over offset +0 | 86/208 | 41.3% | 0.494 | 0/0 |
| football | first_half | handicap home -0.25 | 77/208 | 37.0% | 0.641 | 0/0 |
| football | full | total over offset +0 | 82/208 | 39.4% | 0.467 | 0/0 |
| football | full | home over offset +0 | 75/208 | 36.1% | 0.462 | 0/0 |
| football | full | away over offset +0 | 101/208 | 48.6% | 0.477 | 0/0 |
| football | full | handicap home -0.25 | 83/208 | 39.9% | 0.627 | 13/20 |
| hockey | first_period | total over offset +0 | 297/603 | 49.3% | 0.492 | 0/0 |
| hockey | first_period | home over offset +0 | 296/603 | 49.1% | 0.463 | 0/0 |
| hockey | first_period | away over offset +0 | 296/603 | 49.1% | 0.486 | 0/0 |
| hockey | first_period | handicap home -0.25 | 224/603 | 37.1% | 0.667 | 0/0 |
| hockey | full | total over offset +0 | 285/604 | 47.2% | 0.500 | 0/0 |
| hockey | full | home over offset +0 | 293/604 | 48.5% | 0.495 | 0/0 |
| hockey | full | away over offset +0 | 282/604 | 46.7% | 0.492 | 0/0 |
| hockey | full | handicap home -0.25 | 353/604 | 58.4% | 0.475 | 59/76 |
| hockey | regulation | total over offset +0 | 277/603 | 45.9% | 0.491 | 0/0 |
| hockey | regulation | home over offset +0 | 291/603 | 48.3% | 0.491 | 0/0 |
| hockey | regulation | away over offset +0 | 267/603 | 44.3% | 0.482 | 0/0 |
| hockey | regulation | handicap home -0.25 | 281/603 | 46.6% | 0.640 | 8/15 |
| nba | first_half | total over offset +0 | 272/556 | 48.9% | 0.502 | 0/0 |
| nba | first_half | home over offset +0 | 284/556 | 51.1% | 0.498 | 0/0 |
| nba | first_half | away over offset +0 | 282/556 | 50.7% | 0.501 | 0/0 |
| nba | first_half | handicap home +0 | 301/556 | 54.1% | 0.494 | 39/54 |
| nba | first_quarter | total over offset +0 | 267/556 | 48.0% | 0.499 | 0/0 |
| nba | first_quarter | home over offset +0 | 293/556 | 52.7% | 0.497 | 0/0 |
| nba | first_quarter | away over offset +0 | 271/556 | 48.7% | 0.498 | 0/0 |
| nba | first_quarter | handicap home +0 | 298/556 | 53.6% | 0.516 | 25/31 |
| nba | full | total over offset +0 | 291/556 | 52.3% | 0.499 | 0/0 |
| nba | full | home over offset +0 | 286/556 | 51.4% | 0.500 | 0/0 |
| nba | full | away over offset +0 | 291/556 | 52.3% | 0.500 | 0/0 |
| nba | full | handicap home +0 | 304/556 | 54.7% | 0.435 | 82/102 |

## Coverage and implementation

Football: full game and first half, total goals, team totals, handicaps including Asian quarter lines, and BTTS. NBA and basketball: full game, first half and first quarter points, team totals and spreads. Hockey: full game, regulation and first period goals, team totals and handicaps. Baseball: full game, first five innings and first inning runs, team totals and handicaps. All report JSONs contain the complete line ladders, probability scoring and outcome counts.

Period artifacts can coexist with full-game artifacts in the admin model registry. Activation is for shadow analysis only. Informational period and quarter-line markets have no invented bookmaker price, zero stake and PASS status. Actual period scores settle them; corrected scores revise their performance record. Each market keeps its own model version and scope.

## Limits before promotion

No historical period quotes, executable odds, transaction costs, closing-line value or ROI were evaluated. Provider data includes differing competition phases; phase-specific testing and drawn/abandoned-game bookmaker void rules need validation. These models omit lineups, injuries, pitchers and goalies. No market-specific calibration improvement over a bookmaker baseline has been demonstrated. The reports do not justify upgrading confidence or enabling recommendations automatically.

Tennis first-set and match markets remain pending a licensed tennis results and odds source. Existing tennis probability mathematics is not represented as a trained or validated tennis product.

Live accounting reports five-state Brier separately for quarter markets. Binary Brier excludes those rows; full-result strike rate counts wins versus losses and excludes half results and pushes.
