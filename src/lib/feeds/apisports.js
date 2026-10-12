/**
 * API-Sports (api-football and friends): request builders and parsers.
 *
 * One key works across hosts; each host has its own 100/day quota. Errors
 * come back with HTTP 200 and an `errors` object, so `apiSportsErrors` must be
 * checked on every response. Parsers are defensive: unknown shapes yield
 * empty results, never exceptions.
 */

import { SPORTS, competitionFor, API_SPORTS_BOOKS, displayBook } from './catalog.js';

/**
 * @typedef {import('./catalog.js').SportKey} SportKey
 * @typedef {{ state: 'scheduled' | 'live' | 'finished' | 'postponed', home?: number, away?: number, regHome?: number, regAway?: number, detail?: string }} GameStatus
 * @typedef {Object} NGame normalised game
 * @property {SportKey} sport
 * @property {string} id provider id
 * @property {string} league display league
 * @property {string | number} leagueId
 * @property {string | number} season
 * @property {string} [country]
 * @property {string} home
 * @property {string} away
 * @property {string | number} homeId
 * @property {string | number} awayId
 * @property {number} kickoff ms since epoch
 * @property {GameStatus} status
 */

/** Build a request URL for a host. */
export function apiSportsUrl(/** @type {SportKey} */ sport, /** @type {string} */ path, /** @type {Record<string, string | number>} */ params = {}) {
  const u = new URL(`https://${SPORTS[sport].host}${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  return u.toString();
}

/** Problems reported in the body (API-Sports answers 200 even on errors). */
export function apiSportsErrors(/** @type {any} */ body) {
  const e = body?.errors;
  if (!e) return [];
  if (Array.isArray(e)) return e.map(String).filter(Boolean);
  if (typeof e === 'object') return Object.entries(e).map(([k, v]) => `${k}: ${v}`);
  return [String(e)];
}

const num = (/** @type {any} */ x) => (x === null || x === undefined || x === '' ? undefined : Number.isFinite(Number(x)) ? Number(x) : undefined);

const FOOTBALL_LIVE = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE']);
const FOOTBALL_DONE = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);
const OFF = new Set(['PST', 'CANC', 'ABD', 'POST', 'INTR']);

/** @returns {GameStatus['state']} */
function stateFromShort(/** @type {string} */ short) {
  const s = String(short ?? '').toUpperCase();
  if (FOOTBALL_DONE.has(s) || ['AOT', 'AP', 'FT'].includes(s)) return 'finished';
  if (OFF.has(s)) return 'postponed';
  if (FOOTBALL_LIVE.has(s) || /^(Q\d|OT|P\d|PT|IN\d+|BT|HT)$/.test(s)) return 'live';
  return 'scheduled';
}

/**
 * Parse a games/fixtures list into normalised games for tracked competitions.
 * @param {SportKey} sport
 * @param {any} body
 * @returns {NGame[]}
 */
export function parseGames(sport, body) {
  const rows = Array.isArray(body?.response) ? body.response : [];
  const def = SPORTS[sport];
  /** @type {NGame[]} */
  const out = [];
  for (const r of rows) {
    try {
      if (def.shape === 'fixtures') {
        const leagueName = r.league?.name ?? '';
        const comp = competitionFor(sport, leagueName, r.league?.country);
        if (!comp) continue;
        const short = r.fixture?.status?.short;
        const state = stateFromShort(short);
        out.push({
          sport,
          id: String(r.fixture.id),
          league: comp.label,
          leagueId: r.league.id,
          season: r.league.season,
          country: r.league.country,
          home: r.teams.home.name,
          away: r.teams.away.name,
          homeId: r.teams.home.id,
          awayId: r.teams.away.id,
          kickoff: (num(r.fixture.timestamp) ?? Date.parse(r.fixture.date) / 1000) * 1000,
          status: {
            state,
            home: num(r.goals?.home),
            away: num(r.goals?.away),
            regHome: num(r.score?.fulltime?.home),
            regAway: num(r.score?.fulltime?.away),
            detail: state === 'live' ? `${r.fixture.status.elapsed ?? ''}'`.trim() : short
          }
        });
      } else if (def.shape === 'nba') {
        // v2.nba: league 'standard' is the NBA proper (skip summer league, etc.).
        if (r.league && r.league !== 'standard') continue;
        const s = num(r.status?.short);
        const state = s === 3 ? 'finished' : s === 2 ? 'live' : /postpon|cancel/i.test(r.status?.long ?? '') ? 'postponed' : 'scheduled';
        out.push({
          sport,
          id: String(r.id),
          league: 'NBA',
          leagueId: 'standard',
          season: r.season,
          country: 'USA',
          home: r.teams.home.name,
          away: r.teams.visitors.name,
          homeId: r.teams.home.id,
          awayId: r.teams.visitors.id,
          kickoff: Date.parse(r.date?.start),
          status: {
            state,
            home: num(r.scores?.home?.points),
            away: num(r.scores?.visitors?.points),
            detail: state === 'live' ? `Q${r.periods?.current ?? ''} ${r.status?.clock ?? ''}`.trim() : r.status?.long
          }
        });
      } else {
        const comp = competitionFor(sport, r.league?.name ?? '', r.country?.name);
        if (!comp) continue;
        const short = r.status?.short;
        const state = stateFromShort(short);
        const total = (/** @type {any} */ side) => (typeof side === 'object' && side !== null ? num(side.total) : num(side));
        /** @type {GameStatus} */
        const status = { state, home: total(r.scores?.home), away: total(r.scores?.away), detail: short };
        if (sport === 'hockey' && r.periods) {
          // Regulation = three periods; "1-0" strings per period.
          let h = 0, a = 0, ok = true;
          for (const p of ['first', 'second', 'third']) {
            const m = /^(\d+)\s*-\s*(\d+)$/.exec(String(r.periods[p] ?? ''));
            if (!m) { ok = false; break; }
            h += Number(m[1]); a += Number(m[2]);
          }
          if (ok) { status.regHome = h; status.regAway = a; }
        }
        out.push({
          sport,
          id: String(r.id),
          league: comp.label,
          leagueId: r.league.id,
          season: r.league.season,
          country: r.country?.name,
          home: r.teams.home.name,
          away: r.teams.away.name,
          homeId: r.teams.home.id,
          awayId: r.teams.away.id,
          kickoff: (num(r.timestamp) ?? Date.parse(r.date) / 1000) * 1000,
          status
        });
      }
    } catch {
      // Skip malformed rows.
    }
  }
  return out.filter((g) => Number.isFinite(g.kickoff) && g.home && g.away);
}

