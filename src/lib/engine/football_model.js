/**
 * Dixon–Coles football model.
 *
 * Turns goal expectancies (λ home, μ away) into a full, normalised scoreline
 * distribution and derives every common market from it: 1X2, double chance,
 * draw-no-bet, BTTS, totals, team totals and Asian handicaps.
 */

import { poissonPmf, clamp, fairOdds } from './math.js';

/** Total-goals lines evaluated for every match. */
export const TOTAL_LINES = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5];

/** Home handicap lines evaluated for every match (negative = home gives goals). */
export const HANDICAP_LINES = [-2.5, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2.5];

/**
 * Dixon–Coles low-score dependence correction τ(x, y).
 * @param {number} x home goals
 * @param {number} y away goals
 * @param {number} lambda
 * @param {number} mu
 * @param {number} rho
 */
export function dixonColesTau(x, y, lambda, mu, rho) {
  if (x === 0 && y === 0) return 1 - lambda * mu * rho;
  if (x === 0 && y === 1) return 1 + lambda * rho;
  if (x === 1 && y === 0) return 1 + mu * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

/**
 * ρ must keep every τ non-negative; clamp it into the admissible range.
 * @param {number} rho
 * @param {number} lambda
 * @param {number} mu
 */
export function clampRho(rho, lambda, mu) {
  const lower = Math.max(-1 / lambda, -1 / mu);
  const upper = Math.min(1 / (lambda * mu), 1);
  return clamp(rho, lower + 1e-9, upper - 1e-9);
}

/**
 * Settle an Asian handicap for the home side given a goal difference.
 * Quarter lines are not used here; whole lines push, half lines don't.
 * @param {number} diff home goals − away goals
 * @param {number} line home handicap
 * @returns {'win' | 'push' | 'lose'}
 */
function settleHandicap(diff, line) {
  const adjusted = diff + line;
  if (Math.abs(adjusted) < 1e-9) return 'push';
  return adjusted > 0 ? 'win' : 'lose';
}

/**
 * @typedef {{ home: number, away: number, prob: number }} Scoreline
 * @typedef {{ over: number, under: number, fairOddsOver: number, fairOddsUnder: number }} TotalLine
 * @typedef {{ win: number, push: number, lose: number, fairOdds: number }} HandicapLine
 */

/**
 * Generate the exact-score matrix and all derived market probabilities.
 *
 * The raw Poisson×τ grid is truncated at `maxGoals`; the tail mass is
 * renormalised so every market sums to exactly 1.
 *
 * @param {number} lambdaHome expected home goals
 * @param {number} muAway expected away goals
 * @param {number} [rho] Dixon–Coles dependence (typically −0.15…0)
 * @param {number} [maxGoals] grid size per team (inclusive)
 */
export function generateScoreMatrix(lambdaHome, muAway, rho = -0.05, maxGoals = 10) {
  const lambda = Math.max(0.05, lambdaHome);
  const mu = Math.max(0.05, muAway);
  const r = clampRho(rho, lambda, mu);

  const homePmf = Array.from({ length: maxGoals + 1 }, (_, k) => poissonPmf(k, lambda));
  const awayPmf = Array.from({ length: maxGoals + 1 }, (_, k) => poissonPmf(k, mu));

  /** @type {number[][]} */
  const matrix = [];
  let mass = 0;
  for (let x = 0; x <= maxGoals; x++) {
    matrix[x] = [];
    for (let y = 0; y <= maxGoals; y++) {
      const p = homePmf[x] * awayPmf[y] * dixonColesTau(x, y, lambda, mu, r);
      matrix[x][y] = p;
      mass += p;
    }
  }

  let home = 0, draw = 0, away = 0, bttsYes = 0;
  /** @type {Record<number, number>} */
  const overMass = Object.fromEntries(TOTAL_LINES.map((l) => [l, 0]));
  /** @type {Record<number, { win: number, push: number, lose: number }>} */
  const handicap = Object.fromEntries(HANDICAP_LINES.map((l) => [l, { win: 0, push: 0, lose: 0 }]));
  const homeGoals = new Array(maxGoals + 1).fill(0);
  const awayGoals = new Array(maxGoals + 1).fill(0);
  /** @type {Scoreline[]} */
  const scorelines = [];

  for (let x = 0; x <= maxGoals; x++) {
    for (let y = 0; y <= maxGoals; y++) {
      const p = matrix[x][y] / mass;
      matrix[x][y] = p;
      if (x > y) home += p;
      else if (x === y) draw += p;
      else away += p;
      if (x > 0 && y > 0) bttsYes += p;
      for (const line of TOTAL_LINES) if (x + y > line) overMass[line] += p;
      for (const line of HANDICAP_LINES) handicap[line][settleHandicap(x - y, line)] += p;
      homeGoals[x] += p;
      awayGoals[y] += p;
      scorelines.push({ home: x, away: y, prob: p });
    }
  }

  scorelines.sort((a, b) => b.prob - a.prob);

  /** @type {Record<number, TotalLine>} */
  const overUnder = {};
  for (const line of TOTAL_LINES) {
    const over = overMass[line];
    const under = 1 - over;
    overUnder[line] = { over, under, fairOddsOver: fairOdds(over), fairOddsUnder: fairOdds(under) };
  }

  /** @type {Record<number, HandicapLine>} */
  const asianHandicap = {};
  for (const line of HANDICAP_LINES) {
    const h = handicap[line];
    // Fair odds conditional on no push (stake is returned on a push).
    asianHandicap[line] = { ...h, fairOdds: fairOdds(h.win / (h.win + h.lose)) };
  }

  /** @param {number[]} dist @param {number} line */
  const teamOver = (dist, line) => dist.reduce((acc, p, k) => (k > line ? acc + p : acc), 0);

  return {
    lambdaHome: lambda,
    muAway: mu,
    rho: r,
    expectedTotalGoals: lambda + mu,
    expectedGoalDifference: lambda - mu,
    matrix,
    truncatedMass: 1 - mass,
    probabilities: {
      oneXTwo: {
        home,
        draw,
        away,
        fairOdds: { home: fairOdds(home), draw: fairOdds(draw), away: fairOdds(away) }
      },
      btts: {
        yes: bttsYes,
        no: 1 - bttsYes,
        fairOdds: { yes: fairOdds(bttsYes), no: fairOdds(1 - bttsYes) }
      },
      overUnder,
      asianHandicap,
      teamTotals: {
        home: { over0_5: teamOver(homeGoals, 0.5), over1_5: teamOver(homeGoals, 1.5), over2_5: teamOver(homeGoals, 2.5) },
        away: { over0_5: teamOver(awayGoals, 0.5), over1_5: teamOver(awayGoals, 1.5), over2_5: teamOver(awayGoals, 2.5) }
      },
      cleanSheet: { home: awayGoals[0], away: homeGoals[0] },
      topPredictedScores: scorelines.slice(0, 8)
    }
  };
}

/**
 * Inverts expected total and goal supremacy into λ / μ.
 * @param {number} expectedTotal
 * @param {number} expectedSpread home supremacy (λ − μ)
 */
export function solveGoalParametersFromMarket(expectedTotal, expectedSpread) {
  const lambda = (expectedTotal + expectedSpread) / 2;
  const mu = (expectedTotal - expectedSpread) / 2;
  return { lambdaHome: Math.max(0.1, lambda), muAway: Math.max(0.1, mu) };
}

/**
 * Lean kernel for fitting: home win, away win and over 2.5 only, normalised
 * over a 0–8 grid. Same maths as generateScoreMatrix without building every
 * market, so a fit costs a few milliseconds instead of hundreds.
 * @param {number} lambda
 * @param {number} mu
 * @param {number} rho
 */
export function headlineProbabilities(lambda, mu, rho = -0.05) {
  const r = clampRho(rho, lambda, mu);
  const N = 8;
  const hp = new Float64Array(N + 1);
  const ap = new Float64Array(N + 1);
  hp[0] = Math.exp(-lambda);
  ap[0] = Math.exp(-mu);
  for (let k = 1; k <= N; k++) {
    hp[k] = (hp[k - 1] * lambda) / k;
    ap[k] = (ap[k - 1] * mu) / k;
  }
  let mass = 0, home = 0, away = 0, over = 0;
  for (let x = 0; x <= N; x++) {
    for (let y = 0; y <= N; y++) {
      const p = hp[x] * ap[y] * dixonColesTau(x, y, lambda, mu, r);
      mass += p;
      if (x > y) home += p;
      else if (y > x) away += p;
      if (x + y > 2.5) over += p;
    }
  }
  return { home: home / mass, away: away / mass, over2_5: over / mass };
}

/**
 * Fit λ / μ so the model reproduces de-vigged market probabilities
 * (home win and over 2.5). Coarse grid then local refinement — robust,
 * dependency-free and fast enough to run per fixture in the browser.
 *
 * @param {{ home: number, away: number, over2_5: number }} target fair probabilities
 * @param {number} [rho]
 */
export function fitGoalParametersFromProbabilities(target, rho = -0.05) {
  /** @param {number} l @param {number} m */
  const loss = (l, m) => {
    const p = headlineProbabilities(l, m, rho);
    return (p.home - target.home) ** 2 + (p.away - target.away) ** 2 + (p.over2_5 - target.over2_5) ** 2;
  };

  let best = { l: 1.4, m: 1.1, e: Infinity };
  for (let l = 0.3; l <= 3.6; l += 0.15) {
    for (let m = 0.3; m <= 3.0; m += 0.15) {
      const e = loss(l, m);
      if (e < best.e) best = { l, m, e };
    }
  }
  let step = 0.075;
  while (step > 0.002) {
    let improved = false;
    for (const [dl, dm] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const l = best.l + dl;
      const m = best.m + dm;
      if (l < 0.1 || m < 0.1) continue;
      const e = loss(l, m);
      if (e < best.e) {
        best = { l, m, e };
        improved = true;
      }
    }
    if (!improved) step /= 2;
  }
  return { lambdaHome: best.l, muAway: best.m, residual: best.e };
}
