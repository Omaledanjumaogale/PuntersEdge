import { test } from 'node:test';
import assert from 'node:assert/strict';
import { current, allowance, spend, planJobs, LIMITS } from '../src/lib/feeds/budget.js';
import { teamSimilarity, bestMatch, teamKey } from '../src/lib/feeds/matching.js';
import { parseGames, parseStandings, parseOdds, apiSportsErrors } from '../src/lib/feeds/apisports.js';
import { parseOddsApiEvents, oddsApiOddsUrl } from '../src/lib/feeds/theoddsapi.js';
import { indexMarkets, parseOddspapiOdds, resolveBookmakers, parseParticipants } from '../src/lib/feeds/oddspapi.js';
import { emptyStore, reviveStore } from '../src/lib/feeds/store.js';
import { runTick } from '../src/lib/feeds/runner.js';
import { buildFeed, updateRecord, predict, inputFor } from '../src/lib/feeds/build.js';
import { competitionFor, SPORT_KEYS } from '../src/lib/feeds/catalog.js';
import { mockWorld } from './fixtures/mock-providers.js';

const T0 = Date.parse('2026-10-12T06:00:00Z');

// ── budget ──────────────────────────────────────────────────────────────
test('budget: daily quota resets at midnight UTC and holds back a reserve', () => {
  let e = current('api-sports:football', undefined, T0);
  assert.equal(allowance(e, T0).today, 90);
  e = spend(e, 85, undefined, T0);
  assert.equal(allowance(e, T0).today, 5);
  const tomorrow = current('api-sports:football', e, T0 + 24 * 3600_000);
  assert.equal(tomorrow.used, 0);
  assert.equal(allowance(tomorrow, T0 + 24 * 3600_000).today, 90);
});

test('budget: monthly quota is shared equally across the remaining days', () => {
  // 12 October: 20 days left including today; 500 − 12 reserve − 188 used = 300 → 15 a day.
  let e = { ...current('the-odds-api', undefined, T0), used: 188 };
  assert.equal(allowance(e, T0).today, 15);
  e = spend(e, 10, undefined, T0);
  assert.equal(allowance(e, T0).today, 5);
  // Next day: 290 left over 19 days → 15.
  const next = current('the-odds-api', e, T0 + 24 * 3600_000);
  assert.equal(next.dayUsed, 0);
  assert.equal(allowance(next, T0 + 24 * 3600_000).today, 15);
});

test('budget: provider headers win when they report more usage', () => {
  let e = current('the-odds-api', undefined, T0);
  e = spend(e, 2, { remaining: 300, used: 200 }, T0);
  assert.equal(e.used, 200);
  assert.ok(allowance(e, T0).window <= 300 - LIMITS['the-odds-api'].reserve);
  let p = current('oddspapi', undefined, T0);
  p = spend(p, 0, { remaining: 0 }, T0);
  assert.equal(allowance(p, T0).today, 0);
});

test('budget: planner runs due jobs by priority and protects core refreshes', () => {
  const ledgers = { 'api-sports:football': { ...current('api-sports:football', undefined, T0), used: 80, dayUsed: 80 } };
  const jobs = [
    { id: 'core', ledger: 'api-sports:football', cost: 1, priority: 1, every: 0 },
    { id: 'extra1', ledger: 'api-sports:football', cost: 1, priority: 7, every: 0 },
    { id: 'extra2', ledger: 'api-sports:football', cost: 1, priority: 7, every: 0 },
    { id: 'notdue', ledger: 'api-sports:football', cost: 1, priority: 0, every: 3600_000 }
  ];
  const { run, skipped } = planJobs(jobs, ledgers, { notdue: T0 - 60_000 }, T0, { protect: { 'api-sports:football': 8 } });
  assert.deepEqual(run.map((j) => j.id), ['core', 'extra1']);
  assert.ok(skipped.some((s) => s.id === 'extra2'));
});

