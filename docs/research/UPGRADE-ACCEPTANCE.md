# Upstream research and release acceptance

The objective is understandable, evidence-bounded forecasts for adult users. A
model percentage estimates an outcome; a betting edge requires comparison with
an executable price and independent validation. Neither high winner accuracy nor
a high estimated percentage guarantees profit or recovery of previous losses.

## Reviewed evidence

All eight requested repositories were inspected at pinned commits. See
[football review](FOOTBALL-UPSTREAM-REVIEW.md) and
[NBA/multi-sport review](NBA-UPSTREAM-REVIEW.md) for source links, licences and
specific adoption/rejection decisions. No upstream installers, notebooks, pickles,
weights or betting execution were run. No upstream code was copied.

REA 6.4.0 actually analyzed the existing built SvelteKit client entry directory.
The retained complete evidence is outside the source tree at
`../evidence/rea-puntersedge-entry-20261017.json`; the compact committed record is
[REA-ARTIFACT-EVIDENCE.json](REA-ARTIFACT-EVIDENCE.json). It contains three parsed
JavaScript entry files and no parse failures. This limited static scope establishes
artifact identity and parsed syntax, not runtime reachability, the complete app
graph, proprietary bookmaker internals or model quality. Ordinary Git/file review
was used for source repositories, as required by the REA skill.

## Independently implemented improvements

- Continuous training rejects duplicate fixture/sport/league/scope IDs and results
  unavailable at collection time. Training labels must precede the holdout start.
- Evaluation now reports match total, home total, away total and handicap/spread
  separately, within each existing sport/league/period segment. Half-point lines
  are model-centred diagnostic lines, not claims about available bookmaker prices.
- Eight correlated option evaluations from one fixture remain one fixture in the
  paired Brier uncertainty calculation. A fixed-seed consecutive-fixture block
  bootstrap supplies an approximate 95% interval. It does not remove all temporal
  dependence or correct for repeated challenger selection.
- Automatic unapproved serving updates additionally require at least eight
  seven-fixture blocks, a negative upper interval bound, and no more than 2%
  Brier/log-loss deterioration in any evaluated market family. Convex independently
  checks those fields before replacing an incumbent. Automatic betting approval
  remains disabled.
- Retrospective surface tennis reports include reliability bins with observed
  win rates and Wilson intervals. Those intervals describe the sample's observed
  rate, not uncertainty about a particular fixture's true probability.
- The admin model registry exposes the market-family scores and paired evidence
  inside initially closed accordions.

Existing strengths retained: normalized score distributions, explicit quarter-line
settlement states, separate market-informed and independent evidence, quote-age
checks, immutable pre-match publications, R2 source caching and request budgets.
The reviewed repositories do not justify replacing these with raw softmax outputs,
random historical splits or imported polynomial constants.

## Tennis informational integration

`/tennis` uses a separate global Elo model because the free event feed does not
verify surface. The same global-only formula is evaluated chronologically, with
independent ATP/WTA match/first-set calibrators fitted on 2024 only. Initial
history is 2021–2023 and evaluation is 2025 onward. Historical label availability
uses a disclosed seven-day assumption; the export lacks actual publication times.

Only real discovered future events, unambiguous full-name/tour mappings, sufficient
player history and pre-event fitted artifacts can produce percentages. No unknown
player receives default published probabilities. Unknown surfaces, injuries and
match formats remain disclosed limitations. Totals, handicaps, service-point
statistics and bookmaker prices are not invented.

The private daily R2 snapshot contains compact forecasts, source attribution,
evaluation and withholding reasons. The authenticated API does not expose the
multi-megabyte player table or fall back to Convex bulk storage. The page does not
poll automatically and supports conditional manual refresh. Accordions start
closed, options sort by estimated percentage, and eligible unpriced options can
be saved in the existing betslip. Combined odds continue to use quoted selections
only. Retained prospective snapshots support later audit.

Tennis is an experimental information workspace, not an approved value-betting
model. Automatic tennis settlement and inclusion in the existing five-sport
accumulator optimizer are not implemented. The offline tennis settlement engine
alone does not establish production score-provider coverage or bookmaker-specific
retirement rules. The UI must say this plainly; no fabricated automatic win/loss
or stake recommendation may fill that gap.

## Resource and release boundaries

All training runs on the existing GitHub job, not on each page request or in an
LLM. Tennis reuses the documented free catalogue/events discovery and makes no
additional paid odds request. Three R2 writes per daily forecast retain the fitted artifact, a
current snapshot and a prospective audit snapshot. Convex receives only a bounded
ID/kickoff verification index, once daily, so named betslips can verify real tennis
fixtures without reading the large model or source files. Static page shells remain independent of
Cloudflare Worker requests; private APIs still require available Worker capacity.
No paid plan or provider limit increase is introduced.

The retained multi-sport dataset refit produced no qualified model replacements.
This is a completed evaluation, not a demonstrated accuracy improvement. Deployment,
current provider fixtures and authenticated production flows must be verified
separately from local test success.
