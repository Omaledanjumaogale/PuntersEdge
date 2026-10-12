/**
 * What to fetch, and how often.
 *
 * Every tick (every 30 minutes) we list the jobs that could run, with their
 * cost, priority and minimum interval; `planJobs` then picks the ones that
 * are due and fit today's allowance. Cadence follows the games: today's
 * schedule refreshes every 30 min while games are live and hourly otherwise;
 * odds refresh a few times a day for competitions that actually have games
 * coming up; lookups run monthly.
 */

import { SPORTS, SPORT_KEYS } from './catalog.js';
import { oddsApiOddsUrl } from './theoddsapi.js';
import { TOURNAMENTS_PER_CALL } from './oddspapi.js';
import { allowance, current, daysInMonth } from './budget.js';

const MIN = 60_000;
const H = 60 * MIN;
const DAY = 24 * H;

/**
 * Refresh interval for a monthly provider: spread today's fair share of the
 * month over `sweepCost` units per full refresh, between 2 h and 24 h.
 */
function pacedEvery(/** @type {import('./budget.js').LedgerEntry | undefined} */ e, /** @type {string} */ key, /** @type {number} */ sweepCost, /** @type {number} */ now) {
  const entry = current(key, e, now);
  const a = allowance({ ...entry, dayUsed: 0, used: entry.used - entry.dayUsed }, now);
  const daysLeft = daysInMonth(now) - new Date(now).getUTCDate() + 1;
  const perDay = Math.max(a.window / daysLeft, 0.01);
  const sweeps = perDay / Math.max(1, sweepCost);
  return Math.min(24 * H, Math.max(2 * H, (24 * H) / sweeps)) - 2 * MIN;
}

/** UTC date string offset by n days. */
export const dateOffset = (/** @type {number} */ now, /** @type {number} */ n) => new Date(now + n * DAY).toISOString().slice(0, 10);

/**
 * @typedef {import('./budget.js').Job} Job
 * @typedef {import('./store.js').Store} Store
 * @typedef {Object} Lookups OddsPapi id → name lookups (refreshed monthly)
 * @property {string} [month]
 * @property {Partial<Record<import('./catalog.js').SportKey, number>>} [sportIds]
 * @property {Record<string, any>} [markets]
 * @property {Array<{ slug: string, name: string }>} [bookmakers]
 * @property {Record<string, Array<{ id: number, name: string, category: string, upcoming: number }>>} [tournaments] by sport
 * @property {Record<string, number>} [tournamentsAt]
 * @property {Record<string, Record<string, string>>} [participants] by sport id
 */

/**
 * @param {Store} store
 * @param {Lookups} lookups
 * @param {number} now
 * @param {{ apiSports: boolean, oddsApi: boolean, oddspapi: boolean }} keys which providers are configured
 * @param {Record<string, import('./budget.js').LedgerEntry>} [ledgers] to pace monthly providers
 * @returns {{ jobs: Job[], protect: Record<string, number> }}
 */
