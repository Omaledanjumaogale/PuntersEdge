/**
 * A simulated sports world answering like API-Sports, The Odds API and
 * OddsPapi, in their documented response shapes. Used to test the ingest
 * runner end to end (and to run a whole month of ticks against the quotas).
 */

import { hashString, mulberry32 } from '../../src/lib/engine/math.js';

const TEAMS = {
  football: { league: { id: 39, name: 'Premier League', country: 'England' }, teams: ['Arsenal', 'Chelsea', 'Liverpool', 'Manchester United', 'Manchester City', 'Tottenham Hotspur', 'Newcastle', 'Aston Villa'] },
  basketball: { league: { id: 120, name: 'Euroleague', country: 'Europe' }, teams: ['Real Madrid', 'Barcelona', 'Olympiacos', 'Panathinaikos', 'Fenerbahce', 'Monaco'] },
  nba: { league: { id: 'standard', name: 'NBA', country: 'USA' }, teams: ['Boston Celtics', 'Los Angeles Lakers', 'Denver Nuggets', 'Golden State Warriors', 'Miami Heat', 'New York Knicks'] },
  hockey: { league: { id: 57, name: 'NHL', country: 'USA' }, teams: ['Edmonton Oilers', 'Calgary Flames', 'Toronto Maple Leafs', 'Boston Bruins', 'New York Rangers', 'Florida Panthers'] },
  baseball: { league: { id: 1, name: 'MLB', country: 'USA' }, teams: ['New York Yankees', 'Boston Red Sox', 'Los Angeles Dodgers', 'Houston Astros', 'Atlanta Braves', 'Chicago Cubs'] }
};
const HOSTS = { 'v3.football.api-sports.io': 'football', 'v1.basketball.api-sports.io': 'basketball', 'v2.nba.api-sports.io': 'nba', 'v1.hockey.api-sports.io': 'hockey', 'v1.baseball.api-sports.io': 'baseball' };
const TOA = { soccer_epl: 'football', basketball_euroleague: 'basketball', basketball_nba: 'nba', icehockey_nhl: 'hockey', baseball_mlb: 'baseball' };
/** How other providers spell some teams. */
const ALIAS = { 'Manchester United': 'Man Utd', 'Tottenham Hotspur': 'Spurs', 'Los Angeles Lakers': 'LA Lakers', 'New York Yankees': 'NY Yankees' };

/** Games on a date for a sport: deterministic pairings and kick-off hours. */
export function gamesOn(sport, date) {
  const { teams } = TEAMS[sport];
  const rand = mulberry32(hashString(`${sport}:${date}`));
  const order = [...teams].sort(() => rand() - 0.5);
  const out = [];
  for (let i = 0; i + 1 < order.length; i += 2) {
    const hour = 12 + Math.floor(rand() * 9);
    const id = Math.abs(hashString(`${sport}:${date}:${i}`)) % 1_000_000;
    out.push({ id, home: order[i], away: order[i + 1], homeId: teams.indexOf(order[i]) + 1, awayId: teams.indexOf(order[i + 1]) + 1, kickoff: Date.parse(`${date}T${String(hour).padStart(2, '0')}:00:00Z`), hs: Math.floor(rand() * 4), as: Math.floor(rand() * 4) });
  }
  return out;
}

const iso = (t) => new Date(t).toISOString();
const dates = (now) => [-1, 0, 1, 2].map((d) => new Date(now + d * 86400_000).toISOString().slice(0, 10));

/**
 * Build a fetcher bound to a simulated clock.
 * @param {() => number} clock
 */
