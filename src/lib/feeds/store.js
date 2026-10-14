/**
 * The ingest store: one compact object holding every game we follow, the
 * latest prices per bookmaker, league tables and the pick ledger. It lives in
 * Convex file storage (not database rows) and is rewritten only when a tick
 * fetched something, which keeps database I/O near zero.
 */

import { bestMatch } from './matching.js';

/**
 * @typedef {import('./catalog.js').SportKey} SportKey
 * @typedef {import('./apisports.js').GameStatus} GameStatus
 * @typedef {Object} StoredGame
 * @property {string} uid `${sport}-${src}-${id}`, stable and URL-safe
 * @property {SportKey} sport
 * @property {string} league
 * @property {string | number} [leagueId] API-Sports league id
 * @property {string | number} [season]
 * @property {string} home
 * @property {string} away
 * @property {string | number} [homeId] API-Sports team ids (for tables)
 * @property {string | number} [awayId]
 * @property {number} kickoff
 * @property {GameStatus} status
 * @property {{ as?: string, toa?: string, op?: string }} ext provider ids
 * @property {Record<string, Record<string, number> & { at: number }>} odds book → prices (+ fetch time)
 * @property {number} updated
 */

/**
 * @typedef {Object} Pick
 * @property {string} uid
 * @property {SportKey} sport
 * @property {string} family
 * @property {string} key market-book key
 * @property {string} match
 * @property {string} league
 * @property {string} market
 * @property {string} selection
 * @property {string} bookmaker
 * @property {number} odds
 * @property {number} edge
 * @property {string} grade
 * @property {number} kickoff
 * @property {number} [publishedAt]
 * @property {string} [result] won | lost | push | half-won | half-lost
 * @property {number} [profit] units per 1 staked
 * @property {string} [score]
 */

/**
 * @typedef {Object} Store
 * @property {Record<string, any>} projections
 * @property {1} v
 * @property {Record<string, StoredGame>} games
 * @property {Record<string, { at: number, rows: import('../engine/ratings.js').TableRow[] }>} tables `${sport}:${leagueId}:${season}`
 * @property {Record<string, { at: number, count: number, next?: number }>} oddsApiEvents per The Odds API key
 * @property {{ pending: Record<string, Pick>, settled: Pick[] }} record
 * @property {Record<string, { at: number, ok: boolean, msg: string }>} diag per source
 */

/** @returns {Store} */
export function emptyStore() {
  return { v: 1, projections: {}, games: {}, tables: {}, oddsApiEvents: {}, record: { pending: {}, settled: [] }, diag: {} };
}

/** Make sure an object read from storage has every field. */
export function reviveStore(/** @type {any} */ raw) {
  const s = emptyStore();
  if (!raw || raw.v !== 1) return s;
  return {
    ...s,
    ...raw,
    record: { pending: raw.record?.pending ?? {}, settled: raw.record?.settled ?? [] },
    diag: raw.diag ?? {},
    tables: raw.tables ?? {},
    oddsApiEvents: raw.oddsApiEvents ?? {},
    projections: raw.projections ?? {},
    games: raw.games ?? {}
  };
}

const safe = (/** @type {string} */ s) => String(s).replace(/[^A-Za-z0-9_]/g, '');
export const uidOf = (/** @type {SportKey} */ sport, /** @type {string} */ src, /** @type {string} */ id) => `${sport}-${src}-${safe(id)}`;

/** Note how a source did, for the data-status panel. */
export function note(/** @type {Store} */ store, /** @type {string} */ source, /** @type {boolean} */ ok, /** @type {string} */ msg, /** @type {number} */ now) {
  store.diag[source] = { at: now, ok, msg: msg.slice(0, 160) };
}

/** Merge prices into a game, newest wins per bookmaker. */
function mergeOdds(/** @type {StoredGame} */ g, /** @type {Record<string, Record<string, number>>} */ odds, /** @type {number} */ now) {
  for (const [book, o] of Object.entries(odds ?? {})) {
    if (!o || !Object.keys(o).length) continue;
    const previous={...(g.odds[book]??{})};
    // Replace complete market groups atomically: an old price must never be
    // attached to a newly supplied line or one side of a refreshed market.
    const groups=[['home','draw','away'],['homeMoneyline','awayMoneyline'],['over25','under25'],['bttsYes','bttsNo'],['totalLine','overOdds','underOdds'],['spreadLine','homeSpreadOdds','awaySpreadOdds']];
    for(const group of groups)if(group.some(k=>o[k]!==undefined))for(const k of group){delete previous[k];delete previous[`__source_${k}`];}
    g.odds[book] = { ...previous,...o, at: now };
  }
}

/**
 * Upsert API-Sports games (the schedule/results backbone). An odds-only game
 * already in the store for the same match is folded into the new entry.
 * @param {Store} store
 * @param {import('./apisports.js').NGame[]} games
 * @param {number} now
 */
