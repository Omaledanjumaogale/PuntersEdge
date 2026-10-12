# PuntersEdge

Live fixtures, fair prices, value bets and stake sizes for **football, NBA, basketball, ice hockey and baseball** — an installable, offline-capable PWA that prices every game on-device and checks the result against SportyBet, 1xBet, 22Bet and more.

![PuntersEdge on mobile](static/screenshots/board-mobile.png)

## What it does

- **Prices every market from first principles, per sport.** Football: Dixon–Coles (absences priced in). NBA and basketball: tempo-free pace × efficiency, priced analytically for any line. Ice hockey: Poisson goals with overtime/shootout resolution. Baseball: negative-binomial runs with extra innings.
- **Live data on a budget.** A Convex cron pulls fixtures, live scores, results, league tables and bookmaker prices from API-Sports, The Odds API and OddsPapi, rationed so no quota is ever exceeded and every day of the month gets fresh prices.
- **Honest track record.** Each game's best graded pick is recorded before kickoff and settled from the final score on the Results page.
- **Removes the bookmaker's margin** with Shin's method and blends the model with the de-vigged market consensus (default 60/40, adjustable).
- **Scans every market at every book** for prices above fair value, then sizes stakes with fractional Kelly on your bankroll.
- **Explains itself.** Four deterministic agents (market, squad, quant, risk) reason over the numbers and either recommend a bet or say *pass* — the app never invents an edge.
- **Every market behind the +.** Tapping + on a pick adds it and opens every other market on that match: double chance, draw no bet, Asian handicaps, goal and point ladders, BTTS, team goals and clean sheets, each priced at every bookmaker.
- **Explains every pick.** Each fixture has a "Why this pick?" panel: what the price needs to win vs the model vs the market, and the drivers behind it.
- **Shows the distribution.** The board's hero is a live 3D surface of the featured match's scoreline probabilities; basketball matches get a Pace lab that re-prices the game as you move sliders.

## Stack

| Layer | Choice |
| --- | --- |
| App | SvelteKit 3, Svelte 5 runes, TypeScript |
| Styling | Tailwind CSS 4 tokens, self-hosted Bricolage Grotesque + Instrument Sans |
| 3D | Three.js (lazy-loaded) |
| Engine | Dependency-free ES modules in `src/lib/engine` (runs in browser and Node) |
| Hosting | Cloudflare Pages (`@sveltejs/adapter-cloudflare`), every route prerendered |
| Backend | Convex (`convex/`): auth, betslip sync, live-data ingest (cron + Node action + file storage) |

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine test suite (node:test)
npm run check      # svelte-check / TypeScript
npm run pipeline   # run the engine over the sample feed in the terminal
npm run build      # production build → .svelte-kit/cloudflare
npm run preview    # serve the production build with Wrangler on :4173
npm run build:single  # one self-contained HTML demo → dist-preview/index.html
```

## Deployment

**Frontend (Cloudflare Pages):** build command `npm run build`, output directory `.svelte-kit/cloudflare`. The public Convex URL is read from `.env.production`.

**Backend (Convex):** `.github/workflows/convex-deploy.yml` deploys `convex/` on every push that touches it. One-time setup:

1. GitHub → **Settings → Secrets and variables → Actions → New repository secret**: name `CONVEX_DEPLOY_KEY`, value = your production deploy key from the Convex dashboard. Optionally add `API_SPORTS_KEY`, `THE_ODDS_API_KEY` and `ODDSPAPI_KEY` the same way (see Live data setup).
2. Optional: add a repository **variable** `SITE_URL` with your app's public URL (defaults to `https://quantedge-sports-pwa.pages.dev`).
3. Run the workflow once from the **Actions** tab (or push a change to `convex/`).

On its first run the workflow generates the RS256 key pair Convex Auth signs sessions with (`JWT_PRIVATE_KEY`, `JWKS`) and never overwrites it afterwards. To do the same by hand: `node scripts/generate-auth-keys.mjs --apply` with `CONVEX_DEPLOY_KEY` set.

Never commit deploy keys. Only `PUBLIC_CONVEX_URL` belongs in the repo; it ships to browsers anyway.

## Live data setup

The backend fetches live data only when its provider keys are set. Add them as **Convex environment variables** (Convex dashboard → your production deployment → Settings → Environment variables), or as GitHub secrets with the same names and let the deploy workflow copy them:

| Variable | Provider | Quota and how it's rationed |
| --- | --- | --- |
| `API_SPORTS_KEY` | [API-Sports](https://api-sports.io) (football, basketball, NBA, hockey, baseball) | 100 requests/day per sport API → at most 90, schedule refreshes protected first |
| `THE_ODDS_API_KEY` | [The Odds API](https://the-odds-api.com) | 500 credits/month → at most 488, equal share per remaining day |
| `ODDSPAPI_KEY` | [OddsPapi](https://oddspapi.io) (SportyBet, 1xBet, 22Bet) | 250 requests/month → at most 240, equal share per remaining day |

`API_FOOTBALL_KEY` is accepted as an alias for `API_SPORTS_KEY`. Keys are never committed. After deploying, the cron runs every 30 minutes; to run a tick immediately: `npx convex run ingest:tick` (with `CONVEX_DEPLOY_KEY` set). Quota usage and the source log are on the app's **Results → Data & quotas** panel.

Bookmaker and livescore websites (SportyBet, 1xBet, 22Bet, RedScore, 24live) are not scraped: their terms forbid it and they block automated traffic. The APIs above carry the same bookmakers' prices.

## Accounts

Email + password sign-up, login and logout use [Convex Auth](https://labs.convex.dev/auth) (`convex/auth.ts`). The Svelte client (`src/lib/auth.svelte.ts`) speaks the same protocol as the official React client: short-lived JWTs, rotating refresh tokens serialised across tabs, server-side revocation on logout. Signed-in users' betslips sync to Convex (`convex/betslip.ts`, scoped to the session user).

Without a Convex URL (e.g. the single-file preview) accounts run in a clearly labelled on-device demo mode with PBKDF2-hashed passwords.

## Progressive Web App

- `static/manifest.webmanifest` — id, shortcuts, maskable icons at true sizes, narrow/wide screenshots for the rich install sheet.
- `src/service-worker/` — precaches the build, static files and every prerendered page (one per fixture); cache-first assets, network-first pages with offline fallback; updates wait for the user to tap **Update**.
- `src/lib/pwa.svelte.ts` — install prompt (Android/desktop), iOS add-to-home-screen guidance, update and offline state.

## Project layout

```
src/
  lib/
    engine/          maths: football, basketball, hockey & baseball (score_sports), ratings,
                     settlement, vig removal, decisions, market book, pipeline, agents
    feeds/           provider connectors, quota budgets, job planner, team matching,
                     ingest store and feed builder (run inside Convex)
    sports.ts        the five sports: labels, routes, engines
    feed.svelte.ts   live feed loader (cached, offline-friendly)
    glossary.ts      plain-language terms and grade thresholds
    data/fixtures.js sample feed — raw ratings, absences and prices only
    state.svelte.ts  app state; predictions derived from the engine
    components/      SportDashboard, ScoreSurface3D, FixtureCard, PickTicket, SlipSheet, PaceLab, …
  routes/            home, board, sports, football, nba, basketball, hockey, baseball,
                     value-bets, results, bookmakers, glossary, settings, match, login, signup, account
  service-worker/    offline support
convex/              schema, Convex Auth, users, betslip sync, ingest (cron), feed
scripts/pipeline.js  CLI over the sample feed
test/                engine and feed tests (incl. a simulated month against every quota)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how a prediction is built.

## Market book

Bookmakers in the feed quote headline markets (1X2, total 2.5, BTTS; moneyline, main spread and total). Their other markets are derived the way books build them: football inverts each book's de-vigged headline prices into that book's own Dixon–Coles model; basketball infers each book's implied margin and total from its main lines. The book's own margin is then applied. Quoted prices are used as quoted, derived ones are labelled, and edges on handicaps and draw-no-bet account for refunds.

## Data

With the provider keys set, the app runs on the **live feed** published by Convex (see Live data setup). Without them — or before the first live feed exists — it falls back to `src/lib/data/fixtures.js`, a **sample feed** with realistic ratings and prices, and labels everything "Sample games". Either way the feed holds inputs only: every probability, fair price, edge and stake is computed on the device.

## Responsible use

PuntersEdge doesn't place bets. Positive expected value is a long-run property; individual bets lose often. Bet only what you can afford to lose.

## License

MIT