// ── matching ────────────────────────────────────────────────────────────
test('matching: same team, different spellings', () => {
  assert.ok(teamSimilarity('Manchester United', 'Man Utd') >= 0.85);
  assert.ok(teamSimilarity('Wolverhampton Wanderers', 'Wolves') >= 0.8);
  assert.ok(teamSimilarity('Paris Saint-Germain', 'PSG') >= 0.95);
  assert.ok(teamSimilarity('Atlético Madrid', 'Atl. Madrid') >= 0.95);
  assert.ok(teamSimilarity('Los Angeles Lakers', 'LA Lakers') >= 0.95);
  assert.equal(teamKey('Arsenal FC'), teamKey('arsenal'));
});

test('matching: different teams stay apart', () => {
  assert.ok(teamSimilarity('Manchester United', 'Manchester City') < 0.6);
  assert.ok(teamSimilarity('Real Madrid', 'Real Sociedad') < 0.6);
  assert.ok(teamSimilarity('Los Angeles Lakers', 'Los Angeles Clippers') < 0.6);
  const t = Date.parse('2026-10-12T19:00:00Z');
  const cands = [
    { home: 'Man City', away: 'Chelsea', kickoff: t },
    { home: 'Man Utd', away: 'Chelsea FC', kickoff: t + 3600_000 },
    { home: 'Manchester United', away: 'Chelsea', kickoff: t + 30 * 3600_000 }
  ];
  const m = bestMatch({ home: 'Manchester United', away: 'Chelsea', kickoff: t }, cands);
  assert.equal(m?.item, cands[1]);
});

// ── provider parsers ────────────────────────────────────────────────────
test('api-sports: football fixtures preserve major and minor league coverage', () => {
  const body = {
    errors: [],
    response: [
      { fixture: { id: 1, timestamp: 1760295600, status: { short: 'FT' } }, league: { id: 39, name: 'Premier League', country: 'England', season: 2026 }, teams: { home: { id: 42, name: 'Arsenal' }, away: { id: 49, name: 'Chelsea' } }, goals: { home: 2, away: 2 }, score: { fulltime: { home: 1, away: 1 } } },
      { fixture: { id: 2, timestamp: 1760295600, status: { short: '2H', elapsed: 71 } }, league: { id: 999, name: 'Premier League', country: 'Wales', season: 2026 }, teams: { home: { id: 1, name: 'A' }, away: { id: 2, name: 'B' } }, goals: {}, score: {} },
      { fixture: { id: 3, timestamp: 1760295600, status: { short: 'NS' } }, league: { id: 399, name: 'NPFL', country: 'Nigeria', season: 2026 }, teams: { home: { id: 5, name: 'Enyimba' }, away: { id: 6, name: 'Rangers' } }, goals: {}, score: {} }
    ]
  };
  const g = parseGames('football', body);
  assert.equal(g.length, 3);
  assert.equal(g[0].status.state, 'finished');
  assert.equal(g[0].status.regHome, 1);
  assert.equal(g[1].league, 'Premier League');
  assert.equal(g[1].country, 'Wales');
  assert.equal(g[2].league, 'NPFL');
  assert.deepEqual(apiSportsErrors({ errors: { plan: 'Free plans do not have access to this season' } }), ['plan: Free plans do not have access to this season']);
  assert.ok(competitionFor('football', 'UEFA Champions League', 'World'));
});

test('api-sports: NBA v2, hockey regulation score and tables', () => {
  const nba = parseGames('nba', { response: [{ id: 9, league: 'standard', season: 2026, date: { start: '2026-10-21T23:30:00.000Z' }, status: { short: 3, long: 'Finished' }, teams: { home: { id: 1, name: 'Boston Celtics' }, visitors: { id: 2, name: 'New York Knicks' } }, scores: { home: { points: 112 }, visitors: { points: 104 } } }, { id: 10, league: 'africa', date: { start: '2026-10-21T23:30:00.000Z' }, teams: { home: {}, visitors: {} } }] });
  assert.equal(nba.length, 1);
  assert.deepEqual([nba[0].status.state, nba[0].status.home, nba[0].status.away], ['finished', 112, 104]);
  const hockey = parseGames('hockey', { response: [{ id: 5, timestamp: 1760295600, status: { short: 'AOT' }, league: { id: 57, name: 'NHL', season: 2026 }, country: { name: 'USA' }, teams: { home: { id: 1, name: 'Oilers' }, away: { id: 2, name: 'Flames' } }, scores: { home: 4, away: 3 }, periods: { first: '1-1', second: '1-2', third: '1-0', overtime: '1-0' } }] });
  assert.deepEqual([hockey[0].status.state, hockey[0].status.regHome, hockey[0].status.regAway], ['finished', 3, 3]);
  const table = parseStandings('baseball', { response: [[{ team: { id: 1, name: 'Yankees' }, games: { played: 162, win: { total: 94 }, lose: { total: 68 } }, points: { for: 815, against: 669 } }]] });
  assert.deepEqual([table[0].played, table[0].for, table[0].wins], [162, 815, 94]);
});

