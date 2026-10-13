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

import { withModelOnlyMarkets } from '../engine/model-only.js';
import { SPORTS, SPORT_KEYS } from './catalog.js';
import { footballRatings, basketballRatings, scoreSportRatings, marketRatings } from '../engine/ratings.js';
import { buildFootballPrediction, buildBasketballPrediction } from '../engine/prediction_pipeline.js';
import { buildScoreSportPrediction } from '../engine/score_sports.js';
import { snapshotOf, settleSnapshot, REVIEW_MS } from './performance.js';

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
    odds,
    quoteObservedAt:Object.fromEntries(Object.entries(g.odds).map(([book,price])=>[book,price.at]))
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
  if (!ratings) {
    // Derive strengths only from actually retained final scores, never synthetic priors alone.
    const rows = new Map();
    const recent = Object.values(store.games).filter(x => x.sport === g.sport && x.league === g.league && x.status.state === 'finished' && x.kickoff < g.kickoff && Number.isFinite(x.status.home) && Number.isFinite(x.status.away));
    for (const match of recent) for (const side of /** @type {const} */ (['home','away'])) {
      const id = side === 'home' ? match.homeId : match.awayId;
      if(id === undefined) continue;
      const row = rows.get(String(id)) ?? {teamId:id,team:match[side],played:0,for:0,against:0};
      row.played++; row.for += match.status[side] ?? 0; row.against += match.status[side === 'home' ? 'away' : 'home'] ?? 0; rows.set(String(id),row);
    }
    if(recent.length >= 6 && (rows.get(String(g.homeId))?.played ?? 0) >= 3 && (rows.get(String(g.awayId))?.played ?? 0) >= 3) {
      const values = [...rows.values()];
      ratings = def.family === 'football' ? footballRatings(values,g.homeId ?? '',g.awayId ?? '') : def.family === 'basketball' ? basketballRatings(values,g.homeId ?? '',g.awayId ?? '',g.league) : scoreSportRatings(values,g.homeId ?? '',g.awayId ?? '',def.family);
      if(ratings)source = `retained recent results (${recent.length} completed games; limited sample)`;
    }
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
  if (fam === 'football') return withModelOnlyMarkets(buildFootballPrediction(input, opts),input.quoteObservedAt);
  if (fam === 'basketball') return withModelOnlyMarkets(buildBasketballPrediction(input, { ...opts, sport: /** @type {'basketball' | 'nba'} */ (sport) }),input.quoteObservedAt);
  return withModelOnlyMarkets(buildScoreSportPrediction(input, fam, { ...opts, sport }),input.quoteObservedAt);
}

/**
 * Update the pick ledger: refresh picks for games about to start, settle
 * finished ones.
 * @param {Store} store
 * @param {number} now
 */
