/**
 * QuantEdge numeric core.
 * Deterministic, dependency-free primitives shared by every model in the engine.
 */

/**
 * Seeded PRNG (mulberry32). Same seed → same stream, so simulations are
 * reproducible across server renders, client hydration and tests.
 * @param {number} seed
 * @returns {() => number} uniform generator on [0, 1)
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Stable 32-bit hash of a string (FNV-1a) — used to derive per-fixture seeds.
 * @param {string} str
 */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Standard normal sample via Box–Muller using a supplied uniform generator.
 * @param {() => number} rand
 * @param {number} [mean]
 * @param {number} [sd]
 */
export function gaussian(rand, mean = 0, sd = 1) {
  let u1 = 0;
  while (u1 === 0) u1 = rand();
  const u2 = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Error function (Abramowitz & Stegun 7.1.26, |ε| < 1.5e-7).
 * @param {number} x
 */
export function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

/**
 * Normal cumulative distribution function.
 * @param {number} x
 * @param {number} [mean]
 * @param {number} [sd]
 */
export function normalCdf(x, mean = 0, sd = 1) {
  return 0.5 * (1 + erf((x - mean) / (sd * Math.SQRT2)));
}

/**
 * Poisson probability mass function computed iteratively in log-space so it
 * stays numerically stable for large k (no factorial overflow).
 * @param {number} k
 * @param {number} lambda
 */
export function poissonPmf(k, lambda) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda;
  for (let i = 1; i <= k; i++) logP += Math.log(lambda) - Math.log(i);
  return Math.exp(logP);
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Round to a fixed number of decimals without string round-trips.
 * @param {number} value
 * @param {number} [decimals]
 */
export function round(value, decimals = 2) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/**
 * Safe reciprocal used for fair odds — returns Infinity for zero probability
 * instead of throwing or producing NaN.
 * @param {number} p
 */
export function fairOdds(p) {
  return p > 0 ? 1 / p : Infinity;
}
