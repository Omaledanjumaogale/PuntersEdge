# Architecture

## Prediction flow

```
raw input (live feed from Convex, or the sample feed in fixtures.js)
  ├─ ratings ──► lineup_impact ──► football_model / basketball_model ──► model probabilities ─┐
  └─ odds per book ──► vig_removal (Shin) ──► market consensus ───────────────────────────────┤
                                                                                               ▼
                                            blend (modelWeight) ──► scanMarkets (best price per selection)
                                                                         │
                                                  EV ─► grade (discounted for large model–market gaps)
                                                  Kelly fraction ─► stake % ─► ₦ from bankroll
                                                                         │
                                                       ai_agent_orchestrator ─► verdict + rationale
```

Everything above lives in `src/lib/engine` and is pure: the same functions run in the browser, in `node --test`, and in `scripts/pipeline.js`.

## Models

### Football — Dixon–Coles
- Independent Poisson goals for each side, corrected at 0–0, 1–0, 0–1 and 1–1 by τ(ρ). ρ is clamped so τ is never negative.
- The grid (0–10 goals each) is renormalised, so every market sums to exactly 1.
- Derived: 1X2, double chance, draw-no-bet, BTTS, totals 0.5–5.5, team totals, clean sheets, Asian handicaps (with pushes on whole lines).
- `fitGoalParametersFromProbabilities` inverts de-vigged odds back to λ/μ.

### Basketball — tempo-free
- Pace = paceₕ × paceₐ / league pace; efficiency adjusted for the opponent's defence; home advantage split across both scores.
- Scores are bivariate normal with pace-scaled variance and positive correlation, so margin and total have different spreads (NBA ≈ 13.5 and 17.5 points).
- Lines are priced analytically (exact, deterministic). A seeded Monte Carlo supplies the histogram in the Pace lab.

### Ice hockey — Poisson goals
- Each side's regulation goals are Poisson around its expected goals; the 0–12 grid gives the 60-minute result (regulation 1X2).
- A regulation tie becomes a one-goal win for the overtime/shootout winner (home 52%), which is how books settle moneyline, puck line and totals.
- Each bookmaker's own view is fitted from its moneyline and main total (`fitMeans`, with a fast kernel and a memo), then used to derive its other lines with its own margin.

### Baseball — negative-binomial runs
- Runs are over-dispersed (variance ≈ mean + mean²/3.8), so a negative binomial replaces Poisson; ties go to extra innings like hockey's overtime.
- Run line ±1.5, totals ladder, team totals.

### Team ratings (`ratings.js`)
- Football: λ = league home-goal rate × home attack (at home) × away defence (away), from the table's home/away splits; μ likewise.
- Hockey and baseball: expected scores from goals/runs for and against per game, with a home factor.
- Basketball: pace and offensive/defensive ratings from points per game; NBA tables without points use the shrunk win rate (≈ 2.7 wins per point of net rating).
- Every rating is shrunk toward the league average by adding a few games of average performance (6 football, 8 basketball, 10 hockey, 15 baseball).
- No table? `marketRatings` fits ratings that reproduce the de-vigged consensus, so the model agrees with the market and any edge comes from price shopping. The app says so.

### Market
- Shin, power and proportional de-vig. Shin is the default because it corrects favourite–longshot bias.
- Edges above 25% are discarded as stale prices or data errors.

## Live data

```
cron (30 min) ─► convex/ingest.ts (Node action)
   claim lock + ledgers ─► load store.json.gz ─► listJobs ─► planJobs (budget) ─► reserve spend
   ─► fetch (allowlisted hosts, keys from env) ─► parse ─► match teams ─► merge ─► prune
   ─► settle picks ─► buildFeed ─► feed.json.gz (only if changed) ─► commit
app ─► feed:meta (tiny query) ─► download feed.json.gz when the version changed ─► engines on device
```

- **Providers.** API-Sports (one host per sport: football v3, basketball v1, NBA v2, hockey v1, baseball v1) is the backbone for fixtures, live scores, results and league tables, plus some bookmaker odds. The Odds API adds European books (1xBet, Pinnacle, …). OddsPapi adds SportyBet, 1xBet and 22Bet. Bookmaker websites are never scraped.
- **Budgets** (`src/lib/feeds/budget.js`). API-Sports: ≤ 90 of 100 requests per day per sport API, with the rest of the day's schedule refreshes protected before extras (odds, tables) spend. OddsPapi ≤ 240 of 250 and The Odds API ≤ 488 of 500 credits a month, each paced to an equal share per remaining day; refresh intervals stretch or shrink to fit (`pacedEvery`). Provider headers (`x-ratelimit-requests-remaining`, `x-requests-remaining`, `/v4/account`) override our count when stricter. Planned spend is written before any call, so a crash over-counts rather than under-counts. A simulated month in `test/feeds.test.js` checks every quota.
- **Cadence** (`jobs.js`). Today's games every 30 min while any are live, hourly on match days, every 3 h otherwise; tomorrow every 6 h; yesterday and +2 days twice a day; tables daily for leagues with games in the next three days; odds only for competitions with games soon. The Odds API's free `/events` decides which competitions are worth credits.
- **Matching** (`matching.js`). Team names are normalised (accents, "FC", "Utd" → united, "Man" → manchester, …) and compared with a containment-aware token score; candidates must kick off within 3 h.
- **Storage.** The ingest store and the published feed are gzipped files in Convex file storage; the database holds two small documents (`feed_state`). Old files are deleted when replaced, games older than three days are pruned, and the feed only changes when its content does, so storage, database I/O and bandwidth stay inside the free plan.
- **Track record.** Shortly before kickoff each game's best quoted A+/A/B selection is recorded; after the final whistle it's settled (`settlement.js`: 90 minutes for football, overtime/extra innings included elsewhere, regulation for hockey 1X2).

## App

- `state.svelte.ts` holds settings and the betslip (persisted) and derives all predictions; changing model weight or Kelly fraction reprices the board instantly.
- `feed.svelte.ts` loads the live feed (cached in localStorage by version, so the app opens instantly and offline); without one the app runs on the sample feed and labels it.
- Routes are prerendered with `ssr = false`: static shells the service worker precaches, so the whole app works offline and on any static host. A match is `/match?id=…`, so live games need no per-game page.
- Five dashboards (`/football`, `/nba`, `/basketball`, `/hockey`, `/baseball`) share `SportDashboard.svelte`: live, upcoming (priced cards), the rest of the schedule, recent results. `/results` shows the track record, scores and quota usage.
- `ScoreSurface3D` loads Three.js on demand, pauses when off-screen or the tab is hidden, disposes GPU resources on unmount, and falls back to a 2D grid without WebGL.

## PWA lifecycle

1. First visit: `pwa.init()` registers `/service-worker.js`, which precaches the shell for this build version.
2. Next deploy: the new worker installs alongside the old one; the app shows **Update**. Tapping it posts `SKIP_WAITING`, the new worker takes control and the page reloads once.
3. Offline: navigations fall back to the cached page, then the cached board.