test('api-sports: odds keep known books and pick the balanced main lines', () => {
  const o = parseOdds('hockey', { response: [{ game: { id: 5 }, bookmakers: [{ name: '1xBet', bets: [{ name: 'Home/Away', values: [{ value: 'Home', odd: '1.8' }, { value: 'Away', odd: '2.05' }] }, { name: 'Over/Under', values: [{ value: 'Over 5.5', odd: '1.9' }, { value: 'Under 5.5', odd: '1.9' }, { value: 'Over 6.5', odd: '2.5' }, { value: 'Under 6.5', odd: '1.5' }] }, { name: 'Asian Handicap', values: [{ value: 'Home -1.5', odd: '2.6' }, { value: 'Away +1.5', odd: '1.5' }] }] }, { name: 'Nobody', bets: [] }] }] });
  assert.deepEqual(Object.keys(o['5']), ['1xBet']);
  assert.deepEqual(o['5']['1xBet'], { homeMoneyline: 1.8, awayMoneyline: 2.05, totalLine: 5.5, overOdds: 1.9, underOdds: 1.9, spreadLine: -1.5, homeSpreadOdds: 2.6, awaySpreadOdds: 1.5 });
});

test('the odds api: events become engine-shaped prices; cost is markets × 1 region', () => {
  const ev = parseOddsApiEvents([{ id: 'abc', sport_key: 'basketball_nba', commence_time: 1760295600, home_team: 'Boston Celtics', away_team: 'New York Knicks', bookmakers: [{ key: 'onexbet', markets: [{ key: 'h2h', outcomes: [{ name: 'Boston Celtics', price: 1.6 }, { name: 'New York Knicks', price: 2.4 }] }, { key: 'spreads', outcomes: [{ name: 'Boston Celtics', price: 1.91, point: -5.5 }, { name: 'New York Knicks', price: 1.91, point: 5.5 }] }, { key: 'totals', outcomes: [{ name: 'Over', price: 1.9, point: 221.5 }, { name: 'Under', price: 1.9, point: 221.5 }] }] }] }]);
  assert.equal(ev[0].sport, 'nba');
  assert.deepEqual(ev[0].odds['1xBet'], { homeMoneyline: 1.6, awayMoneyline: 2.4, spreadLine: -5.5, homeSpreadOdds: 1.91, awaySpreadOdds: 1.91, totalLine: 221.5, overOdds: 1.9, underOdds: 1.9 });
  assert.equal(oddsApiOddsUrl('soccer_epl').cost, 2);
  assert.equal(oddsApiOddsUrl('icehockey_nhl').cost, 3);
});

