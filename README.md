# PuntersEdge

Fair prices, value bets and stake sizes for football and basketball — an installable, offline-capable PWA that prices every fixture on-device and checks the result against SportyBet, 1xBet and 22Bet.

![PuntersEdge on mobile](static/screenshots/board-mobile.png)

## What it does

- **Prices every market from first principles.** Football uses a Dixon–Coles model (with absences priced in); basketball uses a tempo-free pace × efficiency projection priced analytically for any line.
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
| Backend | Convex (`convex/`): auth, betslip sync, fixtures |

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

1. GitHub → **Settings → Secrets and variables → Actions → New repository secret**: name `CONVEX_DEPLOY_KEY`, value = your production deploy key from the Convex dashboard.
2. Optional: add a repository **variable** `SITE_URL` with your app's public URL (defaults to `https://quantedge-sports-pwa.pages.dev`).
3. Run the workflow once from the **Actions** tab (or push a change to `convex/`).

On its first run the workflow generates the RS256 key pair Convex Auth signs sessions with (`JWT_PRIVATE_KEY`, `JWKS`) and never overwrites it afterwards. To do the same by hand: `node scripts/generate-auth-keys.mjs --apply` with `CONVEX_DEPLOY_KEY` set.

Never commit deploy keys. Only `PUBLIC_CONVEX_URL` belongs in the repo; it ships to browsers anyway.

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
    engine/          maths: football, basketball, vig removal, decisions, market book, pipeline, agents
    glossary.ts      plain-language terms and grade thresholds
    data/fixtures.js sample feed — raw ratings, absences and prices only
    state.svelte.ts  app state; predictions derived from the engine
    components/      ScoreSurface3D, FixtureCard, PickTicket, SlipSheet, PaceLab, …
  routes/            home (landing), board, football, basketball, value-bets, bookmakers,
                     glossary, settings, match/[id], login, signup, account
  service-worker/    offline support
convex/              schema, Convex Auth, users, betslip sync
scripts/pipeline.js  CLI over the sample feed
test/                engine tests
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how a prediction is built.

## Market book

Bookmakers in the feed quote headline markets (1X2, total 2.5, BTTS; moneyline, main spread and total). Their other markets are derived the way books build them: football inverts each book's de-vigged headline prices into that book's own Dixon–Coles model; basketball infers each book's implied margin and total from its main lines. The book's own margin is then applied. Quoted prices are used as quoted, derived ones are labelled, and edges on handicaps and draw-no-bet account for refunds.

## Data

`src/lib/data/fixtures.js` is a **sample feed**: realistic ratings and prices with kickoffs relative to "now". It contains no derived numbers — every probability, fair price, edge and stake is computed at runtime. Replace it with a live feed (e.g. via Convex) for real use.

## Responsible use

PuntersEdge doesn't place bets. Positive expected value is a long-run property; individual bets lose often. Bet only what you can afford to lose.

## License

MIT
