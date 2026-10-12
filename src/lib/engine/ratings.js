/**
 * Team-strength ratings.
 *
 * Turns league tables (or recent results) into the inputs each sport's model
 * needs, with shrinkage toward the league average so early-season tables and
 * small samples don't produce extreme numbers. When no table is available a
 * game can still be priced from the market alone (`marketRatings`), in which
 * case the model simply agrees with the consensus and any edge comes from
 * finding the best price.
 */

import { fitGoalParametersFromProbabilities } from './football_model.js';
import { fitMeans, SCORE_SPORTS } from './score_sports.js';
import { fairProbabilities } from './vig_removal.js';
import { LEAGUE_PROFILES, projectScores } from './basketball_model.js';
import { probit, clamp } from './math.js';

/**
 * One team's line in a league table. Home/away splits are optional.
 * @typedef {Object} TableRow
 * @property {string | number} teamId
 * @property {string} team
 * @property {number} played
 * @property {number} for points/goals/runs scored
 * @property {number} against
 * @property {number} [wins]
 * @property {number} [losses]
 * @property {{ played: number, for: number, against: number }} [home]
 * @property {{ played: number, for: number, against: number }} [away]
 */

/** Pseudo-games of league-average performance added to every team. */
export const SHRINK_GAMES = { football: 6, basketball: 8, hockey: 10, baseball: 15 };

/** Home advantage as a multiplier on expected score when no split exists. */
const HOME_FACTOR = { football: 1.12, hockey: 1.04, baseball: 1.02 };

/**
 * @param {TableRow[]} rows
 * @param {(r: TableRow) => { played: number, for: number, against: number } | undefined} pick
 */
function leagueAverage(rows, pick) {
  let g = 0, f = 0, a = 0;
  for (const r of rows) {
    const s = pick(r);
    if (!s || !(s.played > 0)) continue;
    g += s.played;
    f += s.for;
    a += s.against;
  }
  return g > 0 ? { perGame: f / g, againstPerGame: a / g, games: g } : null;
}

/** Shrunk rate relative to a league average (1 = average). */
const relative = (/** @type {number} */ total, /** @type {number} */ played, /** @type {number} */ avg, /** @type {number} */ k) =>
  avg > 0 ? (total + k * avg) / (played + k) / avg : 1;

/**
 * Index a table by team id for fast lookups.
 * @param {TableRow[]} rows
 */
export function indexTable(rows) {
  return new Map(rows.map((r) => [String(r.teamId), r]));
}

/**
 * Football: Dixon–Coles means from a table with home/away splits when present.
 * λ = league home-goal rate × home attack (at home) × away defence (away)
 * @param {TableRow[]} rows
 * @param {string | number} homeId
 * @param {string | number} awayId
 * @returns {{ lambdaHome: number, muAway: number, rho: number } | null}
 */
export function footballRatings(rows, homeId, awayId) {
  const t = indexTable(rows);
  const H = t.get(String(homeId));
  const A = t.get(String(awayId));
  if (!H || !A || !(H.played > 0) || !(A.played > 0)) return null;
  const k = SHRINK_GAMES.football;
  const hasSplits = rows.every((r) => r.home && r.away);
  let lambda, mu;
  if (hasSplits) {
    const home = leagueAverage(rows, (r) => r.home);
    const away = leagueAverage(rows, (r) => r.away);
    if (!home || !away) return null;
    const hs = /** @type {NonNullable<TableRow['home']>} */ (H.home);
    const as = /** @type {NonNullable<TableRow['away']>} */ (A.away);
    // Home side: goals scored at home vs league home rate; away side conceded away vs the same rate.
    lambda = home.perGame * relative(hs.for, hs.played, home.perGame, k) * relative(as.against, as.played, home.perGame, k);
    mu = away.perGame * relative(as.for, as.played, away.perGame, k) * relative(hs.against, hs.played, away.perGame, k);
  } else {
    const all = leagueAverage(rows, (r) => r);
    if (!all) return null;
    const base = all.perGame;
    const hf = HOME_FACTOR.football;
    lambda = base * Math.sqrt(hf) * relative(H.for, H.played, base, k) * relative(A.against, A.played, base, k);
    mu = (base / Math.sqrt(hf)) * relative(A.for, A.played, base, k) * relative(H.against, H.played, base, k);
  }
  return { lambdaHome: clamp(lambda, 0.25, 4), muAway: clamp(mu, 0.2, 3.6), rho: -0.06 };
}

/**
 * Hockey and baseball: expected regulation score for each side.
 * @param {TableRow[]} rows
 * @param {string | number} homeId
 * @param {string | number} awayId
 * @param {'hockey' | 'baseball'} family
 * @returns {{ homeMean: number, awayMean: number } | null}
 */
