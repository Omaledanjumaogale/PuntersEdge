# Architecture

## Prediction flow

```
raw input (fixtures.js / Convex)
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

### Market
- Shin, power and proportional de-vig. Shin is the default because it corrects favourite–longshot bias.
- Edges above 25% are discarded as stale prices or data errors.

## App

- `state.svelte.ts` holds settings and the betslip (persisted) and derives all predictions; changing model weight or Kelly fraction reprices the board instantly.
- Routes are prerendered with `ssr = false`: the build is a set of static shells (one per fixture) that the service worker precaches, so the whole app works offline and on any static host.
- `ScoreSurface3D` loads Three.js on demand, pauses when off-screen or the tab is hidden, disposes GPU resources on unmount, and falls back to a 2D grid without WebGL.

## PWA lifecycle

1. First visit: `pwa.init()` registers `/service-worker.js`, which precaches the shell for this build version.
2. Next deploy: the new worker installs alongside the old one; the app shows **Update**. Tapping it posts `SKIP_WAITING`, the new worker takes control and the page reloads once.
3. Offline: navigations fall back to the cached page, then the cached board.
