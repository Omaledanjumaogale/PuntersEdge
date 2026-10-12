/**
 * Settle a selection against a final score.
 *
 * Selection ids are `${fixtureId}:${key}`, where key is the market-book key
 * (e.g. `home`, `o2.5`, `ahh-1`, `sph-1.5`). Football markets settle on the
 * 90-minute score; moneylines, spreads and totals in the other sports include
 * overtime / extra innings, like the books settle them. Hockey's regulation
 * 1X2 uses the 60-minute score.
 */

/**
 * @typedef {'won' | 'lost' | 'push' | 'half-won' | 'half-lost'} Outcome
 * @typedef {{ home: number, away: number, regHome?: number, regAway?: number }} FinalScore
 */

/** Return per unit staked at decimal odds for each outcome. */
export function profitFor(/** @type {Outcome} */ outcome, /** @type {number} */ odds) {
  switch (outcome) {
    case 'won': return odds - 1;
    case 'lost': return -1;
    case 'push': return 0;
    case 'half-won': return (odds - 1) / 2;
    case 'half-lost': return -0.5;
  }
}

/** Handicap result for margin + line (whole lines push; quarter lines split). */
function handicap(/** @type {number} */ margin, /** @type {number} */ line) {
  const quarter = Math.abs((line * 4) % 2) === 1;
  if (quarter) {
    const a = handicap(margin, line - 0.25);
    const b = handicap(margin, line + 0.25);
    if (a === b) return a;
    if ((a === 'push' && b === 'won') || (a === 'won' && b === 'push')) return 'half-won';
    return 'half-lost';
  }
  const d = margin + line;
  return d > 0 ? 'won' : d < 0 ? 'lost' : 'push';
}

/** Over/under a line on a count. */
const overUnder = (/** @type {number} */ x, /** @type {number} */ line, /** @type {boolean} */ over) =>
  x === line ? 'push' : (x > line) === over ? 'won' : 'lost';

/**
 * @param {'football' | 'basketball' | 'hockey' | 'baseball'} family
 * @param {string} key market-book key
 * @param {FinalScore} score
 * @returns {Outcome | null} null when the key isn't settleable from a score
 */
export function settle(family, key, score) {
  const { home: H, away: A } = score;
  if (!Number.isFinite(H) || !Number.isFinite(A)) return null;
  let m;

  if (family === 'football') {
    // 90 minutes, extra time excluded.
    const h = score.regHome ?? H;
    const a = score.regAway ?? A;
    switch (key) {
      case 'home': return h > a ? 'won' : 'lost';
      case 'draw': return h === a ? 'won' : 'lost';
      case 'away': return a > h ? 'won' : 'lost';
      case 'dc1x': return h >= a ? 'won' : 'lost';
      case 'dc12': return h !== a ? 'won' : 'lost';
      case 'dcx2': return a >= h ? 'won' : 'lost';
      case 'dnbh': return h === a ? 'push' : h > a ? 'won' : 'lost';
      case 'dnba': return h === a ? 'push' : a > h ? 'won' : 'lost';
      case 'bttsYes': return h > 0 && a > 0 ? 'won' : 'lost';
      case 'bttsNo': return h > 0 && a > 0 ? 'lost' : 'won';
      case 'h05': return h > 0.5 ? 'won' : 'lost';
      case 'h15': return h > 1.5 ? 'won' : 'lost';
      case 'a05': return a > 0.5 ? 'won' : 'lost';
      case 'a15': return a > 1.5 ? 'won' : 'lost';
      case 'csh': return a === 0 ? 'won' : 'lost';
      case 'csa': return h === 0 ? 'won' : 'lost';
    }
    if ((m = /^ahh(-?[\d.]+)$/.exec(key))) return handicap(h - a, Number(m[1]));
    if ((m = /^aha(-?[\d.]+)$/.exec(key))) return handicap(a - h, Number(m[1]));
    if ((m = /^o([\d.]+)$/.exec(key))) return overUnder(h + a, Number(m[1]), true);
    if ((m = /^u([\d.]+)$/.exec(key))) return overUnder(h + a, Number(m[1]), false);
    return null;
  }

  switch (key) {
    case 'homeMl': return H > A ? 'won' : H < A ? 'lost' : 'push';
    case 'awayMl': return A > H ? 'won' : A < H ? 'lost' : 'push';
  }
  if (family === 'hockey' && /^reg[HXA]$/.test(key)) {
    if (score.regHome === undefined || score.regAway === undefined) return null;
    const h = score.regHome, a = score.regAway;
    if (key === 'regH') return h > a ? 'won' : 'lost';
    if (key === 'regX') return h === a ? 'won' : 'lost';
    return a > h ? 'won' : 'lost';
  }
  if ((m = /^sph(-?[\d.]+)$/.exec(key))) return handicap(H - A, Number(m[1]));
  if ((m = /^spa(-?[\d.]+)$/.exec(key))) return handicap(A - H, Number(m[1]));
  if ((m = /^o([\d.]+)$/.exec(key))) return overUnder(H + A, Number(m[1]), true);
  if ((m = /^u([\d.]+)$/.exec(key))) return overUnder(H + A, Number(m[1]), false);
  if ((m = /^th([\d.]+)$/.exec(key))) return overUnder(H, Number(m[1]), true);
  if ((m = /^ta([\d.]+)$/.exec(key))) return overUnder(A, Number(m[1]), true);
  return null;
}
