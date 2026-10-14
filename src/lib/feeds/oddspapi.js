/**
 * OddsPapi (api.oddspapi.io/v4): request builders, lookups and parsers.
 *
 * Odds come keyed by numeric ids (participants, markets, outcomes), so a small
 * monthly lookup (sports, tournaments, markets, bookmakers, participants of
 * the tournaments we follow) turns them into names. One odds call covers
 * several tournaments for exactly one bookmaker; the endpoint has a 1 s
 * cooldown. `/v4/account` is free and reports the month's usage.
 */

import { SPORTS, SPORT_KEYS, ODDSPAPI_BOOKMAKERS } from './catalog.js';

const BASE = 'https://api.oddspapi.io/v4';

/** @param {string} path @param {Record<string, string | number>} [params] */
export function oddspapiUrl(path, params = {}) {
  const u = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  return u.toString(); // apiKey is appended by the fetcher, never stored
}

/** Tournaments per odds call (the docs set no maximum; keep URLs and payloads modest). */
export const TOURNAMENTS_PER_CALL = 4;

const arr = (/** @type {any} */ x) => (Array.isArray(x) ? x : Array.isArray(x?.data) ? x.data : []);

/**
 * Resolve sport ids from `/v4/sports`.
 * @param {any} body
 * @returns {Partial<Record<import('./catalog.js').SportKey, number>>}
 */
export function resolveSports(body) {
  /** @type {Partial<Record<import('./catalog.js').SportKey, number>>} */
  const out = {};
  for (const s of arr(body)) {
    const name = s.sportName ?? s.name ?? s.slug ?? '';
    const id = Number(s.sportId ?? s.id);
    for (const k of SPORT_KEYS) if (out[k] === undefined && SPORTS[k].oddspapiSport.test(name)) out[k] = id;
  }
  // Documented ids, as a fallback.
  out.football ??= 10;
  out.basketball ??= 11;
  out.nba ??= out.basketball;
  return out;
}

/**
 * Tournaments we follow for a sport, from `/v4/tournaments?sportId=`.
 * @param {import('./catalog.js').SportKey} sport
 * @param {any} body
 * @returns {Array<{ id: number, name: string, category: string, upcoming: number }>}
 */
export function pickTournaments(sport, body) {
  const rules = SPORTS[sport].oddspapiTournaments;
  const out = [];
  for (const t of arr(body)) {
    const name = t.tournamentName ?? '';
    const category = t.categoryName ?? '';
    if (!rules.some((r) => r.name.test(name) && (!r.category || r.category.test(category)))) continue;
    out.push({ id: Number(t.tournamentId), name, category, upcoming: Number(t.upcomingFixtures ?? 0) + Number(t.futureFixtures ?? 0) + Number(t.liveFixtures ?? 0) });
  }
  return out;
}

/**
 * Bookmaker slugs for SportyBet, 1xBet and 22Bet from `/v4/bookmakers`.
 * @param {any} body
 * @returns {Array<{ slug: string, name: string }>}
 */
export function resolveBookmakers(body) {
  const list = arr(body);
  const out = [];
  for (const want of ODDSPAPI_BOOKMAKERS) {
    const hit = list.find((/** @type {any} */ b) => want.match.test(b.bookmakerName ?? b.name ?? '') || want.match.test(b.slug ?? ''));
    if (hit) out.push({ slug: String(hit.slug ?? hit.bookmaker ?? hit.bookmakerName).toLowerCase(), name: want.name });
  }
  // Documented slugs, as a fallback.
  if (!out.length) return [{ slug: 'sportybet', name: 'SportyBet' }, { slug: '1xbet', name: '1xBet' }, { slug: '22bet', name: '22Bet' }];
  return out;
}

/**
 * @typedef {{ kind: '1x2' | 'ml' | 'total' | 'spread' | 'btts', line: number, outcomes: Record<string, string>, sportId?: number }} MarketDef
 */

/**
 * Index the market catalogue: for each sport id, the full-time markets we price.
 * Outcome ids map to roles: home/draw/away, over/under, yes/no.
 * @param {any} body
 * @returns {Record<string, MarketDef>} marketId → definition
 */
