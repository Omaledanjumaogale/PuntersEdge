/**
 * One ingest tick: plan → fetch → parse → merge, with every paid call
 * metered through the ledgers. The network is injected (`fetcher`), so the
 * same code runs in a Convex action in production and against recorded
 * responses in tests.
 */

import { SPORTS, SPORT_KEYS } from './catalog.js';
import { current, spend, planJobs, LIMITS } from './budget.js';
import { listJobs } from './jobs.js';
import { apiSportsUrl, apiSportsErrors, parseGames, parseStandings, parseOdds, paging } from './apisports.js';
import { oddsApiEventsUrl, oddsApiOddsUrl, oddsApiUsage, parseOddsApiEvents } from './theoddsapi.js';
import {
  oddspapiUrl,
  resolveSports,
  pickTournaments,
  resolveBookmakers,
  indexMarkets,
  parseOddspapiOdds,
  parseParticipants,
  parseAccount
} from './oddspapi.js';
import { upsertGames, attachOdds, attachApiSportsOdds, prune, note } from './store.js';

/**
 * @typedef {'api-sports' | 'the-odds-api' | 'oddspapi'} Provider
 * @typedef {{ status: number, body: any, headers: { get(name: string): string | null } }} FetchResult
 * @typedef {(provider: Provider, url: string) => Promise<FetchResult>} Fetcher
 * @typedef {import('./store.js').Store} Store
 * @typedef {import('./jobs.js').Lookups} Lookups
 * @typedef {import('./budget.js').LedgerEntry} LedgerEntry
 */

const H = 3600_000;

/** Min gap between calls to the same host (API-Sports free plans allow 10/min). */
const SPACING = { 'api-sports': 6500, 'the-odds-api': 400, oddspapi: 1100 };
/** Per-tick spend caps, so a day's budget isn't burnt in one tick. */
const PER_TICK = { 'api-sports': 14, 'the-odds-api': 9, oddspapi: 4 };

/**
 * @param {Object} args
 * @param {Store} args.store mutated in place
 * @param {Lookups} args.lookups mutated in place
 * @param {Record<string, LedgerEntry>} args.ledgers
 * @param {Record<string, number>} args.lastRun job id → last run time
 * @param {number} args.now
 * @param {Fetcher} args.fetcher
 * @param {{ apiSports: boolean, oddsApi: boolean, oddspapi: boolean }} args.keys
 * @param {(ms: number) => Promise<void>} [args.sleep]
 * @param {(ledgers: Record<string, LedgerEntry>) => Promise<void>} [args.reserve] persist planned spend before calling out
 * @returns {Promise<{ ledgers: Record<string, LedgerEntry>, lastRun: Record<string, number>, ran: string[], skipped: Array<{ id: string, reason: string }>, storeChanged: boolean, lookupsChanged: boolean, log: string[] }>}
 */
