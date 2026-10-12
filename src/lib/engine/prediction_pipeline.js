/**
 * Prediction pipeline.
 *
 * Raw inputs (team ratings, absences, bookmaker prices) → fully derived
 * prediction objects. Every probability, fair price, edge, stake and grade
 * shown in the app is computed here; nothing downstream is hand-entered.
 *
 *   ratings ─► lineup adjustment ─► model distribution ─┐
 *   bookmaker odds ─► Shin de-vig ─► market consensus ──┴► blend ─► value scan ─► grade/stake
 */

import { generateScoreMatrix } from './football_model.js';
import { adjustParametersForLineups } from './lineup_impact.js';
import { deriveDoubleChance, deriveDrawNoBet } from './bookmaker_engine.js';
import { fairProbabilities } from './vig_removal.js';
import { calculateExpectedValue, calculateKellyStake, gradeSelection, analyzeOddsMovement } from './decision_screener.js';
import { projectBasketballGame, LEAGUE_PROFILES, probabilityOver, probabilityHomeCovers } from './basketball_model.js';
import { round, fairOdds } from './math.js';
import { buildFootballMarkets, buildBasketballMarkets } from './market_book.js';

/**
 * League profile for any basketball competition: NBA rules (48 min, fast) or
 * FIBA rules (40 min, slower) for everything else.
 * @param {string} league
 */
export function leagueProfile(league) {
  if (league in LEAGUE_PROFILES) return LEAGUE_PROFILES[/** @type {keyof typeof LEAGUE_PROFILES} */ (league)];
  return /nba/i.test(league) && !/g league/i.test(league) ? LEAGUE_PROFILES.NBA : LEAGUE_PROFILES.EuroLeague;
}

/** Default weight of the model vs. de-vigged market consensus. */
export const DEFAULT_MODEL_WEIGHT = 0.6;
/** Ignore edges above this — almost always stale prices or data errors. */
const MAX_CREDIBLE_EDGE = 25;

/**
 * @typedef {Object} ValueBet
 * @property {string} id
 * @property {string} fixtureId
 * @property {'football' | 'basketball' | 'nba' | 'hockey' | 'baseball'} sport
 * @property {string} matchTitle
 * @property {string} league
 * @property {string} market
 * @property {string} selection
 * @property {string} bookmaker
 * @property {number} bestOdds
 * @property {number} fairOdds
 * @property {number} modelProb blended probability used for pricing
 * @property {number} marketProb de-vigged consensus probability
 * @property {number} edgePercent
 * @property {number} kellyStakePercent
 * @property {'A+' | 'A' | 'B' | 'C' | 'PASS'} grade
 */

/**
 * @param {number} model
 * @param {number} market
 * @param {number} w
 */
const blend = (model, market, w) => w * model + (1 - w) * market;

/**
 * Average de-vigged probabilities of a market across every book that prices it.
 * @param {Record<string, Record<string, number>>} odds
 * @param {string[]} keys outcome keys forming a complete market
 */
function consensus(odds, keys) {
  const books = Object.values(odds).filter((o) => keys.every((k) => o[k] > 1));
  if (books.length === 0) return null;
  const sums = keys.map(() => 0);
  for (const o of books) {
    const fair = fairProbabilities(keys.map((k) => o[k]));
    fair.forEach((p, i) => (sums[i] += p));
  }
  return Object.fromEntries(keys.map((k, i) => [k, sums[i] / books.length]));
}

/**
 * Best price for an outcome across books.
 * @param {Record<string, Record<string, number>>} odds
 * @param {string} key
 */
function bestPrice(odds, key) {
  let best = { odds: 0, bookmaker: '' };
  for (const [bookmaker, o] of Object.entries(odds)) {
    if ((o[key] ?? 0) > best.odds) best = { odds: o[key], bookmaker };
  }
  return best;
}

/**
 * Margin per book for a complete market.
 * @param {Record<string, Record<string, number>>} odds
 * @param {string[]} keys
 */