export function scoreSportRatings(rows, homeId, awayId, family) {
  const t = indexTable(rows);
  const H = t.get(String(homeId));
  const A = t.get(String(awayId));
  if (!H || !A || !(H.played > 0) || !(A.played > 0)) return null;
  const all = leagueAverage(rows, (r) => r);
  if (!all) return null;
  const k = SHRINK_GAMES[family];
  const base = all.perGame;
  // Tables count overtime/extra-inning scores; regulation is a little lower.
  const reg = family === 'hockey' ? 0.97 : 0.985;
  const hf = Math.sqrt(HOME_FACTOR[family]);
  const homeMean = base * reg * hf * relative(H.for, H.played, base, k) * relative(A.against, A.played, base, k);
  const awayMean = (base * reg / hf) * relative(A.for, A.played, base, k) * relative(H.against, H.played, base, k);
  const cap = family === 'hockey' ? [1.2, 5.5] : [1.8, 9];
  return { homeMean: clamp(homeMean, cap[0], cap[1]), awayMean: clamp(awayMean, cap[0], cap[1]) };
}

/**
 * Basketball: pace and efficiency from points for/against. Without points
 * (e.g. win–loss only), the net rating is read off the shrunk win rate.
 * @param {TableRow[]} rows
 * @param {string | number} homeId
 * @param {string | number} awayId
 * @param {string} league league name, for the right pace profile
 * @returns {{ home: import('./basketball_model.js').TeamRatings, away: import('./basketball_model.js').TeamRatings } | null}
 */
export function basketballRatings(rows, homeId, awayId, league) {
  const t = indexTable(rows);
  const H = t.get(String(homeId));
  const A = t.get(String(awayId));
  if (!H || !A) return null;
  const profile = /nba/i.test(league) && !/g league/i.test(league) ? LEAGUE_PROFILES.NBA : LEAGUE_PROFILES.EuroLeague;
  const k = SHRINK_GAMES.basketball;

  /** @param {TableRow} r */
  const rate = (r) => {
    if (r.played > 0 && r.for > 0 && r.against > 0) {
      const all = /** @type {NonNullable<ReturnType<typeof leagueAverage>>} */ (leagueAverage(rows, (x) => (x.for > 0 ? x : undefined)));
      const lgPts = all.perGame;
      const pf = (r.for + k * lgPts) / (r.played + k);
      const pa = (r.against + k * lgPts) / (r.played + k);
      // Faster teams have more points both ways; pace scales with total.
      const pace = profile.pace * ((pf + pa) / (2 * lgPts));
      const lgOff = (100 * lgPts) / profile.pace;
      return {
        pace: clamp(pace, profile.pace * 0.9, profile.pace * 1.1),
        offRtg: (profile.offRtg * ((100 * pf) / pace)) / lgOff,
        defRtg: (profile.offRtg * ((100 * pa) / pace)) / lgOff
      };
    }
    const w = r.wins ?? 0;
    const l = r.losses ?? 0;
    const winPct = (w + k / 2) / (w + l + k);
    // ≈ 2.7 wins per point of net rating over an 82-game season.
    const net = clamp((winPct - 0.5) / 0.033, -14, 14);
    return { pace: profile.pace, offRtg: profile.offRtg + net / 2, defRtg: profile.offRtg - net / 2 };
  };
  if (!(H.played > 0 || (H.wins ?? 0) + (H.losses ?? 0) > 0)) return null;
  if (!(A.played > 0 || (A.wins ?? 0) + (A.losses ?? 0) > 0)) return null;
  return { home: rate(H), away: rate(A) };
}

/**
 * Aggregate finished games into table rows (used when no table is available).
 * @param {Array<{ homeId: string | number, awayId: string | number, home: string, away: string, homeScore: number, awayScore: number }>} games
 * @returns {TableRow[]}
 */
export function tableFromResults(games) {
  /** @type {Map<string, TableRow>} */
  const m = new Map();
  const row = (/** @type {string | number} */ id, /** @type {string} */ name) => {
    const key = String(id);
    let r = m.get(key);
    if (!r) {
      r = { teamId: key, team: name, played: 0, for: 0, against: 0, wins: 0, losses: 0, home: { played: 0, for: 0, against: 0 }, away: { played: 0, for: 0, against: 0 } };
      m.set(key, r);
    }
    return r;
  };
  for (const g of games) {
    if (!Number.isFinite(g.homeScore) || !Number.isFinite(g.awayScore)) continue;
    const h = row(g.homeId, g.home);
    const a = row(g.awayId, g.away);
    h.played++; a.played++;
    h.for += g.homeScore; h.against += g.awayScore;
    a.for += g.awayScore; a.against += g.homeScore;
    /** @type {any} */ (h.home).played++; /** @type {any} */ (h.home).for += g.homeScore; /** @type {any} */ (h.home).against += g.awayScore;
    /** @type {any} */ (a.away).played++; /** @type {any} */ (a.away).for += g.awayScore; /** @type {any} */ (a.away).against += g.homeScore;
    if (g.homeScore > g.awayScore) { h.wins = (h.wins ?? 0) + 1; a.losses = (a.losses ?? 0) + 1; }
    else if (g.awayScore > g.homeScore) { a.wins = (a.wins ?? 0) + 1; h.losses = (h.losses ?? 0) + 1; }
  }
  return [...m.values()];
}