export function listJobs(store, lookups, now, keys, ledgers = {}) {
  /** @type {Job[]} */
  const jobs = [];
  /** @type {Record<string, number>} */
  const protect = {};
  const games = Object.values(store.games);
  const endOfDay = Date.parse(`${dateOffset(now, 0)}T23:59:59Z`);
  const hoursLeft = Math.max(0, (endOfDay - now) / H);

  if (keys.apiSports) {
    for (const sport of SPORT_KEYS) {
      const def = SPORTS[sport];
      const ledger = `api-sports:${sport}`;
      const mine = games.filter((g) => g.sport === sport && g.ext.as);
      const today = mine.filter((g) => new Date(g.kickoff).toISOString().slice(0, 10) === dateOffset(now, 0));
      const live = mine.some((g) => g.status.state === 'live' || (g.status.state === 'scheduled' && g.kickoff < now && now - g.kickoff < 4 * H));
      const pendingToday = today.some((g) => g.status.state === 'scheduled');
      const todayEvery = live ? 30 * MIN : pendingToday ? 60 * MIN : 3 * H;

      jobs.push({ id: `as:${sport}:day:0`, ledger, cost: 1, priority: 1, every: todayEvery - 2 * MIN, params: { kind: 'games', sport, date: dateOffset(now, 0) } });
      jobs.push({ id: `as:${sport}:day:1`, ledger, cost: 1, priority: 2, every: 6 * H - 2 * MIN, params: { kind: 'games', sport, date: dateOffset(now, 1) } });
      jobs.push({ id: `as:${sport}:day:-1`, ledger, cost: 1, priority: 3, every: 12 * H - 2 * MIN, params: { kind: 'games', sport, date: dateOffset(now, -1) } });
      jobs.push({ id: `as:${sport}:day:2`, ledger, cost: 1, priority: 4, every: 12 * H - 2 * MIN, params: { kind: 'games', sport, date: dateOffset(now, 2) } });
      // Keep enough for the rest of today's schedule refreshes before spending on extras.
      protect[ledger] = Math.ceil(hoursLeft * (live ? 2 : 1)) + Math.ceil(hoursLeft / 6) + 2;

      // League tables for competitions with games in the next three days.
      const upcoming = mine.filter((g) => g.kickoff > now - 3 * H && g.kickoff < now + 3 * DAY && g.leagueId !== undefined);
      const leagues = new Map(upcoming.map((g) => [`${g.leagueId}:${g.season}`, { leagueId: g.leagueId, season: g.season }]));
      for (const [k, l] of leagues) {
        const fresh = store.tables[`${sport}:${k}`];
        jobs.push({
          id: `as:${sport}:table:${k}`,
          ledger,
          cost: 1,
          priority: fresh ? 6 : 5,
          every: 20 * H,
          params: { kind: 'standings', sport, leagueId: l.leagueId, season: l.season }
        });
      }

      // Bookmaker odds (football: per league and date; other sports: per league).
      if (def.apiSportsOdds) {
        const soon = mine.filter((g) => g.status.state === 'scheduled' && g.kickoff > now && g.kickoff < now + 2 * DAY);
        if (sport === 'football') {
          const pairs = new Map(soon.map((g) => {
            const date = new Date(g.kickoff).toISOString().slice(0, 10);
            return [`${g.leagueId}:${date}`, { leagueId: g.leagueId, season: g.season, date }];
          }));
          for (const [k, p] of pairs) {
            jobs.push({ id: `as:${sport}:odds:${k}`, ledger, cost: 1, priority: p.date === dateOffset(now, 0) ? 7 : 8, every: 8 * H, params: { kind: 'odds', sport, ...p } });
          }
        } else {
          const ls = new Map(soon.map((g) => [`${g.leagueId}:${g.season}`, { leagueId: g.leagueId, season: g.season }]));
          for (const [k, p] of ls) jobs.push({ id: `as:${sport}:odds:${k}`, ledger, cost: 1, priority: 8, every: 12 * H, params: { kind: 'odds', sport, ...p } });
        }
      }
    }
  }

  if (keys.oddsApi) {
    const ledger = 'the-odds-api';
    const active = SPORT_KEYS.flatMap((sport) => SPORTS[sport].theOddsApi).filter((key) => {
      const ev = store.oddsApiEvents[key];
      return ev && ev.count > 0 && !(ev.next && ev.next > now + 36 * H);
    });
    const sweepCost = active.reduce((a, key) => a + oddsApiOddsUrl(key).cost, 0);
    const toaEvery = pacedEvery(ledgers[ledger], ledger, sweepCost, now);
    for (const sport of SPORT_KEYS) {
      for (const key of SPORTS[sport].theOddsApi) {
        // Free: which keys have games soon.
        jobs.push({ id: `toa:events:${key}`, ledger, cost: 0, priority: 0, every: 12 * H - 2 * MIN, params: { kind: 'toa-events', key } });
        const ev = store.oddsApiEvents[key];
        if (!ev || ev.count === 0 || (ev.next && ev.next > now + 36 * H)) continue;
        const { cost } = oddsApiOddsUrl(key);
        const tier = SPORTS[sport].competitions[0]?.tier ?? 2;
        // Busy, top-tier competitions first; then whatever has gone longest without a refresh.
        jobs.push({ id: `toa:odds:${key}`, ledger, cost, priority: 10 + tier * 2 - Math.min(3, ev.count / 4), every: toaEvery, params: { kind: 'toa-odds', key } });
      }
    }
  }

  if (keys.oddspapi) {
    const ledger = 'oddspapi';
    const month = new Date(now).toISOString().slice(0, 7);
    const stale = lookups.month !== month;
    // Free usage check.
    jobs.push({ id: 'op:account', ledger, cost: 0, priority: 0, every: 6 * H, params: { kind: 'op-account' } });
    // Monthly lookups draw on the month's reserve, not the daily share.
    if (stale || !lookups.sportIds) jobs.push({ id: 'op:sports', ledger, cost: 1, priority: 1, every: 0, force: stale, window: true, params: { kind: 'op-sports' } });
    if (stale || !lookups.markets) jobs.push({ id: 'op:markets', ledger, cost: 1, priority: 1, every: 0, force: stale, window: true, params: { kind: 'op-markets' } });
    if (stale || !lookups.bookmakers) jobs.push({ id: 'op:bookmakers', ledger, cost: 1, priority: 1, every: 0, force: stale, window: true, params: { kind: 'op-bookmakers' } });
    if (lookups.sportIds) {
      const ids = new Map();
      for (const sport of SPORT_KEYS) {
        const sid = lookups.sportIds[sport];
        if (sid === undefined) continue;
        if (!ids.has(sid)) ids.set(sid, []);
        ids.get(sid).push(sport);
      }
      for (const [sid, sports] of ids) {
        const at = lookups.tournamentsAt?.[sid] ?? 0;
        if (stale || now - at > 7 * DAY) jobs.push({ id: `op:tournaments:${sid}`, ledger, cost: 1, priority: 2, every: 0, window: true, params: { kind: 'op-tournaments', sportId: sid, sports } });
        if (stale || !lookups.participants?.[sid]) jobs.push({ id: `op:participants:${sid}`, ledger, cost: 1, priority: 2, every: 0, window: true, params: { kind: 'op-participants', sportId: sid } });
      }
    }
    // Odds: followed tournaments with fixtures, a few per call.
    if (lookups.markets && lookups.bookmakers && lookups.tournaments) {
      const ids = new Set();
      for (const sport of SPORT_KEYS) {
        for (const t of lookups.tournaments[sport] ?? []) if (t.upcoming > 0) ids.add(t.id);
      }
      const list = [...ids].sort((a, b) => a - b);
      const opEvery = pacedEvery(ledgers[ledger], ledger, Math.ceil(list.length / TOURNAMENTS_PER_CALL), now);
      for (let i = 0; i < list.length; i += TOURNAMENTS_PER_CALL) {
        const chunk = list.slice(i, i + TOURNAMENTS_PER_CALL);
        jobs.push({ id: `op:odds:${chunk.join(',')}`, ledger, cost: 1, priority: 10 + i / TOURNAMENTS_PER_CALL, every: opEvery, params: { kind: 'op-odds', tournamentIds: chunk } });
      }
    }
  }

  return { jobs, protect };
}