test('oddspapi: market catalogue and odds by tournament', () => {
  const markets = indexMarkets([
    { marketId: 101, marketName: 'Full Time Result', sportId: 10, handicap: 0, period: 'fulltime', marketType: '1x2', outcomes: [{ outcomeId: 101, outcomeName: '1' }, { outcomeId: 102, outcomeName: 'X' }, { outcomeId: 103, outcomeName: '2' }] },
    { marketId: 104, marketName: 'Both Teams To Score', sportId: 10, handicap: 0, period: 'fulltime', marketType: 'totals', outcomes: [{ outcomeId: 104, outcomeName: 'Yes' }, { outcomeId: 105, outcomeName: 'No' }] },
    { marketId: 106, marketName: 'Over Under Full Time', sportId: 10, handicap: 0.5, period: 'fulltime', marketType: 'totals', outcomes: [{ outcomeId: 106, outcomeName: 'Over' }, { outcomeId: 107, outcomeName: 'Under' }] },
    { marketId: 108, marketName: 'Over Under Full Time', sportId: 10, handicap: 2.5, period: 'fulltime', marketType: 'totals', outcomes: [{ outcomeId: 108, outcomeName: 'Over' }, { outcomeId: 109, outcomeName: 'Under' }] },
    { marketId: 110, marketName: '1st Half Result', sportId: 10, handicap: 0, period: '1sthalf', marketType: '1x2', outcomes: [{ outcomeId: 110, outcomeName: '1' }, { outcomeId: 111, outcomeName: 'X' }, { outcomeId: 112, outcomeName: '2' }] }
  ]);
  assert.deepEqual(Object.keys(markets).sort(), ['101', '104', '106', '108']);
  assert.equal(markets['104'].kind, 'btts');
  const price = (p) => ({ players: { 0: { active: true, price: p } } });
  const fx = parseOddspapiOdds([{ fixtureId: 'id1', participant1Id: 3, participant2Id: 35, sportId: 10, tournamentId: 17, statusId: 0, startTime: '2026-10-18T14:00:00.000Z', bookmakerOdds: { sportybet: { bookmakerIsActive: true, markets: { 101: { outcomes: { 101: price(2.4), 102: price(3.3), 103: price(3.0) } }, 104: { outcomes: { 104: price(1.7), 105: price(2.1) } }, 108: { outcomes: { 108: price(1.9), 109: price(1.9) } }, 106: { outcomes: { 106: price(1.05), 107: price(9) } } } } } }], markets, { sportybet: 'SportyBet' }, (sid) => (sid === 10 ? 'football' : undefined));
  assert.deepEqual(fx[0].odds.SportyBet, { home: 2.4, draw: 3.3, away: 3.0, over25: 1.9, under25: 1.9, bttsYes: 1.7, bttsNo: 2.1 });
  assert.deepEqual(resolveBookmakers([{ bookmakerName: 'SportyBet', slug: 'sportybet' }, { bookmakerName: '1xBet', slug: '1xbet' }]).map((b) => b.name), ['SportyBet', '1xBet']);
  assert.deepEqual(parseParticipants({ 3: 'Arsenal', 35: 'Chelsea' }), { 3: 'Arsenal', 35: 'Chelsea' });
});

// ── end to end ──────────────────────────────────────────────────────────
test('runner: one tick builds a priced feed for every sport from three providers', async () => {
  let clock = T0;
  const world = mockWorld(() => clock);
  const store = emptyStore();
  const lookups = {};
  let ledgers = {}, lastRun = {};
  // A few ticks: lookups first, then odds.
  for (let i = 0; i < 4; i++) {
    const r = await runTick({ store, lookups, ledgers, lastRun, now: clock, fetcher: async (provider, url) => {
      const u = new URL(url);
      if (provider === "oddspapi" && u.pathname.endsWith("/odds-by-tournaments")) {
        assert.ok(u.searchParams.get("bookmaker"), "OddsPapi requires one bookmaker");
        assert.equal(u.searchParams.has("bookmakers"), false);
        assert.equal(u.searchParams.get("bookmaker").includes(","), false);
      }
      return world.fetcher(provider, url);
    }, keys: { apiSports: true, oddsApi: true, oddspapi: true }, sleep: async () => {} });
    ledgers = r.ledgers;
    lastRun = r.lastRun;
    assert.deepEqual(r.log, []);
    clock += 30 * 60_000;
  }
  const feed = buildFeed(store, clock);
  for (const s of SPORT_KEYS) assert.ok(feed.inputs[s].length > 0, `${s} has priced games`);
  // Team names from three providers resolved onto the same games.
  const fb = Object.values(store.games).filter((g) => g.sport === 'football' && g.kickoff > clock);
  assert.ok(fb.some((g) => g.odds['1xBet'] && g.odds.Pinnacle && g.odds.SportyBet), 'football game has API-Sports, The Odds API and OddsPapi prices');
  assert.ok(!Object.values(store.games).some((g) => !g.ext.as && g.sport === 'football'), 'no duplicate odds-only football games');
  // Ratings come from the league tables once they're in.
  assert.ok(feed.inputs.football.some((i) => i.ratingsSource !== 'market'));
  // Every input runs through its engine.
  for (const s of SPORT_KEYS) {
    const p = predict(s, feed.inputs[s][0], { now: clock });
    assert.equal(p.sport, s);
    assert.ok(p.markets.length >= 3);
  }
  // The store survives a JSON round trip.
  assert.equal(Object.keys(reviveStore(JSON.parse(JSON.stringify(store))).games).length, Object.keys(store.games).length);
});