export function indexMarkets(body) {
  /** @type {Record<string, MarketDef>} */
  const out = {};
  for (const m of arr(body)) {
    if (m.playerProp) continue;
    const name = String(m.marketName ?? '');
    const type = String(m.marketType ?? '').toLowerCase();
    const period = String(m.period ?? '').toLowerCase();
    // Full game only (regulation-only and part-game markets are skipped).
    if (period && !/^(fulltime|full time|ft|result|match|game|ot|overtime|incl|total)/.test(period)) continue;
    if (/half|quarter|period|inning|1st|2nd|3rd|corner|card|booking/i.test(name)) continue;
    const outs = arr(m.outcomes).map((/** @type {any} */ o) => ({ id: String(o.outcomeId), name: String(o.outcomeName ?? '').toLowerCase() }));
    /** @type {Record<string, string>} */
    const roles = {};
    for (const o of outs) {
      if (o.name === '1' || o.name === 'home') roles[o.id] = 'home';
      else if (o.name === 'x' || o.name === 'draw') roles[o.id] = 'draw';
      else if (o.name === '2' || o.name === 'away') roles[o.id] = 'away';
      else if (o.name === 'over') roles[o.id] = 'over';
      else if (o.name === 'under') roles[o.id] = 'under';
      else if (o.name === 'yes') roles[o.id] = 'yes';
      else if (o.name === 'no') roles[o.id] = 'no';
    }
    const has = (/** @type {string[]} */ rs) => rs.every((r) => Object.values(roles).includes(r));
    const line = Number(m.handicap ?? 0);
    /** @type {MarketDef['kind'] | undefined} */
    let kind;
    if (/both teams/i.test(name) && has(['yes', 'no'])) kind = 'btts';
    else if (has(['over', 'under'])) kind = 'total';
    else if (has(['home', 'draw', 'away']) && outs.length === 3 && line === 0) kind = '1x2';
    else if (has(['home', 'away']) && outs.length === 2 && /handicap|spread|asian/i.test(`${type} ${name}`)) kind = 'spread';
    else if (has(['home', 'away']) && outs.length === 2 && line === 0) kind = 'ml';
    if (kind) out[String(m.marketId)] = { kind, line, outcomes: roles, sportId: Number(m.sportId) };
  }
  return out;
}

/**
 * @typedef {Object} PapiFixture
 * @property {string} id
 * @property {number} sportId
 * @property {number} tournamentId
 * @property {number} homeId
 * @property {number} awayId
 * @property {number} kickoff
 * @property {'scheduled' | 'live' | 'finished'} state
 * @property {Record<string, Record<string, number>>} odds book → engine-shaped prices
 */

/**
 * Parse `/v4/odds-by-tournaments`.
 * @param {any} body
 * @param {Record<string, MarketDef & { sportId?: number }>} markets from `indexMarkets`
 * @param {Record<string, string>} bookNames slug → display name
 * @param {(sportId: number) => 'football' | 'basketball' | 'hockey' | 'baseball' | undefined} familyOf
 * @returns {PapiFixture[]}
 */