export function updateRecord(store, now) {
  const changed = [];
  for (const g of Object.values(store.games)) {
    let snapshot = store.projections[g.uid];
    if (!snapshot && g.status.state === 'scheduled' && g.kickoff > now && g.kickoff < now + 4 * DAY) {
      const input = inputFor(store,g);
      if(input) try {
        snapshot = snapshotOf(g,input,predict(g.sport,input,{now}),now);
        store.projections[g.uid] = snapshot;
        changed.push(snapshot);
      } catch { /* Invalid input is reported as unavailable, never invented. */ }
    }
    if (!snapshot) continue;
    if(g.status.state === 'scheduled' && g.kickoff > now) {
      const latestInput=inputFor(store,g);
      if(latestInput) try {
        const latest=predict(g.sport,latestInput,{now});
        const previous=snapshot.latestGrades ?? Object.fromEntries(snapshot.selections.map((/** @type {any} */ s)=>[s.key,s.grade]));
        let updated=false;
        for(const selection of latest.markets.flatMap((/** @type {any} */ group)=>group.selections)) {
          const key=selection.id.slice(g.uid.length+1);
          if(previous[key] !== undefined && previous[key] !== selection.grade) {
            snapshot.gradeHistory ??= [];
            snapshot.gradeHistory.push({key,at:now,from:previous[key],to:selection.grade,modelProb:selection.modelProb,odds:selection.bestOdds});updated=true;
          }
          previous[key]=selection.grade;
        }
        snapshot.latestGrades=previous;
        if(updated){snapshot.gradeHistory=snapshot.gradeHistory.slice(-100);if(!changed.includes(snapshot))changed.push(snapshot);}
      } catch { /* Keep the previously published snapshot. */ }
    }
    const before = JSON.stringify({state:snapshot.state,score:snapshot.score});
    settleSnapshot(snapshot,g,now);
    if(before !== JSON.stringify({state:snapshot.state,score:snapshot.score}) && !changed.includes(snapshot)) changed.push(snapshot);
  }
  // Only versioned, published pre-match verdicts contribute to the public record.
  store.record.pending = {};
  const settled = new Map(store.record.settled.filter(p=>p.publishedAt).map(p=>[p.uid,p]));
  for(const snapshot of Object.values(store.projections)) {
    const best = snapshot.selections.find((/** @type {any} */ selection) => selection.verdict);
    if(!best) continue;
    const pick = {...best,uid:snapshot.fixtureId,sport:snapshot.sport,family:snapshot.family,match:snapshot.match,league:snapshot.league,kickoff:snapshot.kickoff,publishedAt:snapshot.publishedAt,modelVersion:snapshot.modelVersion};
    if(best.result && best.result !== 'ungraded') settled.set(snapshot.fixtureId,{...pick,score:`${snapshot.score.home}–${snapshot.score.away}`});
    else if(snapshot.state === 'scheduled' || snapshot.state === 'live') store.record.pending[snapshot.fixtureId]=pick;
  }
  store.record.settled = [...settled.values()].sort((a,b)=>a.kickoff-b.kickoff).slice(-300);
  return changed;
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
    const snapshot = store.projections[g.uid];
    const reviewable = snapshot?.finishedAt && now < snapshot.finishedAt + REVIEW_MS;
    const input = reviewable ? {...snapshot.input,status:g.status} : priceable && g.kickoff > now - 4 * H ? inputFor(store, g) : null;
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
      projected: Boolean(input),
      availabilityReason: !input ? (Object.keys(g.odds).length ? 'No complete supported market or sufficient team-strength data.' : 'No usable bookmaker prices or sufficient team-strength data from this provider plan.') : undefined,
      priced: Object.values(g.odds).some(book => Object.entries(book).some(([key,value])=>key !== 'at' && !key.toLowerCase().includes('line') && value > 1))
    });
  }
  const settled = store.record.settled;
  return {
    v: 1,
    generatedAt: new Date(now).toISOString(),
    inputs,
    games,
    record: { summary: recordSummary(settled), recent: settled.slice(-60).reverse(), pending: Object.values(store.record.pending).length },
    projections: Object.values(store.projections).filter((/** @type {any} */ p) => !p.finishedAt || now < p.finishedAt + REVIEW_MS).map((/** @type {any} */ p) => ({fixtureId:p.fixtureId,sport:p.sport,match:p.match,league:p.league,kickoff:new Date(p.kickoff).toISOString(),publishedAt:p.publishedAt,state:p.state,...(p.score?{score:`${p.score.home}–${p.score.away}`}:{})})),
    gradeHistory: Object.fromEntries(Object.values(store.projections).map((p)=>[p.fixtureId,p.gradeHistory??[]])),
    reviewInputs: Object.fromEntries(Object.values(store.projections).filter((/** @type {any} */ p) => !p.finishedAt || now < p.finishedAt+REVIEW_MS).map((/** @type {any} */ p) => [p.fixtureId,{sport:p.sport,frozenVerdictKey:p.selections.find((/** @type {any} */ s)=>s.verdict)?.key??null,frozenGrades:Object.fromEntries(p.selections.map((/** @type {any} */ s)=>[s.key,s.grade])),input:{...p.input,status:store.games[p.fixtureId]?.status??p.input.status},publishedAt:p.publishedAt,modelVersion:p.modelVersion}])),
    // Quotas and source logs belong exclusively to the protected admin console.
    usage: null,
    sources: {}
  };
}