/**
 * Parse a standings response into table rows.
 * @param {SportKey} sport
 * @param {any} body
 * @returns {import('../engine/ratings.js').TableRow[]}
 */
export function parseStandings(sport, body) {
  const resp = Array.isArray(body?.response) ? body.response : [];
  /** @type {any[]} */
  let rows = [];
  if (sport === 'football') {
    for (const r of resp) for (const g of r?.league?.standings ?? []) rows.push(...(Array.isArray(g) ? g : []));
  } else if (sport === 'nba') {
    rows = resp;
  } else {
    for (const g of resp) rows.push(...(Array.isArray(g) ? g : [g]));
  }
  /** @type {Map<string, import('../engine/ratings.js').TableRow>} */
  const byTeam = new Map();
  for (const r of rows) {
    try {
      const id = String(r.team?.id);
      if (!id || byTeam.has(id)) continue; // groups/conferences can repeat teams
      if (sport === 'football') {
        const split = (/** @type {any} */ s) => (s ? { played: num(s.played) ?? 0, for: num(s.goals?.for) ?? 0, against: num(s.goals?.against) ?? 0 } : undefined);
        byTeam.set(id, {
          teamId: id,
          team: r.team.name,
          played: num(r.all?.played) ?? 0,
          for: num(r.all?.goals?.for) ?? 0,
          against: num(r.all?.goals?.against) ?? 0,
          wins: num(r.all?.win),
          losses: num(r.all?.lose),
          home: split(r.home),
          away: split(r.away)
        });
      } else if (sport === 'nba') {
        const w = num(r.win?.total) ?? 0;
        const l = num(r.loss?.total) ?? 0;
        byTeam.set(id, { teamId: id, team: r.team.name, played: w + l, for: 0, against: 0, wins: w, losses: l });
      } else {
        const played = num(r.games?.played) ?? 0;
        const f = num(r.points?.for) ?? num(r.goals?.for) ?? 0;
        const a = num(r.points?.against) ?? num(r.goals?.against) ?? 0;
        byTeam.set(id, {
          teamId: id,
          team: r.team.name,
          played,
          for: f,
          against: a,
          wins: num(r.games?.win?.total) ?? num(r.games?.wins?.total),
          losses: num(r.games?.lose?.total) ?? num(r.games?.loses?.total)
        });
      }
    } catch {
      // Skip malformed rows.
    }
  }
  return [...byTeam.values()];
}