export function parseOddspapiOdds(body, markets, bookNames, familyOf) {
  /** @type {PapiFixture[]} */
  const out = [];
  for (const f of arr(body)) {
    const fam = familyOf(Number(f.sportId));
    if (!fam) continue;
    /** @type {Record<string, Record<string, number>>} */
    const odds = {};
    for (const [slug, b] of Object.entries(f.bookmakerOdds ?? {})) {
      if (/** @type {any} */ (b)?.bookmakerIsActive === false || /** @type {any} */(b)?.suspended === true) continue;
      /** @type {Array<{ def: MarketDef, prices: Record<string, number>, times:Record<string,number>, main: boolean }>} */
      const found = [];
      for (const [mid, m] of Object.entries(/** @type {any} */ (b)?.markets ?? {})) {
        const def = markets[mid];
        if (!def || /** @type {any} */(m)?.marketActive===false) continue;
        /** @type {Record<string, number>} */
        const prices = {};
        /** @type {Record<string,number>} */ const times={};
        let main = Boolean(/** @type {any} */ (m)?.mainLine);
        for (const [oid, oc] of Object.entries(/** @type {any} */ (m)?.outcomes ?? {})) {
          const role = def.outcomes[oid];
          const p = /** @type {any} */ (oc)?.players?.['0'];
          if (!role || !p || p.active === false) continue;
          const price = Number(p.price);
          if (price > 1){prices[role] = price;const at=Date.parse(p.bookmakerChangedAt??p.changedAt);if(Number.isFinite(at))times[role]=at;}
          if (p.mainLine || /** @type {any} */ (oc)?.mainLine) main = true;
        }
        found.push({ def, prices, times, main });
      }
      /** @type {Record<string, number>} */
      const o = {};
      const sources=(/** @type {{times:Record<string,number>}} */m,/** @type {Record<string,string>} */mapping)=>{for(const [key,role]of Object.entries(mapping))if(Number.isFinite(m.times[role]))o['__source_'+key]=m.times[role];};
      const lineSource=(/** @type {{times:Record<string,number>}} */m,/** @type {string} */key,/** @type {string[]} */roles)=>{if(roles.every(role=>Number.isFinite(m.times[role])))o['__source_'+key]=Math.min(...roles.map(role=>m.times[role]));};
      const pickLine = (/** @type {'total' | 'spread'} */ kind, /** @type {[string, string]} */ roles, /** @type {number | undefined} */ prefer) => {
        const c = found.filter((x) => x.def.kind === kind && x.prices[roles[0]] > 1 && x.prices[roles[1]] > 1);
        if (!c.length) return undefined;
        if (prefer !== undefined) return c.find((x) => x.def.line === prefer);
        return c.find((x) => x.main) ?? c.reduce((a, x) => (Math.abs(x.prices[roles[0]] - x.prices[roles[1]]) < Math.abs(a.prices[roles[0]] - a.prices[roles[1]]) ? x : a));
      };
      if (fam === 'football') {
        const x = found.find((m) => m.def.kind === '1x2' && m.prices.home > 1 && m.prices.draw > 1 && m.prices.away > 1);
        if (!x) continue;
        Object.assign(o, { home: x.prices.home, draw: x.prices.draw, away: x.prices.away });sources(x,{home:'home',draw:'draw',away:'away'});
        const t = pickLine('total', ['over', 'under'], 2.5);
        if (t){Object.assign(o, { over25: t.prices.over, under25: t.prices.under });sources(t,{over25:'over',under25:'under'});}
        const bt = found.find((m) => m.def.kind === 'btts' && m.prices.yes > 1 && m.prices.no > 1);
        if (bt){Object.assign(o, { bttsYes: bt.prices.yes, bttsNo: bt.prices.no });sources(bt,{bttsYes:'yes',bttsNo:'no'});}
      } else {
        const ml = found.find((m) => m.def.kind === 'ml' && m.prices.home > 1 && m.prices.away > 1);
        if (!ml) continue;
        Object.assign(o, { homeMoneyline: ml.prices.home, awayMoneyline: ml.prices.away });sources(ml,{homeMoneyline:'home',awayMoneyline:'away'});
        const t = pickLine('total', ['over', 'under'], undefined);
        if (t){Object.assign(o, { totalLine: t.def.line, overOdds: t.prices.over, underOdds: t.prices.under });sources(t,{overOdds:'over',underOdds:'under'});lineSource(t,'totalLine',['over','under']);}
        const s = pickLine('spread', ['home', 'away'], undefined);
        if (s){Object.assign(o, { spreadLine: s.def.line, homeSpreadOdds: s.prices.home, awaySpreadOdds: s.prices.away });sources(s,{homeSpreadOdds:'home',awaySpreadOdds:'away'});lineSource(s,'spreadLine',['home','away']);}
      }
      odds[bookNames[slug] ?? slug] = o;
    }
    const status = Number(f.statusId);
    out.push({
      id: String(f.fixtureId),
      sportId: Number(f.sportId),
      tournamentId: Number(f.tournamentId),
      homeId: Number(f.participant1Id),
      awayId: Number(f.participant2Id),
      kickoff: Date.parse(f.startTime),
      state: status === 3 ? 'finished' : status === 2 ? 'live' : 'scheduled',
      odds
    });
  }
  return out;
}

/**
 * Participants `{ id: name }` (or a list) → Map.
 * @param {any} body
 * @returns {Record<string, string>}
 */
export function parseParticipants(body) {
  if (body && !Array.isArray(body) && typeof body === 'object' && !body.data) {
    return Object.fromEntries(Object.entries(body).filter(([, v]) => typeof v === 'string'));
  }
  /** @type {Record<string, string>} */
  const out = {};
  for (const p of arr(body)) {
    const id = p.participantId ?? p.id;
    const name = p.participantName ?? p.name;
    if (id !== undefined && name) out[String(id)] = String(name);
  }
  return out;
}

/** Usage from `/v4/account` (free). */
export function parseAccount(/** @type {any} */ body) {
  const limit = Number(body?.request_limit ?? body?.requestLimit ?? body?.limit);
  const used = Number(body?.request_count ?? body?.requestCount ?? body?.used);
  return Number.isFinite(limit) && Number.isFinite(used) ? { limit, used, remaining: limit - used } : null;
}
