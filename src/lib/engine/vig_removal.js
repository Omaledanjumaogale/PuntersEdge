/**
 * Bookmaker margin (vig) removal.
 *
 * Converts quoted decimal odds into fair implied probabilities with three
 * standard methods: multiplicative (proportional), power, and Shin — the last
 * corrects for favourite–longshot bias and is the default consensus method.
 */

/**
 * @typedef {{ home: number, draw?: number, away: number }} OddsSet
 * @typedef {'multiplicative' | 'power' | 'shin'} VigMethod
 */

/**
 * Sum of implied probabilities (1 + margin).
 * @param {number[]} odds decimal odds
 */
export function calculateOverround(odds) {
  return odds.reduce((acc, o) => acc + 1 / o, 0);
}

/** @param {OddsSet} odds */
function toList(odds) {
  return odds.draw !== undefined ? [odds.home, odds.draw, odds.away] : [odds.home, odds.away];
}

/**
 * @param {OddsSet} odds
 * @param {number[]} probs
 */
function fromList(odds, probs) {
  const overround = calculateOverround(toList(odds));
  const base = { overround, marginPercent: (overround - 1) * 100 };
  return odds.draw !== undefined
    ? { home: probs[0], draw: probs[1], away: probs[2], ...base }
    : { home: probs[0], away: probs[1], ...base };
}

/**
 * Proportional normalisation of any outcome list.
 * @param {number[]} odds
 */
export function fairMultiplicative(odds) {
  const o = calculateOverround(odds);
  return odds.map((x) => 1 / x / o);
}

/**
 * Power method: find k with Σ(1/oᵢ)^k = 1.
 * @param {number[]} odds
 */
export function fairPower(odds) {
  const raw = odds.map((o) => 1 / o);
  let lo = 0.5, hi = 3, k = 1;
  for (let i = 0; i < 80; i++) {
    k = (lo + hi) / 2;
    const s = raw.reduce((acc, p) => acc + p ** k, 0);
    if (Math.abs(s - 1) < 1e-12) break;
    if (s > 1) lo = k;
    else hi = k;
  }
  return raw.map((p) => p ** k);
}

/**
 * Shin (1993) method: models the margin as protection against insider
 * traders with share z. Solved by fixed-point iteration (Jullien–Salanié).
 * @param {number[]} odds
 */
export function fairShin(odds) {
  const pi = odds.map((o) => 1 / o);
  const beta = pi.reduce((a, b) => a + b, 0);
  if (beta <= 1) return pi.map((p) => p / beta);
  /** @param {number} z insider share */
  const probs = (z) =>
    pi.map((p) => (Math.sqrt(z * z + (4 * (1 - z) * p * p) / beta) - z) / (2 * (1 - z)));
  /** @param {number} z */
  const excess = (z) => probs(z).reduce((acc, x) => acc + x, 0) - 1;
  // Σp(z) falls monotonically from √β > 1 at z = 0, so bisection is exact.
  let lo = 0, hi = 0.99;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (excess(mid) > 0) lo = mid;
    else hi = mid;
  }
  const p = probs((lo + hi) / 2);
  const s = p.reduce((acc, x) => acc + x, 0);
  return p.map((x) => x / s);
}

/**
 * Fair probabilities for an outcome list with the chosen method.
 * @param {number[]} odds
 * @param {VigMethod} [method]
 */
export function fairProbabilities(odds, method = 'shin') {
  if (method === 'multiplicative') return fairMultiplicative(odds);
  if (method === 'power') return fairPower(odds);
  return fairShin(odds);
}

/** @param {OddsSet} odds */
export function removeVigMultiplicative(odds) {
  return fromList(odds, fairMultiplicative(toList(odds)));
}

/** @param {OddsSet} odds */
export function removeVigPower(odds) {
  return fromList(odds, fairPower(toList(odds)));
}

/** @param {OddsSet} odds */
export function removeVigShin(odds) {
  return fromList(odds, fairShin(toList(odds)));
}
