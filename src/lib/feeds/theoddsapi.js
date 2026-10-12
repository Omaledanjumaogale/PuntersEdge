/**
 * The Odds API (api.the-odds-api.com/v4): request builders and parsers.
 *
 * Cost of an odds call = markets × regions; naming up to 10 bookmakers costs
 * the same as one region. `/sports` and `/events` are free, so the planner
 * uses `/events` to see which competitions actually have games before
 * spending credits on odds.
 */

import { ODDS_API_BOOKMAKERS, ODDS_API_BOOK_NAMES, ODDS_API_LEAGUES, SPORTS, sportForOddsApiKey } from './catalog.js';

const BASE = 'https://api.the-odds-api.com/v4';

/** Free: in-season sports. */
export const oddsApiSportsUrl = () => `${BASE}/sports`;

/** Free: upcoming events for a sport key (no odds). */
export function oddsApiEventsUrl(/** @type {string} */ sportKey, /** @type {{ from?: number, to?: number }} */ window = {}) {
  const u = new URL(`${BASE}/sports/${sportKey}/events`);
  u.searchParams.set('dateFormat', 'unix');
  if (window.from) u.searchParams.set('commenceTimeFrom', new Date(window.from).toISOString().replace(/\.\d{3}Z$/, 'Z'));
  if (window.to) u.searchParams.set('commenceTimeTo', new Date(window.to).toISOString().replace(/\.\d{3}Z$/, 'Z'));
  return u.toString();
}

/**
 * Odds for a sport key. Returns the URL and its credit cost.
 * @param {string} sportKey
 * @param {{ from?: number, to?: number }} [window]
 */
export function oddsApiOddsUrl(sportKey, window = {}) {
  const sport = sportForOddsApiKey(sportKey);
  const markets = sport ? SPORTS[sport].oddsApiMarkets : 'h2h';
  const u = new URL(`${BASE}/sports/${sportKey}/odds`);
  u.searchParams.set('bookmakers', ODDS_API_BOOKMAKERS.slice(0, 10).join(','));
  u.searchParams.set('markets', markets);
  u.searchParams.set('oddsFormat', 'decimal');
  u.searchParams.set('dateFormat', 'unix');
  if (window.from) u.searchParams.set('commenceTimeFrom', new Date(window.from).toISOString().replace(/\.\d{3}Z$/, 'Z'));
  if (window.to) u.searchParams.set('commenceTimeTo', new Date(window.to).toISOString().replace(/\.\d{3}Z$/, 'Z'));
  return { url: u.toString(), cost: markets.split(',').length * Math.ceil(ODDS_API_BOOKMAKERS.length / 10) };
}

/** Quota headers. */
export function oddsApiUsage(/** @type {{ get(name: string): string | null }} */ headers) {
  const n = (/** @type {string} */ k) => {
    const v = headers.get(k);
    return v === null || v === '' ? undefined : Number(v);
  };
  return { remaining: n('x-requests-remaining'), used: n('x-requests-used'), last: n('x-requests-last') };
}

const ts = (/** @type {any} */ t) => (typeof t === 'number' ? t * 1000 : Date.parse(t));

/**
 * @typedef {Object} OddsEvent
 * @property {string} id
 * @property {import('./catalog.js').SportKey} sport
 * @property {string} sportKey
 * @property {string} league
 * @property {string} home
 * @property {string} away
 * @property {number} kickoff
 * @property {Record<string, Record<string, number>>} odds book → engine-shaped prices
 */

/**
 * Parse `/events` (no odds) or `/odds` responses.
 * @param {any} body
 * @returns {OddsEvent[]}
 */
export function parseOddsApiEvents(body) {
  /** @type {OddsEvent[]} */
  const out = [];
  for (const e of Array.isArray(body) ? body : []) {
    const sport = sportForOddsApiKey(e.sport_key);
    if (!sport || !e.home_team || !e.away_team) continue;
    const fam = SPORTS[sport].family;
    /** @type {Record<string, Record<string, number>>} */
    const odds = {};
    for (const b of e.bookmakers ?? []) {
      const name = ODDS_API_BOOK_NAMES[b.key] ?? b.title ?? b.key;
      /** @type {Record<string, number>} */
      const o = {};
      for (const m of b.markets ?? []) {
        const oc = m.outcomes ?? [];
        const find = (/** @type {string} */ n) => oc.find((/** @type {any} */ x) => x.name === n);
        if (m.key === 'h2h') {
          const h = find(e.home_team)?.price, a = find(e.away_team)?.price, d = find('Draw')?.price;
          if (fam === 'football') {
            if (h > 1 && d > 1 && a > 1) Object.assign(o, { home: h, draw: d, away: a });
          } else if (h > 1 && a > 1) Object.assign(o, { homeMoneyline: h, awayMoneyline: a });
        } else if (m.key === 'totals') {
          // A book may list several lines; keep the most balanced one (2.5 for football if present).
          /** @type {Map<number, { over?: number, under?: number }>} */
          const lines = new Map();
          for (const x of oc) {
            const L = Number(x.point);
            if (!Number.isFinite(L)) continue;
            const cur = lines.get(L) ?? {};
            if (x.name === 'Over') cur.over = x.price;
            if (x.name === 'Under') cur.under = x.price;
            lines.set(L, cur);
          }
          let best;
          for (const [L, p] of lines) {
            if (!((p.over ?? 0) > 1 && (p.under ?? 0) > 1)) continue;
            const gap = fam === 'football' ? Math.abs(L - 2.5) : Math.abs(/** @type {number} */ (p.over) - /** @type {number} */ (p.under));
            if (!best || gap < best.gap) best = { L, ...p, gap };
          }
          if (best) {
            if (fam === 'football') {
              if (best.L === 2.5) Object.assign(o, { over25: best.over, under25: best.under });
            } else Object.assign(o, { totalLine: best.L, overOdds: best.over, underOdds: best.under });
          }
        } else if (m.key === 'spreads' && fam !== 'football') {
          const h = find(e.home_team), a = find(e.away_team);
          if (h?.price > 1 && a?.price > 1 && Number.isFinite(Number(h.point))) {
            Object.assign(o, { spreadLine: Number(h.point), homeSpreadOdds: h.price, awaySpreadOdds: a.price });
          }
        }
      }
      if (Object.keys(o).length) odds[name] = o;
    }
    out.push({
      id: String(e.id),
      sport,
      sportKey: e.sport_key,
      league: ODDS_API_LEAGUES[e.sport_key] ?? e.sport_title ?? e.sport_key,
      home: e.home_team,
      away: e.away_team,
      kickoff: ts(e.commence_time),
      odds
    });
  }
  return out;
}
