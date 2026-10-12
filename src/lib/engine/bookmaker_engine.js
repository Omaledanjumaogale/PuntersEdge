/**
 * Multi-bookmaker pricing: derived markets, best-price discovery, arbitrage
 * detection and accumulator economics.
 */

import { fairProbabilities } from './vig_removal.js';
import { round, fairOdds } from './math.js';

export const MARKET_TYPES = {
  ONE_X_TWO: '1X2',
  DOUBLE_CHANCE: 'DOUBLE_CHANCE',
  OVER_UNDER_GOALS: 'OVER_UNDER_GOALS',
  BOTH_TEAMS_TO_SCORE: 'BTTS',
  DRAW_NO_BET: 'DRAW_NO_BET',
  ASIAN_HANDICAP: 'ASIAN_HANDICAP',
  BASKETBALL_MONEYLINE: 'BASKETBALL_MONEYLINE',
  BASKETBALL_TOTAL: 'BASKETBALL_TOTAL',
  BASKETBALL_SPREAD: 'BASKETBALL_SPREAD'
};

/** @param {{ home: number, draw: number, away: number }} p */
export function deriveDoubleChance(p) {
  const dc = { '1X': p.home + p.draw, '12': p.home + p.away, X2: p.draw + p.away };
  return {
    '1X': { prob: dc['1X'], fairOdds: fairOdds(dc['1X']) },
    '12': { prob: dc['12'], fairOdds: fairOdds(dc['12']) },
    X2: { prob: dc.X2, fairOdds: fairOdds(dc.X2) }
  };
}

/** @param {{ home: number, draw: number, away: number }} p */
export function deriveDrawNoBet(p) {
  const nd = p.home + p.away;
  return {
    homeDNB: { prob: p.home / nd, fairOdds: nd / p.home },
    awayDNB: { prob: p.away / nd, fairOdds: nd / p.away }
  };
}

/**
 * Compare 1X2 prices across books: per-book margin, best price per outcome,
 * de-vigged consensus and cross-book arbitrage.
 * @param {Array<{ bookmaker: string, odds: { home: number, draw: number, away: number } }>} bookmakerList
 */
export function compareBookmakerOdds(bookmakerList) {
  let bestHome = { odds: 0, bookmaker: '' };
  let bestDraw = { odds: 0, bookmaker: '' };
  let bestAway = { odds: 0, bookmaker: '' };

  const bookmakers = bookmakerList.map((b) => {
    const { home, draw, away } = b.odds;
    if (home > bestHome.odds) bestHome = { odds: home, bookmaker: b.bookmaker };
    if (draw > bestDraw.odds) bestDraw = { odds: draw, bookmaker: b.bookmaker };
    if (away > bestAway.odds) bestAway = { odds: away, bookmaker: b.bookmaker };
    const margin = (1 / home + 1 / draw + 1 / away - 1) * 100;
    const fair = fairProbabilities([home, draw, away]);
    return {
      bookmaker: b.bookmaker,
      odds: b.odds,
      marginPercent: round(margin, 2),
      fair: { home: fair[0], draw: fair[1], away: fair[2] }
    };
  });

  const n = bookmakers.length || 1;
  const consensus = {
    home: bookmakers.reduce((a, b) => a + b.fair.home, 0) / n,
    draw: bookmakers.reduce((a, b) => a + b.fair.draw, 0) / n,
    away: bookmakers.reduce((a, b) => a + b.fair.away, 0) / n
  };

  const arbOverround = 1 / bestHome.odds + 1 / bestDraw.odds + 1 / bestAway.odds;
  const isArbitrage = arbOverround < 1;

  return {
    bookmakers,
    consensus,
    bestMarketConsensus: {
      bestHome,
      bestDraw,
      bestAway,
      arbOverround: round(arbOverround, 4),
      isArbitrage,
      profitMarginPercent: isArbitrage ? round(((1 - arbOverround) / arbOverround) * 100, 2) : 0
    }
  };
}

/**
 * Optimal arbitrage stake split so every outcome returns the same amount.
 * @param {number[]} odds best odds per outcome
 * @param {number} totalStake
 */
export function arbitrageStakes(odds, totalStake) {
  const inv = odds.map((o) => 1 / o);
  const s = inv.reduce((a, b) => a + b, 0);
  const stakes = inv.map((x) => (totalStake * x) / s);
  return { stakes: stakes.map((x) => round(x, 2)), guaranteedReturn: round(totalStake / s, 2) };
}

/**
 * Accumulator economics from quoted odds only, assuming a per-leg margin.
 * @param {number[]} legOdds
 * @param {number} [perLegMargin]
 */
export function calculateAccumulatorEconomics(legOdds, perLegMargin = 0.05) {
  const combinedGrossOdds = legOdds.reduce((acc, o) => acc * o, 1);
  const legCount = legOdds.length;
  const compoundMargin = 1 - (1 - perLegMargin) ** legCount;
  const estimatedProb = legOdds.reduce((acc, o) => acc * ((1 - perLegMargin) / o), 1);
  return {
    legCount,
    combinedGrossOdds: round(combinedGrossOdds, 2),
    compoundMarginRiskPct: round(compoundMargin * 100, 2),
    estimatedWinProbPct: round(estimatedProb * 100, 2),
    puntersWarning:
      legCount > 4
        ? 'Bookmaker edge compounds on every leg. Consider singles or smaller combinations.'
        : 'Compound margin is within a controlled range.'
  };
}

/**
 * Accumulator economics from the model: combined probability, expected value
 * and break-even, assuming independent legs.
 * @param {Array<{ odds: number, modelProb: number }>} legs
 */
export function evaluateAccumulator(legs) {
  if (legs.length === 0) {
    return { legCount: 0, combinedOdds: 1, combinedProb: 1, evPercent: 0, breakEvenProb: 1, expectedReturnPerUnit: 1 };
  }
  const combinedOdds = legs.reduce((a, l) => a * l.odds, 1);
  const combinedProb = legs.reduce((a, l) => a * l.modelProb, 1);
  const ev = combinedProb * combinedOdds - 1;
  return {
    legCount: legs.length,
    combinedOdds: round(combinedOdds, 2),
    combinedProb,
    evPercent: round(ev * 100, 2),
    breakEvenProb: 1 / combinedOdds,
    expectedReturnPerUnit: round(1 + ev, 4)
  };
}
