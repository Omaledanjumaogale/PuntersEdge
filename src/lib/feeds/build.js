/**
 * Store → app feed.
 *
 * The feed carries engine *inputs* (team strengths, prices, status), not
 * predictions: every device runs the engines itself with the user's own
 * settings, exactly as with the sample data. That keeps the feed small and
 * the maths in one place.
 *
 * This is also where the pick ledger lives: shortly before kickoff we record
 * the engine's top graded value bet for each game, and settle it from the
 * final score once the game is over. That gives an honest track record.
 */

import { SPORTS, SPORT_KEYS } from './catalog.js';
import { footballRatings, basketballRatings, scoreSportRatings, marketRatings } from '../engine/ratings.js';
import { buildFootballPrediction, buildBasketballPrediction } from '../engine/prediction_pipeline.js';
import { buildScoreSportPrediction } from '../engine/score_sports.js';
import { settle, profitFor } from '../engine/settlement.js';

const H = 3600_000;
const DAY = 24 * H;

/**
 * @typedef {import('./store.js').Store} Store
 * @typedef {import('./store.js').StoredGame} StoredGame
 * @typedef {import('./catalog.js').SportKey} SportKey
 */

/** Books shown first (Nigerian favourites, then the sharp anchor); the rest by name. */
const BOOK_ORDER = ['SportyBet', '1xBet', '22Bet', 'Pinnacle', 'Bet365', 'Betway', 'Betfair', 'William Hill', 'Unibet', 'Marathonbet'];
/** Keep feeds small and on-device pricing fast. */
const MAX_BOOKS = 6;

/** Strip fetch timestamps; keep prices only, for the most relevant books. */
function pricesOf(/** @type {StoredGame} */ g) {
  const rank = (/** @type {string} */ b) => {
    const i = BOOK_ORDER.indexOf(b);
    return i === -1 ? BOOK_ORDER.length : i;
  };
  /** @type {Record<string, Record<string, number>>} */
  const out = {};
  for (const [book, o] of Object.entries(g.odds).sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0])).slice(0, MAX_BOOKS)) {
    const { at, ...rest } = o;
    out[book] = rest;
  }
  return out;
}

/**
 * Engine input for a stored game, or null when it can't be priced yet
 * (no prices and no table).
 * @param {Store} store
 * @param {StoredGame} g
 */
export function inputFor(store, g) {
  const def = SPORTS[g.sport];
  const odds = pricesOf(g);
  const table = g.leagueId !== undefined ? store.tables[`${g.sport}:${g.leagueId}:${g.season}`]?.rows : undefined;
  const base = {
    fixtureId: g.uid,
    homeTeam: g.home,
    awayTeam: g.away,
    league: g.league,
    kickoffTime: new Date(g.kickoff).toISOString(),
    status: g.status,
    odds
  };
  /** @type {any} */
  let ratings = null;
  let source = 'market';
  if (table && g.homeId !== undefined && g.awayId !== undefined) {
    if (def.family === 'football') ratings = footballRatings(table, g.homeId, g.awayId);
    else if (def.family === 'basketball') ratings = basketballRatings(table, g.homeId, g.awayId, g.league);
    else ratings = scoreSportRatings(table, g.homeId, g.awayId, def.family);
    if (ratings) source = `the ${g.league} table`;
  }
  if (!ratings) ratings = marketRatings(def.family, odds, g.league);
  if (!ratings) return null;
  return { ...base, ratings, ratingsSource: source };
}

/**
 * Run the right engine for a sport.
 * @param {SportKey} sport
 * @param {any} input
 * @param {{ modelWeight?: number, kellyFraction?: number, now?: number }} [opts]
 * @returns {any}
 */
export function predict(sport, input, opts = {}) {
  const fam = SPORTS[sport].family;
  if (fam === 'football') return buildFootballPrediction(input, opts);
  if (fam === 'basketball') return buildBasketballPrediction(input, { ...opts, sport: /** @type {'basketball' | 'nba'} */ (sport) });
  return buildScoreSportPrediction(input, fam, { ...opts, sport });
}

/**
 * Update the pick ledger: refresh picks for games about to start, settle
 * finished ones.
 * @param {Store} store
 * @param {number} now
 */
