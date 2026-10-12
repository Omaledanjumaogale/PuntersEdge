/**
 * Multi-Bookmaker Pricing, Market Options & Discrepancy Engine
 * Reverse engineered from SportyBet (NG/Global), 1xBet, 22Bet, and 24Live market feeds.
 */

import { removeVigMultiplicative } from './vig_removal.js';

/**
 * Standardizes betting market options across bookmakers.
 */
export const MARKET_TYPES = {
  ONE_X_TWO: '1X2',
  DOUBLE_CHANCE: 'DOUBLE_CHANCE',
  OVER_UNDER_GOALS: 'OVER_UNDER_GOALS',
  BOTH_TEAMS_TO_SCORE: 'BTTS',
  DRAW_NO_BET: 'DRAW_NO_BET',
  ASIAN_HANDICAP: 'ASIAN_HANDICAP',
  BASKETBALL_TOTAL: 'BASKETBALL_TOTAL',
  BASKETBALL_SPREAD: 'BASKETBALL_SPREAD'
};

/**
 * Computes Double Chance fair odds from 1X2 true probabilities.
 * @param {{ home: number, draw: number, away: number }} trueProb
 */
export function deriveDoubleChance(trueProb) {
  const prob1X = trueProb.home + trueProb.draw;
  const prob12 = trueProb.home + trueProb.away;
  const probX2 = trueProb.draw + trueProb.away;

  return {
    '1X': { prob: prob1X, fairOdds: 1 / prob1X },
    '12': { prob: prob12, fairOdds: 1 / prob12 },
    'X2': { prob: probX2, fairOdds: 1 / probX2 }
  };
}

/**
 * Computes Draw No Bet (DNB) from 1X2 probabilities.
 * In DNB, a draw results in a refund (push).
 * @param {{ home: number, draw: number, away: number }} trueProb
 */
export function deriveDrawNoBet(trueProb) {
  const nonDrawTotal = trueProb.home + trueProb.away;
  const probHomeDNB = trueProb.home / nonDrawTotal;
  const probAwayDNB = trueProb.away / nonDrawTotal;

  return {
    homeDNB: { prob: probHomeDNB, fairOdds: 1 / probHomeDNB },
    awayDNB: { prob: probAwayDNB, fairOdds: 1 / probAwayDNB }
  };
}

/**
 * Compares multi-bookmaker odds to detect market discrepancies and Arbitrage (Surebet).
 * 
 * @param {Array<{ bookmaker: string, odds: { home: number, draw: number, away: number } }>} bookmakerList
 */
export function compareBookmakerOdds(bookmakerList) {
  let bestHome = { odds: 0, bookmaker: '' };
  let bestDraw = { odds: 0, bookmaker: '' };
  let bestAway = { odds: 0, bookmaker: '' };

  const parsedBooks = bookmakerList.map(b => {
    const margin = ((1 / b.odds.home + 1 / b.odds.draw + 1 / b.odds.away) - 1.0) * 100;
    if (b.odds.home > bestHome.odds) bestHome = { odds: b.odds.home, bookmaker: b.bookmaker };
    if (b.odds.draw > bestDraw.odds) bestDraw = { odds: b.odds.draw, bookmaker: b.bookmaker };
    if (b.odds.away > bestAway.odds) bestAway = { odds: b.odds.away, bookmaker: b.bookmaker };

    return {
      bookmaker: b.bookmaker,
      odds: b.odds,
      marginPercent: Math.round(margin * 100) / 100
    };
  });

  // Arbitrage check across market extremes
  const arbOverround = (1 / bestHome.odds) + (1 / bestDraw.odds) + (1 / bestAway.odds);
  const isArbitrage = arbOverround < 1.0;
  const profitMarginPercent = isArbitrage ? ((1.0 - arbOverround) / arbOverround) * 100 : 0;

  return {
    bookmakers: parsedBooks,
    bestMarketConsensus: {
      bestHome,
      bestDraw,
      bestAway,
      arbOverround: Math.round(arbOverround * 10000) / 10000,
      isArbitrage,
      profitMarginPercent: Math.round(profitMarginPercent * 100) / 100
    }
  };
}

/**
 * SportyBet FlexiBet & Multibet Accumulator Retention Modeling
 * Reverse engineered from SportyBet's internal oddsKeys curve.
 * 
 * @param {number[]} legOdds Array of individual leg odds in accumulator
 */
export function calculateAccumulatorEconomics(legOdds) {
  const combinedGrossOdds = legOdds.reduce((acc, o) => acc * o, 1);
  const legCount = legOdds.length;

  // Assuming average bookie vig per leg of ~5%
  const estimatedCompoundVig = 1 - Math.pow(0.95, legCount);

  // Probability of all legs winning under independent assumption
  const estimatedProb = legOdds.reduce((acc, o) => acc * (0.95 / o), 1);

  return {
    legCount,
    combinedGrossOdds: Math.round(combinedGrossOdds * 100) / 100,
    compoundMarginRiskPct: Math.round(estimatedCompoundVig * 10000) / 100,
    estimatedWinProbPct: Math.round(estimatedProb * 10000) / 100,
    puntersWarning: legCount > 4 
      ? 'High compound bookmaker edge. Recommend hedging or splitting into round-robins / flexibet.'
      : 'Moderate compound edge within controlled risk variance.'
  };
}