function margins(odds, keys) {
  return Object.fromEntries(
    Object.entries(odds)
      .filter(([, o]) => keys.every((k) => o[k] > 1))
      .map(([book, o]) => [book, round((keys.reduce((a, k) => a + 1 / o[k], 0) - 1) * 100, 2)])
  );
}

/**
 * Game state as reported by a live feed. Sample fixtures are always scheduled.
 * @typedef {{ state: 'scheduled' | 'live' | 'finished' | 'postponed', home?: number, away?: number, detail?: string }} GameStatus
 */

/** @param {GameStatus | undefined} s @returns {GameStatus} */
const statusOf = (s) => s ?? { state: 'scheduled' };

/**
 * @param {object} ctx
 * @param {string} ctx.fixtureId
 * @param {'football' | 'basketball' | 'nba' | 'hockey' | 'baseball'} ctx.sport
 * @param {string} ctx.matchTitle
 * @param {string} ctx.league
 * @param {Array<{ market: string, selection: string, key: string, prob: number, marketProb: number }>} candidates
 * @param {Record<string, Record<string, number>>} odds
 * @param {number} [kellyFraction]
 * @returns {ValueBet[]} every candidate priced at its best available odds, best first
 */
function scanMarkets(ctx, candidates, odds, kellyFraction = 0.25) {
  /** @type {ValueBet[]} */
  const out = [];
  for (const c of candidates) {
    const best = bestPrice(odds, c.key);
    if (best.odds <= 1) continue;
    const ev = calculateExpectedValue(c.prob, best.odds);
    if (ev.edgePercent > MAX_CREDIBLE_EDGE) continue;
    const stake = calculateKellyStake(c.prob, best.odds, kellyFraction);
    out.push({
      id: `${ctx.fixtureId}:${c.key}`,
      fixtureId: ctx.fixtureId,
      sport: ctx.sport,
      matchTitle: ctx.matchTitle,
      league: ctx.league,
      market: c.market,
      selection: c.selection,
      bookmaker: best.bookmaker,
      bestOdds: best.odds,
      fairOdds: round(fairOdds(c.prob), 2),
      modelProb: c.prob,
      marketProb: c.marketProb,
      edgePercent: ev.edgePercent,
      kellyStakePercent: stake.recommendedStakePct,
      grade: ev.isPositiveEV ? gradeSelection(ev.edgePercent, Math.abs(c.prob - c.marketProb) * 100) : 'PASS'
    });
  }
  return out.sort((a, b) => b.edgePercent - a.edgePercent);
}

/**
 * @param {Date | number} now
 * @param {number} offsetHours
 */
function kickoffFrom(now, offsetHours) {
  const t = typeof now === 'number' ? now : now.getTime();
  // Snap to the quarter hour so times look like real fixtures.
  const raw = t + offsetHours * 3600_000;
  return new Date(Math.round(raw / 900_000) * 900_000).toISOString();
}

/**
 * @typedef {Object} FootballInput
 * @property {string} fixtureId
 * @property {string} homeTeam
 * @property {string} awayTeam
 * @property {string} league
 * @property {number} [kickoffOffsetHours]
 * @property {string} [kickoffTime] ISO time (overrides offset)
 * @property {{ lambdaHome: number, muAway: number, rho?: number }} ratings
 * @property {{ home?: import('./lineup_impact.js').Absence[], away?: import('./lineup_impact.js').Absence[] }} [absences]
 * @property {Record<string, Record<string, number>>} odds keys: home, draw, away, over25, under25, bttsYes, bttsNo
 * @property {{ home: number, away: number }} [openingOdds]
 * @property {{ home?: number, away?: number }} [publicPct]
 * @property {GameStatus} [status]
 * @property {string} [ratingsSource] where the team strengths came from
 */

/**
 * Build a complete football prediction.
 * @param {FootballInput} input
 * @param {{ modelWeight?: number, kellyFraction?: number, now?: Date | number }} [options]
 */
