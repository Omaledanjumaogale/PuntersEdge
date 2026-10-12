/**
 * Quantitative Market Vig Removal and Fair Implied Probability Module
 * Reverse engineered from Matchplay.com odds consensus & movements.
 */

/**
 * Calculates bookmaker margin (overround).
 * Example: Odds of [2.00, 3.40, 3.80] gives Overround ~ 1.057 (5.7% margin)
 * @param {number[]} odds
 * @returns {number}
 */
export function calculateOverround(odds) {
  return odds.reduce((acc, o) => acc + (1 / o), 0);
}

/**
 * Multiplicative margin removal (Standard Proportional normalization).
 * @param {{ home: number, draw?: number, away: number }} odds
 */
export function removeVigMultiplicative(odds) {
  const isThreeWay = odds.draw !== undefined;
  const oddsList = isThreeWay ? [odds.home, odds.draw, odds.away] : [odds.home, odds.away];
  const overround = calculateOverround(oddsList);

  const rawHome = 1 / odds.home;
  const rawAway = 1 / odds.away;

  if (isThreeWay) {
    const rawDraw = 1 / odds.draw;
    return {
      home: rawHome / overround,
      draw: rawDraw / overround,
      away: rawAway / overround,
      overround,
      marginPercent: (overround - 1) * 100
    };
  }

  return {
    home: rawHome / overround,
    away: rawAway / overround,
    overround,
    marginPercent: (overround - 1) * 100
  };
}

/**
 * Power Method for vig removal (handles longshot bias where bookmakers add higher vig to longshots).
 * @param {{ home: number, draw?: number, away: number }} odds
 */
export function removeVigPower(odds) {
  const isThreeWay = odds.draw !== undefined;
  const rawList = isThreeWay ? [1 / odds.home, 1 / odds.draw, 1 / odds.away] : [1 / odds.home, 1 / odds.away];
  const overround = calculateOverround(isThreeWay ? [odds.home, odds.draw, odds.away] : [odds.home, odds.away]);

  let low = 0.5;
  let high = 2.0;
  let k = 1.0;

  for (let i = 0; i < 50; i++) {
    k = (low + high) / 2;
    const sum = rawList.reduce((acc, p) => acc + Math.pow(p, k), 0);
    if (Math.abs(sum - 1.0) < 1e-6) break;
    if (sum > 1.0) {
      low = k;
    } else {
      high = k;
    }
  }

  if (isThreeWay) {
    return {
      home: Math.pow(1 / odds.home, k),
      draw: Math.pow(1 / odds.draw, k),
      away: Math.pow(1 / odds.away, k),
      overround,
      marginPercent: (overround - 1) * 100
    };
  }

  return {
    home: Math.pow(1 / odds.home, k),
    away: Math.pow(1 / odds.away, k),
    overround,
    marginPercent: (overround - 1) * 100
  };
}
