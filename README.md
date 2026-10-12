# QuantEdge

Fair prices, value bets and stake sizes for football and basketball — an installable, offline-capable PWA that prices every fixture on-device and checks the result against SportyBet, 1xBet and 22Bet.

![QuantEdge on mobile](static/screenshots/board-mobile.png)

## What it does

- **Prices every market from first principles.** Football uses a Dixon–Coles model (with absences priced in); basketball uses a tempo-free pace × efficiency projection priced analytically for any line.
- **Removes the bookmaker's margin** with Shin's method and blends the model with the de-vigged market consensus (default 60/40, adjustable).
- **Scans every market at every book** for prices above fair value, then sizes stakes with fractional Kelly on your bankroll.
- **Explains itself.** Four deterministic agents (market, squad, quant, risk) reason over the numbers and either recommend a bet or say *pass* — the app never invents an edge.
- **Shows the distribution.** The board's hero is a live 3D surface of the featured match's scoreline probabilities; basketball matches get a Pace lab that re-prices the game as you move sliders.

## Stack

| Layer | Choice |
| --- | --- |
| App | SvelteKit 3, Svelte 5 runes, TypeScript |
| Styling | Tailwind CSS 4 tokens, self-hosted Bricolage Grotesque + Instrument Sans |
| 3D | Three.js (lazy-loaded) |
| Engine | Dependency-free ES modules in `src/lib/engine` (runs in browser and Node) |
| Hosting | Cloudflare Pages (`@sveltejs/adapter-cloudflare`), every route prerendered |
| Optional backend | Convex (`convex/`), enabled by `VITE_CONVEX_URL` |

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine test suite (node:test)
npm run check      # svelte-check / TypeScript
npm run pipeline   # run the engine over the sample feed in the terminal
npm run build      # production build → .svelte-kit/cloudflare
npm run preview    # serve the production build with Wrangler on :4173
```

Deploy by pointing Cloudflare Pages at this repo with build command `npm run build` and output directory `.svelte-kit/cloudflare`.

## Progressive Web App

- `static/manifest.webmanifest` — id, shortcuts, maskable icons at true sizes, narrow/wide screenshots for the rich install sheet.
- `src/service-worker/` — precaches the build, static files and every prerendered page (one per fixture); cache-first assets, network-first pages with offline fallback; updates wait for the user to tap **Update**.
- `src/lib/pwa.svelte.ts` — install prompt (Android/desktop), iOS add-to-home-screen guidance, update and offline state.

## Project layout

```
src/
  lib/
    engine/          maths: football, basketball, vig removal, decisions, pipeline, agents
    data/fixtures.js sample feed — raw ratings, absences and prices only
    state.svelte.ts  app state; predictions derived from the engine
    components/      ScoreSurface3D, FixtureCard, PickTicket, SlipSheet, PaceLab, …
  routes/            board, football, basketball, value-bets, bookmakers, settings, match/[id]
  service-worker/    offline support
convex/              optional live backend
scripts/pipeline.js  CLI over the sample feed
test/                engine tests
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how a prediction is built.

## Data

`src/lib/data/fixtures.js` is a **sample feed**: realistic ratings and prices with kickoffs relative to "now". It contains no derived numbers — every probability, fair price, edge and stake is computed at runtime. Replace it with a live feed (e.g. via Convex) for real use.

## Responsible use

QuantEdge doesn't place bets. Positive expected value is a long-run property; individual bets lose often. Bet only what you can afford to lose.

## License

MIT