// ─── Market-implied ratings (no table available) ───────────────────────────

/** Average de-vigged probabilities across books that quote every key. */
function consensusOf(/** @type {Record<string, Record<string, number>>} */ odds, /** @type {string[]} */ keys) {
  const books = Object.values(odds ?? {}).filter((o) => keys.every((k) => o[k] > 1));
  if (!books.length) return null;
  const sums = keys.map(() => 0);
  for (const o of books) fairProbabilities(keys.map((k) => o[k])).forEach((p, i) => (sums[i] += p));
  return sums.map((s) => s / books.length);
}

/** Most common value of a numeric field across books. */
function modeOf(/** @type {Record<string, Record<string, number>>} */ odds, /** @type {string} */ key) {
  const c = new Map();
  for (const o of Object.values(odds ?? {})) if (typeof o[key] === 'number') c.set(o[key], (c.get(o[key]) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/**
 * Ratings that reproduce the market consensus.
 * @param {'football' | 'basketball' | 'hockey' | 'baseball'} family
 * @param {Record<string, Record<string, number>>} odds
 * @param {string} [league]
 * @returns {any} ratings in the family's input shape, or null without a usable market
 */
export function marketRatings(family, odds, league = '') {
  if (family === 'football') {
    const x = consensusOf(odds, ['home', 'draw', 'away']);
    if (!x) return null;
    const ou = consensusOf(odds, ['over25', 'under25']);
    const fit = fitGoalParametersFromProbabilities({ home: x[0], away: x[2], over2_5: ou?.[0] }, -0.06);
    return { lambdaHome: fit.lambdaHome, muAway: fit.muAway, rho: -0.06 };
  }
  const ml = consensusOf(odds, ['homeMoneyline', 'awayMoneyline']);
  if (!ml) return null;
  if (family === 'hockey' || family === 'baseball') {
    const cfg = SCORE_SPORTS[family];
    const T = modeOf(odds, 'totalLine');
    const over = T !== undefined
      ? consensusOf(Object.fromEntries(Object.entries(odds).filter(([, o]) => o.totalLine === T)), ['overOdds', 'underOdds'])
      : null;
    const start = family === 'hockey' ? { home: 3.1, away: 2.9 } : { home: 4.6, away: 4.4 };
    const fit = fitMeans({ homeWin: ml[0], over: over && T !== undefined ? { line: T, prob: over[0] } : undefined }, cfg, start);
    return { homeMean: fit.home, awayMean: fit.away };
  }
  // Basketball: margin and total from the lines, read through the normal model.
  const profile = /nba/i.test(league) && !/g league/i.test(league) ? LEAGUE_PROFILES.NBA : LEAGUE_PROFILES.EuroLeague;
  const neutral = { pace: profile.pace, offRtg: profile.offRtg, defRtg: profile.offRtg };
  const { marginSd, totalSd } = projectScores(neutral, neutral, profile, { hcaPoints: 0 });
  const S = modeOf(odds, 'spreadLine');
  const T = modeOf(odds, 'totalLine');
  const cover = S !== undefined ? consensusOf(Object.fromEntries(Object.entries(odds).filter(([, o]) => o.spreadLine === S)), ['homeSpreadOdds', 'awaySpreadOdds']) : null;
  const over = T !== undefined ? consensusOf(Object.fromEntries(Object.entries(odds).filter(([, o]) => o.totalLine === T)), ['overOdds', 'underOdds']) : null;
  const margin = cover && S !== undefined ? -S - marginSd * probit(1 - cover[0]) : -marginSd * probit(1 - ml[0]);
  const total = over && T !== undefined ? T - totalSd * probit(1 - over[0]) : (2 * profile.pace * profile.offRtg) / 100;
  const hca = 2.8;
  const homePts = (total + margin) / 2;
  const awayPts = (total - margin) / 2;
  const pace = profile.pace;
  return {
    home: { pace, offRtg: (100 * (homePts - hca / 2)) / pace, defRtg: profile.offRtg },
    away: { pace, offRtg: (100 * (awayPts + hca / 2)) / pace, defRtg: profile.offRtg }
  };
}