/** Pick the most balanced line from "Over X"/"Under X" values. */
function mainLine(/** @type {Array<{ value: string, odd: string }>} */ values, /** @type {RegExp} */ overRe, /** @type {RegExp} */ underRe) {
  /** @type {Map<number, { over?: number, under?: number }>} */
  const lines = new Map();
  for (const v of values ?? []) {
    let m;
    if ((m = overRe.exec(v.value))) {
      const L = Number(m[1]);
      lines.set(L, { ...lines.get(L), over: Number(v.odd) });
    } else if ((m = underRe.exec(v.value))) {
      const L = Number(m[1]);
      lines.set(L, { ...lines.get(L), under: Number(v.odd) });
    }
  }
  let best;
  for (const [L, p] of lines) {
    if (!((p.over ?? 0) > 1 && (p.under ?? 0) > 1)) continue;
    const gap = Math.abs(/** @type {number} */ (p.over) - /** @type {number} */ (p.under));
    if (!best || gap < best.gap) best = { line: L, over: /** @type {number} */ (p.over), under: /** @type {number} */ (p.under), gap };
  }
  return best;
}

/**
 * Parse an odds response into { providerGameId: { book: odds } } in the
 * engine's input shape for the sport's family.
 * @param {SportKey} sport
 * @param {any} body
 * @returns {Record<string, Record<string, Record<string, number>>>}
 */
export function parseOdds(sport, body) {
  const fam = SPORTS[sport].family;
  /** @type {Record<string, Record<string, Record<string, number>>>} */
  const out = {};
  for (const r of Array.isArray(body?.response) ? body.response : []) {
    const gameId = String(r.fixture?.id ?? r.game?.id ?? '');
    if (!gameId) continue;
    for (const b of r.bookmakers ?? []) {
      if (!API_SPORTS_BOOKS.some((re) => re.test(b.name ?? ''))) continue;
      const bets = Object.fromEntries((b.bets ?? []).map((/** @type {any} */ x) => [String(x.name).toLowerCase(), x.values ?? []]));
      const val = (/** @type {string} */ bet, /** @type {string} */ v) => {
        const hit = (bets[bet] ?? []).find((/** @type {any} */ x) => String(x.value).toLowerCase() === v);
        return hit ? Number(hit.odd) : undefined;
      };
      /** @type {Record<string, number>} */
      const o = {};
      if (fam === 'football') {
        const h = val('match winner', 'home'), d = val('match winner', 'draw'), a = val('match winner', 'away');
        if (h && d && a) Object.assign(o, { home: h, draw: d, away: a });
        const ou = (bets['goals over/under'] ?? []).filter((/** @type {any} */ x) => /^(over|under) 2\.5$/i.test(x.value));
        const over = ou.find((/** @type {any} */ x) => /^over/i.test(x.value));
        const under = ou.find((/** @type {any} */ x) => /^under/i.test(x.value));
        if (over && under) Object.assign(o, { over25: Number(over.odd), under25: Number(under.odd) });
        const y = val('both teams score', 'yes'), n = val('both teams score', 'no');
        if (y && n) Object.assign(o, { bttsYes: y, bttsNo: n });
        if (!(o.home > 1)) continue;
      } else {
        const h = val('home/away', 'home'), a = val('home/away', 'away');
        if (!(h && a)) continue;
        Object.assign(o, { homeMoneyline: h, awayMoneyline: a });
        const tot = mainLine(bets['over/under'], /^over ([\d.]+)$/i, /^under ([\d.]+)$/i);
        if (tot) Object.assign(o, { totalLine: tot.line, overOdds: tot.over, underOdds: tot.under });
        // Asian handicap values look like "Home -1.5" / "Away +1.5".
        /** @type {Map<number, { home?: number, away?: number }>} */
        const hc = new Map();
        for (const x of bets['asian handicap'] ?? []) {
          const m = /^(home|away)\s*([+-]?[\d.]+)$/i.exec(String(x.value).trim());
          if (!m) continue;
          const homeLine = m[1].toLowerCase() === 'home' ? Number(m[2]) : -Number(m[2]);
          const cur = hc.get(homeLine) ?? {};
          if (m[1].toLowerCase() === 'home') cur.home = Number(x.odd);
          else cur.away = Number(x.odd);
          hc.set(homeLine, cur);
        }
        let best;
        for (const [L, p] of hc) {
          if (!((p.home ?? 0) > 1 && (p.away ?? 0) > 1)) continue;
          const gap = Math.abs(/** @type {number} */ (p.home) - /** @type {number} */ (p.away));
          if (!best || gap < best.gap) best = { L, ...p, gap };
        }
        if (best) Object.assign(o, { spreadLine: best.L, homeSpreadOdds: best.home, awaySpreadOdds: best.away });
      }
      (out[gameId] ??= {})[displayBook(b.name)] = o;
    }
  }
  return out;
}

/** Pagination info from an API-Sports body. */
export function paging(/** @type {any} */ body) {
  return { current: num(body?.paging?.current) ?? 1, total: num(body?.paging?.total) ?? 1 };
}