export function buildFootballPrediction(input, options = {}) {
  const w = options.modelWeight ?? DEFAULT_MODEL_WEIGHT;
  const rho = input.ratings.rho ?? -0.06;
  const matchTitle = `${input.homeTeam} vs ${input.awayTeam}`;

  const lineup = adjustParametersForLineups(input.ratings, input.absences?.home ?? [], input.absences?.away ?? []);
  const { lambdaHome, muAway } = lineup.adjusted;
  const model = generateScoreMatrix(lambdaHome, muAway, rho, 10);
  const mp = model.probabilities;

  const m1x2 = consensus(input.odds, ['home', 'draw', 'away']);
  const mOu = consensus(input.odds, ['over25', 'under25']);
  const mBtts = consensus(input.odds, ['bttsYes', 'bttsNo']);

  const modelProbs = {
    homeWin: mp.oneXTwo.home,
    draw: mp.oneXTwo.draw,
    awayWin: mp.oneXTwo.away,
    over25: mp.overUnder[2.5].over,
    under25: mp.overUnder[2.5].under,
    bttsYes: mp.btts.yes,
    bttsNo: mp.btts.no
  };
  const marketProbs = {
    homeWin: m1x2?.home ?? modelProbs.homeWin,
    draw: m1x2?.draw ?? modelProbs.draw,
    awayWin: m1x2?.away ?? modelProbs.awayWin,
    over25: mOu?.over25 ?? modelProbs.over25,
    under25: mOu?.under25 ?? modelProbs.under25,
    bttsYes: mBtts?.bttsYes ?? modelProbs.bttsYes,
    bttsNo: mBtts?.bttsNo ?? modelProbs.bttsNo
  };
  /** @type {typeof modelProbs} */
  const probabilities = /** @type {any} */ (
    Object.fromEntries(Object.entries(modelProbs).map(([k, v]) => [k, blend(v, marketProbs[/** @type {keyof typeof marketProbs} */ (k)], w)]))
  );

  const ctx = { fixtureId: input.fixtureId, sport: /** @type {const} */ ('football'), matchTitle, league: input.league };
  const valueBets = scanMarkets(
    ctx,
    [
      { market: 'Match Result (1X2)', selection: `${input.homeTeam} Win`, key: 'home', prob: probabilities.homeWin, marketProb: marketProbs.homeWin },
      { market: 'Match Result (1X2)', selection: 'Draw', key: 'draw', prob: probabilities.draw, marketProb: marketProbs.draw },
      { market: 'Match Result (1X2)', selection: `${input.awayTeam} Win`, key: 'away', prob: probabilities.awayWin, marketProb: marketProbs.awayWin },
      { market: 'Total Goals', selection: 'Over 2.5 Goals', key: 'over25', prob: probabilities.over25, marketProb: marketProbs.over25 },
      { market: 'Total Goals', selection: 'Under 2.5 Goals', key: 'under25', prob: probabilities.under25, marketProb: marketProbs.under25 },
      { market: 'Both Teams To Score', selection: 'BTTS Yes', key: 'bttsYes', prob: probabilities.bttsYes, marketProb: marketProbs.bttsYes },
      { market: 'Both Teams To Score', selection: 'BTTS No', key: 'bttsNo', prob: probabilities.bttsNo, marketProb: marketProbs.bttsNo }
    ],
    input.odds,
    options.kellyFraction
  );

  const movement = input.openingOdds
    ? analyzeOddsMovement(input.openingOdds.home, bestPrice(input.odds, 'home').odds, input.publicPct?.home ?? 50)
    : null;

  const absences = [...(input.absences?.home ?? []).map((a) => ({ ...a, team: input.homeTeam })), ...(input.absences?.away ?? []).map((a) => ({ ...a, team: input.awayTeam }))];
  const blended1x2 = { home: probabilities.homeWin, draw: probabilities.draw, away: probabilities.awayWin };

  const top = mp.topPredictedScores[0];
  return {
    sport: /** @type {const} */ ('football'),
    family: /** @type {const} */ ('football'),
    fixtureId: input.fixtureId,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    matchTitle,
    league: input.league,
    kickoffTime: input.kickoffTime ?? kickoffFrom(options.now ?? Date.now(), input.kickoffOffsetHours ?? 24),
    status: statusOf(input.status),
    ratingsSource: input.ratingsSource ?? 'sample',
    modelWeight: w,
    expectedGoals: {
      homeLambda: lambdaHome,
      awayMu: muAway,
      baseLambda: input.ratings.lambdaHome,
      baseMu: input.ratings.muAway,
      rho: model.rho
    },
    probabilities,
    modelProbabilities: modelProbs,
    marketProbabilities: marketProbs,
    topScorelines: mp.topPredictedScores,
    matrix: model.matrix.slice(0, 7).map((row) => row.slice(0, 7)),
    derived: {
      doubleChance: deriveDoubleChance(blended1x2),
      drawNoBet: deriveDrawNoBet(blended1x2),
      asianHandicap: mp.asianHandicap,
      overUnder: mp.overUnder,
      teamTotals: mp.teamTotals,
      cleanSheet: mp.cleanSheet
    },
    odds: input.odds,
    bookmakers: Object.keys(input.odds),
    margins: margins(input.odds, ['home', 'draw', 'away']),
    valueBets,
    bestValue: valueBets[0],
    summary: {
      scoreline: `${top.home}–${top.away}`,
      caption: `Most likely score (xG ${lambdaHome.toFixed(2)}–${muAway.toFixed(2)})`,
      unit: 'goals'
    },
    markets: buildFootballMarkets(input, mp, model.rho, { modelWeight: w, kellyFraction: options.kellyFraction ?? 0.25 }),
    movement,
    marketSteamAlert: Boolean(movement?.smartMoneyIndication),
    absences,
    impactDelta: lineup.impactDelta,
    lineupAlert: describeAbsences(absences, lineup.impactDelta, input.homeTeam, input.awayTeam)
  };
}