export function upsertGames(store, games, now) {
  let added = 0;
  const byAs = new Map(Object.values(store.games).filter(g=>g.ext.as).map(g=>[`${g.sport}:${g.ext.as}`,g]));
  for (const n of games) {
    const canonical = uidOf(n.sport, 'as', n.id);
    let g = store.games[canonical] ?? byAs.get(`${n.sport}:${n.id}`);
    if (!g) {
      const orphans = Object.values(store.games).filter((x) => x.sport === n.sport && !x.ext.as);
      const m = bestMatch({ home: n.home, away: n.away, kickoff: n.kickoff }, orphans);
      // Preserve the first published ID so projections, URLs and saved slips retain one identity.
      g = m?.item ?? { uid:canonical, sport:n.sport, league:n.league, home:n.home, away:n.away, kickoff:n.kickoff, status:n.status, ext:{}, odds:{}, updated:now };
      store.games[g.uid] = g;
      added++;
    }
    Object.assign(g, {
      league: n.league,
      leagueId: n.leagueId,
      season: n.season,
      home: n.home,
      away: n.away,
      homeId: n.homeId,
      awayId: n.awayId,
      kickoff: n.kickoff,
      status: n.status,
      updated: now
    });
    g.ext.as = n.id;
    byAs.set(`${n.sport}:${n.id}`,g);
  }
  return added;
}

/**
 * Attach odds-provider events to games. Unknown events become odds-only games
 * (so a game still shows when API-Sports is down or doesn't cover it).
 * @param {Store} store
 * @param {'toa' | 'op'} src
 * @param {Array<{ id: string, sport: SportKey, league: string, home: string, away: string, kickoff: number, odds: Record<string, Record<string, number>>, state?: string }>} events
 * @param {number} now
 * @returns {{ matched: number, created: number }}
 */
export function attachOdds(store, src, events, now) {
  let matched = 0, created = 0;
  const all = Object.values(store.games);
  for (const e of events) {
    if (!e.home || !e.away || !Number.isFinite(e.kickoff)) continue;
    let g = all.find((x) => x.sport === e.sport && x.ext[src] === e.id);
    if (!g) {
      const pool = all.filter((x) => x.sport === e.sport && !x.ext[src]);
      const m = bestMatch({ home: e.home, away: e.away, kickoff: e.kickoff }, pool);
      if (m) {
        g = m.item;
        matched++;
      }
    } else matched++;
    if (!g) {
      if (e.state === 'finished') continue;
      const uid = uidOf(e.sport, src, e.id);
      g = { uid, sport: e.sport, league: e.league, home: e.home, away: e.away, kickoff: e.kickoff, status: { state: 'scheduled' }, ext: {}, odds: {}, updated: now };
      store.games[uid] = g;
      all.push(g);
      created++;
    }
    g.ext[src] = e.id;
    mergeOdds(g, e.odds, now);
    g.updated = now;
  }
  return { matched, created };
}

/**
 * Attach API-Sports odds keyed by fixture id.
 * @param {Store} store
 * @param {SportKey} sport
 * @param {Record<string, Record<string, Record<string, number>>>} byGame
 * @param {number} now
 */
export function attachApiSportsOdds(store, sport, byGame, now) {
  let n = 0;
  for (const [id, odds] of Object.entries(byGame)) {
    const g = store.games[uidOf(sport, 'as', id)] ?? Object.values(store.games).find(game=>game.sport===sport&&game.ext.as===id);
    if (!g) continue;
    mergeOdds(g, odds, now);
    n++;
  }
  return n;
}

/**
 * Drop old games and stale prices so the store stays small.
 * @param {Store} store
 * @param {number} now
 */
export function prune(store, now) {
  const H = 3600_000;
  for (const [uid, g] of Object.entries(store.games)) {
    const age = now - g.kickoff;
    const oddsOnly = !g.ext.as;
    if (age > (store.projections[uid]?7:3) * 24 * H || (oddsOnly && age > 6 * H && !store.projections[uid]) || (g.status.state === 'postponed' && age > 12 * H && !store.projections[uid])) {
      delete store.games[uid];
      continue;
    }
    // Prices older than 36 h are no longer a fair view of the market.
    for (const [book, o] of Object.entries(g.odds)) if (now - (o.at ?? 0) > 36 * H) delete g.odds[book];
  }
  for (const [k, t] of Object.entries(store.tables)) if (now - t.at > 10 * 24 * H) delete store.tables[k];
  for (const [uid, p] of Object.entries(store.record.pending)) if (now - p.kickoff > 4 * 24 * H) delete store.record.pending[uid];
  // Keep a correction window separate from the twelve-hour UI review window.
  for(const [id,p] of Object.entries(store.projections)) if(p.finishedAt && now >= p.finishedAt + 7 * 24 * H) delete store.projections[id];
  store.record.settled = store.record.settled.slice(-300);
}