export function mockWorld(clock) {
  const calls = { 'api-sports': {}, 'the-odds-api': 0, oddspapi: 0, free: 0, byDay: {} };
  const count = (provider, sport, cost = 1) => {
    const day = new Date(clock()).toISOString().slice(0, 10);
    if (provider === 'api-sports') {
      const k = `${sport}:${day}`;
      calls['api-sports'][k] = (calls['api-sports'][k] ?? 0) + cost;
    } else calls[provider] += cost;
    const dk = `${provider}:${day}`;
    calls.byDay[dk] = (calls.byDay[dk] ?? 0) + cost;
  };
  const headers = (h) => ({ get: (n) => (n in h ? String(h[n]) : null) });

  /** @type {import('../../src/lib/feeds/runner.js').Fetcher} */
  const fetcher = async (provider, url) => {
    const u = new URL(url);
    const now = clock();
    if (provider === 'api-sports') {
      const sport = HOSTS[u.host];
      count(provider, sport);
      const remaining = 100 - (calls['api-sports'][`${sport}:${new Date(now).toISOString().slice(0, 10)}`] ?? 0);
      const L = TEAMS[sport].league;
      if (u.pathname === '/fixtures' || u.pathname === '/games') {
        const date = u.searchParams.get('date');
        const games = gamesOn(sport, date);
        const st = (g) => (now > g.kickoff + 3 * 3600_000 ? 'FT' : now > g.kickoff ? 'LIVE' : 'NS');
        let response;
        if (sport === 'football') {
          response = games.map((g) => ({
            fixture: { id: g.id, date: iso(g.kickoff), timestamp: g.kickoff / 1000, status: { short: st(g) === 'LIVE' ? '2H' : st(g), elapsed: 60 } },
            league: { id: L.id, name: L.name, country: L.country, season: 2026 },
            teams: { home: { id: g.homeId, name: g.home }, away: { id: g.awayId, name: g.away } },
            goals: st(g) === 'NS' ? { home: null, away: null } : { home: g.hs, away: g.as },
            score: { fulltime: st(g) === 'FT' ? { home: g.hs, away: g.as } : { home: null, away: null } }
          }));
        } else if (sport === 'nba') {
          response = games.map((g) => ({
            id: g.id, league: 'standard', season: 2026, date: { start: iso(g.kickoff) },
            status: { short: st(g) === 'FT' ? 3 : st(g) === 'LIVE' ? 2 : 1, long: 'x' },
            teams: { home: { id: g.homeId, name: g.home }, visitors: { id: g.awayId, name: g.away } },
            scores: { home: { points: 100 + g.hs * 5 }, visitors: { points: 98 + g.as * 5 } }
          }));
        } else {
          response = games.map((g) => {
            const h = sport === 'basketball' ? 70 + g.hs * 6 : g.hs + (sport === 'baseball' ? 2 : 0);
            const a = sport === 'basketball' ? 68 + g.as * 6 : g.as + (sport === 'baseball' ? 2 : 0);
            return {
              id: g.id, date: iso(g.kickoff), timestamp: g.kickoff / 1000,
              status: { short: st(g) === 'LIVE' ? (sport === 'hockey' ? 'P2' : sport === 'baseball' ? 'IN5' : 'Q3') : st(g) },
              league: { id: L.id, name: L.name, season: sport === 'basketball' ? '2026-2027' : 2026 },
              country: { name: L.country },
              teams: { home: { id: g.homeId, name: g.home }, away: { id: g.awayId, name: g.away } },
              scores: sport === 'hockey' ? { home: h, away: a } : { home: { total: h }, away: { total: a } },
              periods: sport === 'hockey' ? { first: `${h}-${a}`, second: '0-0', third: '0-0' } : undefined
            };
          });
        }
        return { status: 200, body: { errors: [], results: response.length, response }, headers: headers({ 'x-ratelimit-requests-remaining': remaining }) };
      }
      if (u.pathname === '/fixtures/events' || u.pathname === '/fixtures/statistics') return {status:200,body:{response:[]},headers:headers({})}; // Unsupported fixture details remain missing, never synthetic.
      if (u.pathname === '/standings') {
        const rows = TEAMS[sport].teams.map((t, i) => ({ id: i + 1, t }));
        let response;
        if (sport === 'football') {
          response = [{ league: { standings: [rows.map((r) => ({ team: { id: r.id, name: r.t }, all: { played: 8, win: 4, lose: 2, goals: { for: 10 + r.id, against: 12 - r.id / 2 } }, home: { played: 4, goals: { for: 6 + r.id / 2, against: 5 } }, away: { played: 4, goals: { for: 4 + r.id / 2, against: 7 - r.id / 2 } } }))] } }];
        } else if (sport === 'nba') {
          response = rows.map((r) => ({ team: { id: r.id, name: r.t }, win: { total: 3 + r.id }, loss: { total: 9 - r.id } }));
        } else {
          const ppg = sport === 'basketball' ? 80 : sport === 'hockey' ? 3 : 4.5;
          response = [rows.map((r) => ({ team: { id: r.id, name: r.t }, games: { played: 10, win: { total: 5 }, lose: { total: 5 } }, [sport === 'hockey' ? 'goals' : 'points']: { for: 10 * ppg + r.id, against: 10 * ppg - r.id } }))];
        }
        return { status: 200, body: { errors: [], response }, headers: headers({ 'x-ratelimit-requests-remaining': remaining }) };
      }
      if (u.pathname === '/odds') {
        const ds = u.searchParams.get('date') ? [u.searchParams.get('date')] : dates(now);
        const response = ds.flatMap((d) => gamesOn(sport, d)).filter((g) => g.kickoff > now).map((g) => ({
          fixture: { id: g.id }, game: { id: g.id },
          bookmakers: [{
            id: 11, name: '1xBet',
            bets: sport === 'football'
              ? [{ name: 'Match Winner', values: [{ value: 'Home', odd: '2.10' }, { value: 'Draw', odd: '3.40' }, { value: 'Away', odd: '3.60' }] }, { name: 'Goals Over/Under', values: [{ value: 'Over 2.5', odd: '1.90' }, { value: 'Under 2.5', odd: '1.95' }] }, { name: 'Both Teams Score', values: [{ value: 'Yes', odd: '1.80' }, { value: 'No', odd: '2.00' }] }]
              : [{ name: 'Home/Away', values: [{ value: 'Home', odd: '1.80' }, { value: 'Away', odd: '2.05' }] }, { name: 'Over/Under', values: [{ value: 'Over 5.5', odd: '1.90' }, { value: 'Under 5.5', odd: '1.90' }, { value: 'Over 6.5', odd: '2.4' }, { value: 'Under 6.5', odd: '1.55' }] }, { name: 'Asian Handicap', values: [{ value: 'Home -1.5', odd: '2.6' }, { value: 'Away +1.5', odd: '1.5' }] }]
          }, { id: 99, name: 'Some Unknown Book', bets: [] }]
        }));
        return { status: 200, body: { errors: [], paging: { current: 1, total: 1 }, response }, headers: headers({ 'x-ratelimit-requests-remaining': remaining }) };
      }
      return { status: 200, body: { errors: { endpoint: 'unknown' }, response: [] }, headers: headers({}) };
    }

    if (provider === 'the-odds-api') {
      if (u.pathname === '/v4/sports') { calls.free++; return { status:200, body: Object.keys(TOA).map(key => ({key,active:true,title:key})), headers:headers({ 'x-requests-last': 0 }) }; }
      const m = /\/v4\/sports\/([^/]+)\/(events|odds)/.exec(u.pathname);
      if (!m) return { status: 404, body: {}, headers: headers({}) };
      const sport = TOA[m[1]];
      if (!sport) return { status: 200, body: [], headers: headers({ 'x-requests-last': 0 }) };
      const games = dates(now).flatMap((d) => gamesOn(sport, d)).filter((g) => g.kickoff > now - 3600_000 && g.kickoff < now + 3 * 86400_000);
      const isOdds = m[2] === 'odds';
      const cost = isOdds ? u.searchParams.get('markets').split(',').length : 0;
      if (isOdds) count(provider, sport, cost);
      else calls.free++;
      const name = (t) => ALIAS[t] ?? t;
      const body = games.map((g) => ({
        id: `e${g.id}`, sport_key: m[1], commence_time: g.kickoff / 1000, home_team: name(g.home), away_team: name(g.away),
        bookmakers: isOdds ? [{
          key: 'pinnacle', title: 'Pinnacle',
          markets: sport === 'football'
            ? [{ key: 'h2h', outcomes: [{ name: name(g.home), price: 2.2 }, { name: 'Draw', price: 3.5 }, { name: name(g.away), price: 3.4 }] }, { key: 'totals', outcomes: [{ name: 'Over', price: 1.95, point: 2.5 }, { name: 'Under', price: 1.93, point: 2.5 }] }]
            : [{ key: 'h2h', outcomes: [{ name: name(g.home), price: 1.85 }, { name: name(g.away), price: 2.02 }] }, { key: 'spreads', outcomes: [{ name: name(g.home), price: 1.95, point: -1.5 }, { name: name(g.away), price: 1.9, point: 1.5 }] }, { key: 'totals', outcomes: [{ name: 'Over', price: 1.92, point: 8.5 }, { name: 'Under', price: 1.92, point: 8.5 }] }]
        }] : undefined
      }));
      return { status: 200, body, headers: headers({ 'x-requests-remaining': 500 - calls['the-odds-api'], 'x-requests-used': calls['the-odds-api'], 'x-requests-last': cost }) };
    }

    // OddsPapi
    const p = u.pathname.replace('/v4', '');
    if (p === '/account') {
      calls.free++;
      return { status: 200, body: { request_limit: 250, request_count: calls.oddspapi }, headers: headers({}) };
    }
    count('oddspapi', 'any');
    if (p === '/sports') return { status: 200, body: [{ sportId: 10, sportName: 'Soccer' }, { sportId: 11, sportName: 'Basketball' }, { sportId: 15, sportName: 'Ice Hockey' }, { sportId: 13, sportName: 'Baseball' }], headers: headers({}) };
    if (p === '/bookmakers') return { status: 200, body: [{ bookmakerName: 'SportyBet', slug: 'sportybet' }, { bookmakerName: '1xBet', slug: '1xbet' }, { bookmakerName: '22Bet', slug: '22bet' }, { bookmakerName: 'Pinnacle', slug: 'pinnacle' }], headers: headers({}) };
    if (p === '/markets') {
      return {
        status: 200,
        body: [
          { marketId: 101, marketName: 'Full Time Result', sportId: 10, handicap: 0, period: 'fulltime', marketType: '1x2', outcomes: [{ outcomeId: 101, outcomeName: '1' }, { outcomeId: 102, outcomeName: 'X' }, { outcomeId: 103, outcomeName: '2' }] },
          { marketId: 104, marketName: 'Both Teams To Score', sportId: 10, handicap: 0, period: 'fulltime', marketType: 'totals', outcomes: [{ outcomeId: 104, outcomeName: 'Yes' }, { outcomeId: 105, outcomeName: 'No' }] },
          { marketId: 1010, marketName: 'Over Under Full Time', sportId: 10, handicap: 2.5, period: 'fulltime', marketType: 'totals', outcomes: [{ outcomeId: 1010, outcomeName: 'Over' }, { outcomeId: 1011, outcomeName: 'Under' }] },
          { marketId: 2001, marketName: 'Winner (incl. OT)', sportId: 15, handicap: 0, period: 'fulltime', marketType: 'moneyline', outcomes: [{ outcomeId: 2001, outcomeName: '1' }, { outcomeId: 2002, outcomeName: '2' }] },
          { marketId: 2003, marketName: 'Total (incl. OT)', sportId: 15, handicap: 5.5, period: 'fulltime', marketType: 'totals', outcomes: [{ outcomeId: 2003, outcomeName: 'Over' }, { outcomeId: 2004, outcomeName: 'Under' }] },
          { marketId: 2005, marketName: '1st Period Total', sportId: 15, handicap: 1.5, period: 'p1', marketType: 'totals', outcomes: [{ outcomeId: 2005, outcomeName: 'Over' }, { outcomeId: 2006, outcomeName: 'Under' }] }
        ],
        headers: headers({})
      };
    }
    if (p === '/tournaments') {
      const sid = Number(u.searchParams.get('sportId'));
      const list = sid === 10 ? [{ tournamentId: 17, tournamentName: 'Premier League', categoryName: 'England', upcomingFixtures: 10 }, { tournamentId: 18, tournamentName: 'Premier League', categoryName: 'Wales', upcomingFixtures: 4 }]
        : sid === 15 ? [{ tournamentId: 234, tournamentName: 'NHL', categoryName: 'USA', upcomingFixtures: 12 }]
        : sid === 11 ? [{ tournamentId: 132, tournamentName: 'NBA', categoryName: 'USA', upcomingFixtures: 12 }] : [];
      return { status: 200, body: list, headers: headers({}) };
    }
    if (p === '/participants') {
      const sid = Number(u.searchParams.get('sportId'));
      const sport = sid === 10 ? 'football' : sid === 15 ? 'hockey' : sid === 11 ? 'nba' : 'baseball';
      return { status: 200, body: Object.fromEntries(TEAMS[sport].teams.map((t, i) => [1000 + i, t])), headers: headers({}) };
    }
    if (p === '/odds-by-tournaments') {
      const ids = u.searchParams.get('tournamentIds').split(',').map(Number);
      const out = [];
      for (const [tid, sport, sid] of [[17, 'football', 10], [234, 'hockey', 15]]) {
        if (!ids.includes(tid)) continue;
        for (const g of dates(now).flatMap((d) => gamesOn(sport, d)).filter((x) => x.kickoff > now)) {
          out.push({
            fixtureId: `id${g.id}`, participant1Id: 1000 + g.homeId - 1, participant2Id: 1000 + g.awayId - 1, sportId: sid, tournamentId: tid, statusId: 0, startTime: iso(g.kickoff),
            bookmakerOdds: {
              sportybet: { bookmakerIsActive: true, markets: sport === 'football'
                ? { 101: { outcomes: { 101: { players: { 0: { active: true, price: 2.3 } } }, 102: { players: { 0: { active: true, price: 3.3 } } }, 103: { players: { 0: { active: true, price: 3.2 } } } } }, 1010: { outcomes: { 1010: { players: { 0: { price: 1.85 } } }, 1011: { players: { 0: { price: 1.98 } } } } } }
                : { 2001: { outcomes: { 2001: { players: { 0: { price: 1.9 } } }, 2002: { players: { 0: { price: 1.95 } } } } }, 2003: { outcomes: { 2003: { players: { 0: { price: 1.88 } } }, 2004: { players: { 0: { price: 1.92 } } } } } } }
            }
          });
        }
      }
      return { status: 200, body: out, headers: headers({}) };
    }
    return { status: 404, body: { message: 'not found' }, headers: headers({}) };
  };
  return { fetcher, calls };
}