export function updateRecord(store, now) {
  for (const g of Object.values(store.games)) {
    const fam = SPORTS[g.sport].family;
    const pending = store.record.pending[g.uid];
    if (g.status.state === 'scheduled' && g.kickoff > now && g.kickoff - now < 6 * H && Object.keys(g.odds).length) {
      const input = inputFor(store, g);
      if (!input) continue;
      try {
        const p = predict(g.sport, input, { now });
        // Quoted market-book selections carry line-specific keys we can settle.
        const best = (p.markets ?? [])
          .flatMap((/** @type {any} */ m) => m.selections)
          .filter((/** @type {any} */ v) => v.pricing === 'quoted' && ['A+', 'A', 'B'].includes(v.grade))
          .sort((/** @type {any} */ a, /** @type {any} */ b) => b.edgePercent - a.edgePercent)[0];
        if (best) {
          const key = best.id.slice(best.id.indexOf(':') + 1);
          store.record.pending[g.uid] = {
            uid: g.uid, sport: g.sport, family: fam, key,
            match: `${g.home} vs ${g.away}`, league: g.league,
            market: best.market, selection: best.selection, bookmaker: best.bookmaker,
            odds: best.bestOdds, edge: best.edgePercent, grade: best.grade, kickoff: g.kickoff
          };
        } else delete store.record.pending[g.uid];
      } catch {
        // A bad input must never stop the feed.
      }
    } else if (pending && g.status.state === 'finished') {
      const s = g.status;
      const outcome = settle(/** @type {any} */ (fam), pending.key, { home: /** @type {number} */ (s.home), away: /** @type {number} */ (s.away), regHome: s.regHome, regAway: s.regAway });
      if (outcome) {
        store.record.settled.push({ ...pending, result: outcome, profit: Math.round(profitFor(outcome, pending.odds) * 100) / 100, score: `${s.home}–${s.away}` });
      }
      delete store.record.pending[g.uid];
    } else if (pending && g.status.state === 'postponed') {
      delete store.record.pending[g.uid];
    }
  }
}

/** Track-record summary. */
export function recordSummary(/** @type {import('./store.js').Pick[]} */ settled) {
  const by = (/** @type {(p: import('./store.js').Pick) => boolean} */ f) => {
    const xs = settled.filter(f);
    const staked = xs.length;
    const profit = xs.reduce((a, p) => a + (p.profit ?? 0), 0);
    const won = xs.filter((p) => p.result === 'won' || p.result === 'half-won').length;
    const lost = xs.filter((p) => p.result === 'lost' || p.result === 'half-lost').length;
    return { picks: staked, won, lost, push: staked - won - lost, profit: Math.round(profit * 100) / 100, roi: staked ? Math.round((profit / staked) * 1000) / 10 : 0 };
  };
  return {
    all: by(() => true),
    grades: Object.fromEntries(['A+', 'A', 'B'].map((g) => [g, by((p) => p.grade === g)])),
    sports: Object.fromEntries(SPORT_KEYS.map((s) => [s, by((p) => p.sport === s)]))
  };
}

/**
 * Build the app feed.
 * @param {Store} store
 * @param {number} now
 * @param {any} [usage] quota summary for the status panel
 */
export function buildFeed(store, now, usage) {
  /** @type {Record<string, any[]>} */
  const inputs = Object.fromEntries(SPORT_KEYS.map((s) => [s, []]));
  const games = [];
  for (const g of Object.values(store.games).sort((a, b) => a.kickoff - b.kickoff)) {
    const inWindow = g.kickoff > now - 3 * DAY && g.kickoff < now + 4 * DAY;
    if (!inWindow) continue;
    const priceable = g.status.state === 'scheduled' || g.status.state === 'live';
    const input = priceable && g.kickoff > now - 4 * H ? inputFor(store, g) : null;
    if (input) inputs[g.sport].push(input);
    games.push({
      id: g.uid,
      sport: g.sport,
      league: g.league,
      home: g.home,
      away: g.away,
      kickoff: new Date(g.kickoff).toISOString(),
      status: g.status,
      books: Object.keys(g.odds).length,
      priced: Boolean(input)
    });
  }
  const settled = store.record.settled;
  return {
    v: 1,
    generatedAt: new Date(now).toISOString(),
    inputs,
    games,
    record: { summary: recordSummary(settled), recent: settled.slice(-60).reverse(), pending: Object.values(store.record.pending).length },
    usage: usage ?? null,
    sources: store.diag
  };
}