/**
 * Plain-English summary of absences and their modelled effect.
 * @param {Array<import('./lineup_impact.js').Absence & { team: string }>} absences
 * @param {ReturnType<typeof adjustParametersForLineups>['impactDelta']} delta
 * @param {string} home
 * @param {string} away
 */
function describeAbsences(absences, delta, home, away) {
  if (absences.length === 0) return 'No significant absences. Both sides at full strength.';
  const parts = [];
  if (delta.homeAttackChangePct || delta.homeDefenseChangePct) {
    parts.push(`${home} attack ${delta.homeAttackChangePct.toFixed(1)}%, defence weakened ${delta.homeDefenseChangePct.toFixed(1)}%`);
  }
  if (delta.awayAttackChangePct || delta.awayDefenseChangePct) {
    parts.push(`${away} attack ${delta.awayAttackChangePct.toFixed(1)}%, defence weakened ${delta.awayDefenseChangePct.toFixed(1)}%`);
  }
  const names = absences.map((a) => `${a.name} (${a.position})`).join(', ');
  return `Out: ${names}. Modelled impact: ${parts.join('; ')}.`;
}

/**
 * @typedef {Object} BasketballInput
 * @property {string} fixtureId
 * @property {string} homeTeam
 * @property {string} awayTeam
 * @property {string} league
 * @property {number} [kickoffOffsetHours]
 * @property {string} [kickoffTime]
 * @property {{ home: import('./basketball_model.js').TeamRatings, away: import('./basketball_model.js').TeamRatings }} ratings
 * @property {number} [hcaPoints]
 * @property {Array<{ name: string, team: 'home' | 'away', netRtgImpact: number }>} [absences]
 * @property {Record<string, { homeMoneyline: number, awayMoneyline: number, spreadLine: number, homeSpreadOdds: number, awaySpreadOdds: number, totalLine: number, overOdds: number, underOdds: number }>} odds
 * @property {{ home: number, away: number }} [openingOdds]
 * @property {{ home?: number }} [publicPct]
 * @property {GameStatus} [status]
 * @property {string} [ratingsSource]
 */