test('runner: a simulated month never exceeds any quota, and every day gets fresh odds', async () => {
  let clock = Date.parse('2026-10-01T00:05:00Z');
  const end = Date.parse('2026-11-01T00:00:00Z');
  const world = mockWorld(() => clock);
  const store = emptyStore();
  const lookups = {};
  let ledgers = {}, lastRun = {};
  while (clock < end) {
    const r = await runTick({ store, lookups, ledgers, lastRun, now: clock, fetcher: world.fetcher, keys: { apiSports: true, oddsApi: true, oddspapi: true }, sleep: async () => {} });
    ledgers = r.ledgers;
    lastRun = r.lastRun;
    if (clock % (6 * 3600_000) < 30 * 60_000) updateRecord(store, clock);
    clock += 30 * 60_000;
  }
  const perDay = Object.values(world.calls['api-sports']);
  assert.ok(Math.max(...perDay) <= 90, `API-Sports max per sport per day ${Math.max(...perDay)}`);
  assert.ok(world.calls.oddspapi <= 240, `OddsPapi month ${world.calls.oddspapi}`);
  assert.ok(world.calls['the-odds-api'] <= 488, `The Odds API month ${world.calls['the-odds-api']}`);
  // Spend is spread: no day goes without paid odds calls.
  for (let d = 1; d <= 31; d++) {
    const day = `2026-10-${String(d).padStart(2, '0')}`;
    assert.ok((world.calls.byDay[`the-odds-api:${day}`] ?? 0) > 0, `The Odds API used on ${day}`);
    assert.ok((world.calls.byDay[`oddspapi:${day}`] ?? 0) > 0, `OddsPapi used on ${day}`);
  }
  // And the budgets are actually used, not hoarded.
  assert.ok(world.calls['the-odds-api'] > 400, `The Odds API used ${world.calls['the-odds-api']}`);
  assert.ok(world.calls.oddspapi > 180, `OddsPapi used ${world.calls.oddspapi}`);
  // The pick ledger settled games along the way.
  // Unvalidated production inputs still settle their forecast archive, but may
  // not manufacture an official betting verdict from synthetic provider prices.
  assert.ok(Object.values(store.projections).some(p=>p.state==='finished'&&p.selections.some(s=>s.result)));
  assert.equal(store.record.settled.length,0);
  for (const p of store.record.settled) assert.ok(['won', 'lost', 'push', 'half-won', 'half-lost'].includes(/** @type {string} */ (p.result)));
});

test('build: no prices and no table means no prediction, but the game still lists', () => {
  const store = emptyStore();
  store.games['football-as-1'] = { uid: 'football-as-1', sport: 'football', league: 'NPFL', home: 'Enyimba', away: 'Rangers', kickoff: T0 + 3600_000, status: { state: 'scheduled' }, ext: { as: '1' }, odds: {}, updated: T0 };
  assert.equal(inputFor(store, store.games['football-as-1']), null);
  const feed = buildFeed(store, T0);
  assert.equal(feed.inputs.football.length, 0);
  assert.equal(feed.games.length, 1);
  assert.equal(feed.games[0].priced, false);
});