export async function runTick({ store, lookups, ledgers: inLedgers, lastRun: inLastRun, now, fetcher, keys, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), reserve }) {
  /** @type {Record<string, LedgerEntry>} */
  const ledgers = {};
  const ledgerKeys = [...SPORT_KEYS.map((s) => `api-sports:${s}`), 'the-odds-api', 'oddspapi'];
  for (const k of ledgerKeys) ledgers[k] = current(k, inLedgers[k], now);
  const lastRun = { ...inLastRun };
  /** @type {string[]} */
  const log = [];
  let storeChanged = false;
  let lookupsChanged = false;

  const { jobs, protect } = listJobs(store, lookups, now, keys, ledgers);
  const { run, skipped } = planJobs(jobs, ledgers, lastRun, now, { protect, maxPerLedger: PER_TICK });

  // Persist the planned spend first: a crash mid-tick then over-counts, never under-counts.
  if (reserve && run.some((j) => j.cost > 0)) {
    /** @type {Record<string, LedgerEntry>} */
    const reserved = {};
    for (const [k, e] of Object.entries(ledgers)) reserved[k] = e;
    for (const j of run) reserved[j.ledger] = spend(reserved[j.ledger], j.cost, undefined, now);
    await reserve(reserved);
  }

  /** Remaining allowance check for follow-up pages. */
  const canSpend = (/** @type {string} */ ledger, /** @type {number} */ cost) => {
    const e = ledgers[ledger];
    const lim = LIMITS[e.provider];
    const capLeft = lim.limit - lim.reserve - e.used;
    const remote = typeof e.remoteRemaining === 'number' ? e.remoteRemaining - lim.reserve : Infinity;
    return Math.min(capLeft, remote) >= cost;
  };
  /** Hosts that told us to stop this tick (429 etc.). */
  const halted = new Set();
  /** @type {Record<string, number>} */
  const lastCall = {};

  /**
   * Metered call.
   * @param {Provider} provider @param {string} ledger @param {string} url @param {number} cost
   */
  const call = async (provider, ledger, url, cost) => {
    const host = new URL(url).host;
    if (halted.has(host)) throw new Error('halted');
    const wait = (lastCall[host] ?? 0) + SPACING[provider] - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall[host] = Date.now();
    let res;
    try {
      res = await fetcher(provider, url);
    } catch (err) {
      // No response: count it anyway (a request may have reached the provider).
      ledgers[ledger] = spend(ledgers[ledger], cost, undefined, now);
      throw err;
    }
    /** @type {{ remaining?: number, used?: number }} */
    let remote = {};
    let actual = cost;
    if (provider === 'api-sports') {
      const r = res.headers.get('x-ratelimit-requests-remaining');
      if (r !== null && r !== '') remote.remaining = Number(r);
    } else if (provider === 'the-odds-api') {
      const u = oddsApiUsage(res.headers);
      remote = { remaining: u.remaining, used: u.used };
      if (Number.isFinite(u.last)) actual = /** @type {number} */ (u.last);
    }
    if (res.status === 429) {
      halted.add(host);
      if (provider === 'oddspapi' && /LIMIT_EXCEEDED/i.test(JSON.stringify(res.body ?? ''))) remote.remaining = 0;
    }
    if (provider === 'the-odds-api' && res.status === 401 && /quota/i.test(JSON.stringify(res.body ?? ''))) remote.remaining = 0;
    ledgers[ledger] = spend(ledgers[ledger], actual, remote, now);
    if (res.status >= 400) throw new Error(`HTTP ${res.status}${res.body?.message ? `: ${res.body.message}` : ''}`);
    return res.body;
  };

  /** @param {import('./budget.js').Job} job */
  const exec = async (job) => {
    const p = job.params;
    switch (p.kind) {
      case 'games': {
        const def = SPORTS[/** @type {import('./catalog.js').SportKey} */ (p.sport)];
        const params = def.shape === 'fixtures' ? { date: p.date, timezone: 'UTC' } : def.shape === 'nba' ? { date: p.date } : { date: p.date, timezone: 'UTC' };
        const body = await call('api-sports', job.ledger, apiSportsUrl(p.sport, def.gamesPath, params), 1);
        const errs = apiSportsErrors(body);
        if (errs.length) throw new Error(errs.join('; '));
        const games = parseGames(p.sport, body);
        const added = upsertGames(store, games, now);
        note(store, `api-sports:${p.sport}`, true, `${games.length} games on ${p.date} (${added} new)`, now);
        return true;
      }
      case 'standings': {
        const params = p.sport === 'nba' ? { league: 'standard', season: p.season } : { league: p.leagueId, season: p.season };
        const body = await call('api-sports', job.ledger, apiSportsUrl(p.sport, '/standings', params), 1);
        const errs = apiSportsErrors(body);
        if (errs.length) throw new Error(errs.join('; '));
        const rows = parseStandings(p.sport, body);
        if (rows.length) store.tables[`${p.sport}:${p.leagueId}:${p.season}`] = { at: now, rows };
        note(store, `api-sports:${p.sport}:tables`, true, `${rows.length} teams in table ${p.leagueId}`, now);
        return rows.length > 0;
      }
      case 'odds': {
        const base = p.sport === 'football' ? { league: p.leagueId, season: p.season, date: p.date } : { league: p.leagueId, season: p.season };
        let page = 1, total = 1, n = 0;
        do {
          const body = await call('api-sports', job.ledger, apiSportsUrl(p.sport, '/odds', { ...base, ...(page > 1 ? { page } : {}) }), 1);
          const errs = apiSportsErrors(body);
          if (errs.length) throw new Error(errs.join('; '));
          n += attachApiSportsOdds(store, p.sport, parseOdds(p.sport, body), now);
          total = paging(body).total;
          page++;
        } while (page <= Math.min(total, 3) && canSpend(job.ledger, 1));
        note(store, `api-sports:${p.sport}:odds`, true, `prices for ${n} games`, now);
        return n > 0;
      }
      case 'toa-events': {
        const body = await call('the-odds-api', job.ledger, oddsApiEventsUrl(p.key, { from: now - 2 * H, to: now + 3 * 24 * H }), 0);
        const events = parseOddsApiEvents(body);
        const next = events.filter((e) => e.kickoff > now).reduce((a, e) => Math.min(a, e.kickoff), Infinity);
        store.oddsApiEvents[p.key] = { at: now, count: events.filter((e) => e.kickoff > now && e.kickoff < now + 36 * H).length, next: Number.isFinite(next) ? next : undefined };
        const r = attachOdds(store, 'toa', events, now);
        note(store, `the-odds-api:events`, true, `${p.key}: ${events.length} events`, now);
        return r.created > 0 || r.matched > 0;
      }
      case 'toa-odds': {
        const { url, cost } = oddsApiOddsUrl(p.key, { from: now - 1 * H, to: now + 2 * 24 * H });
        const body = await call('the-odds-api', job.ledger, url, cost);
        const events = parseOddsApiEvents(body);
        const r = attachOdds(store, 'toa', events, now);
        note(store, `the-odds-api:odds`, true, `${p.key}: ${events.length} events, ${r.matched} matched`, now);
        return true;
      }
      case 'op-account': {
        const body = await call('oddspapi', job.ledger, oddspapiUrl('/account'), 0);
        const acct = parseAccount(body);
        if (acct) ledgers[job.ledger] = spend(ledgers[job.ledger], 0, { remaining: acct.remaining, used: acct.used }, now);
        return false;
      }
      case 'op-sports': {
        lookups.sportIds = resolveSports(await call('oddspapi', job.ledger, oddspapiUrl('/sports'), 1));
        lookups.month = new Date(now).toISOString().slice(0, 7);
        lookupsChanged = true;
        return false;
      }
      case 'op-markets': {
        lookups.markets = indexMarkets(await call('oddspapi', job.ledger, oddspapiUrl('/markets', { language: 'en' }), 1));
        lookups.month = new Date(now).toISOString().slice(0, 7);
        lookupsChanged = true;
        return false;
      }
      case 'op-bookmakers': {
        lookups.bookmakers = resolveBookmakers(await call('oddspapi', job.ledger, oddspapiUrl('/bookmakers'), 1));
        lookups.month = new Date(now).toISOString().slice(0, 7);
        lookupsChanged = true;
        return false;
      }
      case 'op-tournaments': {
        const body = await call('oddspapi', job.ledger, oddspapiUrl('/tournaments', { sportId: p.sportId }), 1);
        lookups.tournaments ??= {};
        for (const sport of p.sports) lookups.tournaments[sport] = pickTournaments(sport, body);
        (lookups.tournamentsAt ??= {})[p.sportId] = now;
        lookupsChanged = true;
        return false;
      }
      case 'op-participants': {
        const body = await call('oddspapi', job.ledger, oddspapiUrl('/participants', { sportId: p.sportId }), 1);
        (lookups.participants ??= {})[p.sportId] = parseParticipants(body);
        lookupsChanged = true;
        return false;
      }
      case 'op-odds': {
        const books = lookups.bookmakers ?? [];
        const url = oddspapiUrl('/odds-by-tournaments', { tournamentIds: p.tournamentIds.join(','), bookmakers: books.map((b) => b.slug).slice(0, 3).join(',') });
        const body = await call('oddspapi', job.ledger, url, 1);
        const bookNames = Object.fromEntries(books.map((b) => [b.slug, b.name]));
        /** sportId → family; NBA is told apart from other basketball by tournament. */
        const familyOf = (/** @type {number} */ sid) => {
          const sport = SPORT_KEYS.find((s) => lookups.sportIds?.[s] === sid);
          return sport ? SPORTS[sport].family : undefined;
        };
        const fixtures = parseOddspapiOdds(body, lookups.markets ?? {}, bookNames, familyOf);
        const nbaTournaments = new Set((lookups.tournaments?.nba ?? []).map((t) => t.id));
        const events = [];
        for (const f of fixtures) {
          const names = lookups.participants?.[f.sportId] ?? {};
          const home = names[f.homeId];
          const away = names[f.awayId];
          if (!home || !away) continue;
          let sport = SPORT_KEYS.find((s) => lookups.sportIds?.[s] === f.sportId && s !== 'nba');
          if (nbaTournaments.has(f.tournamentId)) sport = 'nba';
          if (!sport) continue;
          const t = Object.values(lookups.tournaments ?? {}).flat().find((x) => x.id === f.tournamentId);
          events.push({ id: f.id, sport, league: t?.name ?? '', home, away, kickoff: f.kickoff, odds: f.odds, state: f.state });
        }
        const r = attachOdds(store, 'op', events, now);
        note(store, 'oddspapi:odds', true, `${fixtures.length} fixtures, ${events.length} named, ${r.matched} matched`, now);
        return true;
      }
    }
    return false;
  };

  // Providers run in parallel; calls to one provider run in order (cooldowns).
  /** @type {Record<string, import('./budget.js').Job[]>} */
  const byHost = {};
  for (const j of run) {
    const host = j.ledger;
    (byHost[host] ??= []).push(j);
  }
  const ran = [];
  await Promise.all(
    Object.values(byHost).map(async (list) => {
      for (const job of list) {
        try {
          const changed = await exec(job);
          if (changed) storeChanged = true;
          lastRun[job.id] = now;
          ran.push(job.id);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg !== 'halted') {
            note(store, job.id.split(':').slice(0, 2).join(':'), false, msg, now);
            log.push(`${job.id}: ${msg}`);
            // Back off: don't retry a failing job until its next slot.
            lastRun[job.id] = now;
            storeChanged = true;
          }
        }
      }
    })
  );

  const before = Object.keys(store.games).length;
  prune(store, now);
  if (Object.keys(store.games).length !== before) storeChanged = true;

  return { ledgers, lastRun, ran, skipped, storeChanged, lookupsChanged, log };
}