/**
 * Build a complete basketball prediction.
 * @param {BasketballInput} input
 * @param {{ modelWeight?: number, kellyFraction?: number, now?: Date | number, sport?: 'basketball' | 'nba' }} [options]
 */
export function buildBasketballPrediction(input, options = {}) {
  const w = options.modelWeight ?? DEFAULT_MODEL_WEIGHT;
  const league = leagueProfile(input.league);
  const matchTitle = `${input.homeTeam} vs ${input.awayTeam}`;

  // Absences: 60% of a player's net-rating value is lost on offence, 40% on defence.
  const ratings = { home: { ...input.ratings.home }, away: { ...input.ratings.away } };
  for (const a of input.absences ?? []) {
    const r = ratings[a.team];
    r.offRtg -= a.netRtgImpact * 0.6;
    r.defRtg += a.netRtgImpact * 0.4;
  }

  const books = Object.values(input.odds ?? {});
  const half = (/** @type {number} */ x) => Math.round(x * 2) / 2;
  const avgLine = (/** @type {'totalLine' | 'spreadLine'} */ k) => {
    const xs = books.map((o) => o[k]).filter((x) => typeof x === 'number' && Number.isFinite(x));
    return xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : undefined;
  };
  const pre = projectBasketballGame(ratings.home, ratings.away, league, { hcaPoints: input.hcaPoints }).projection;
  const consensusTotal = avgLine('totalLine') ?? half(pre.total);
  const consensusSpread = avgLine('spreadLine') ?? half(-pre.margin);

  const sim = projectBasketballGame(ratings.home, ratings.away, league, {
    hcaPoints: input.hcaPoints,
    totalLines: [consensusTotal],
    spreadLines: [consensusSpread]
  });
  const proj = sim.projection;

  // Per-book line-specific model probabilities (books can hang different numbers).
  /** @type {Record<string, Record<string, number>>} */
  const flat = {};
  for (const [book, o] of Object.entries(input.odds ?? {})) {
    flat[book] = {
      homeMl: o.homeMoneyline,
      awayMl: o.awayMoneyline,
      homeSpread: o.homeSpreadOdds,
      awaySpread: o.awaySpreadOdds,
      over: o.overOdds,
      under: o.underOdds
    };
  }

  const mMl = consensus(flat, ['homeMl', 'awayMl']);
  const mSpread = consensus(flat, ['homeSpread', 'awaySpread']);
  const mTotal = consensus(flat, ['over', 'under']);

  const modelProbs = {
    homeWin: sim.winProbabilities.home,
    awayWin: sim.winProbabilities.away,
    spreadCoverHome: probabilityHomeCovers(proj, consensusSpread),
    overTotal: probabilityOver(proj, consensusTotal)
  };
  const marketProbs = {
    homeWin: mMl?.homeMl ?? modelProbs.homeWin,
    awayWin: mMl?.awayMl ?? modelProbs.awayWin,
    spreadCoverHome: mSpread?.homeSpread ?? modelProbs.spreadCoverHome,
    overTotal: mTotal?.over ?? modelProbs.overTotal
  };
  const probabilities = {
    homeWin: blend(modelProbs.homeWin, marketProbs.homeWin, w),
    awayWin: blend(modelProbs.awayWin, marketProbs.awayWin, w),
    spreadCoverHome: blend(modelProbs.spreadCoverHome, marketProbs.spreadCoverHome, w),
    overTotal: blend(modelProbs.overTotal, marketProbs.overTotal, w),
    underTotal: 0
  };
  probabilities.underTotal = 1 - probabilities.overTotal;

  const fmtLine = (/** @type {number} */ l) => (l > 0 ? `+${l}` : `${l}`);
  const ctx = { fixtureId: input.fixtureId, sport: /** @type {any} */ (options.sport ?? 'basketball'), matchTitle, league: input.league };
  const valueBets = scanMarkets(
    ctx,
    [
      { market: 'Moneyline', selection: `${input.homeTeam} ML`, key: 'homeMl', prob: probabilities.homeWin, marketProb: marketProbs.homeWin },
      { market: 'Moneyline', selection: `${input.awayTeam} ML`, key: 'awayMl', prob: probabilities.awayWin, marketProb: marketProbs.awayWin },
      { market: 'Point Spread', selection: `${input.homeTeam} ${fmtLine(consensusSpread)}`, key: 'homeSpread', prob: probabilities.spreadCoverHome, marketProb: marketProbs.spreadCoverHome },
      { market: 'Point Spread', selection: `${input.awayTeam} ${fmtLine(-consensusSpread)}`, key: 'awaySpread', prob: 1 - probabilities.spreadCoverHome, marketProb: 1 - marketProbs.spreadCoverHome },
      { market: 'Total Points', selection: `Over ${consensusTotal}`, key: 'over', prob: probabilities.overTotal, marketProb: marketProbs.overTotal },
      { market: 'Total Points', selection: `Under ${consensusTotal}`, key: 'under', prob: probabilities.underTotal, marketProb: 1 - marketProbs.overTotal }
    ],
    flat,
    options.kellyFraction
  );

  const movement = input.openingOdds
    ? analyzeOddsMovement(input.openingOdds.home, bestPrice(flat, 'homeMl').odds, input.publicPct?.home ?? 50)
    : null;

  const absences = (input.absences ?? []).map((a) => ({ ...a, teamName: a.team === 'home' ? input.homeTeam : input.awayTeam }));

  return {
    sport: /** @type {'basketball' | 'nba'} */ (options.sport ?? 'basketball'),
    family: /** @type {const} */ ('basketball'),
    fixtureId: input.fixtureId,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    matchTitle,
    league: input.league,
    kickoffTime: input.kickoffTime ?? kickoffFrom(options.now ?? Date.now(), input.kickoffOffsetHours ?? 24),
    status: statusOf(input.status),
    ratingsSource: input.ratingsSource ?? 'sample',
    modelWeight: w,
    ratings,
    leagueProfile: league,
    hcaPoints: input.hcaPoints ?? 2.8,
    paceMetrics: {
      possessionsPer48: sim.expectedPace,
      homeOffRating: ratings.home.offRtg,
      awayOffRating: ratings.away.offRtg,
      homeDefRating: ratings.home.defRtg,
      awayDefRating: ratings.away.defRtg
    },
    projectedScore: sim.projectedScore,
    dispersion: sim.dispersion,
    simulation: sim.simulation,
    marketLines: { total: consensusTotal, spread: consensusSpread },
    probabilities,
    modelProbabilities: modelProbs,
    marketProbabilities: marketProbs,
    odds: input.odds,
    bookmakers: Object.keys(input.odds),
    margins: margins(flat, ['homeMl', 'awayMl']),
    valueBets,
    bestValue: valueBets[0],
    summary: {
      scoreline: `${Math.round(sim.projectedScore.home)}–${Math.round(sim.projectedScore.away)}`,
      caption: `Projected over ${sim.expectedPace} possessions`,
      unit: 'points'
    },
    markets: buildBasketballMarkets({ ...input, sport: options.sport }, proj, { modelWeight: w, kellyFraction: options.kellyFraction ?? 0.25 }),
    movement,
    marketSteamAlert: Boolean(movement?.smartMoneyIndication),
    absences,
    lineupAlert:
      absences.length === 0
        ? 'Both rotations healthy. No rating adjustments applied.'
        : `Out: ${absences.map((a) => `${a.name} (${a.teamName}, −${a.netRtgImpact} net rtg)`).join(', ')}.`
  };
}
