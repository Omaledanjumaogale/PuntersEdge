/**
 * Basketball Team Performance & Tempo-Free Modeling Engine
 * Reverse engineered from Matchplay.com Basketball Team Performance Interface (sr:sport:2).
 */

/**
 * Standard normal random variable generator (Box-Muller transform)
 */
function randomNormal(mean = 0, stdDev = 1) {
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

/**
 * Simulates and projects basketball game outcome based on team performance metrics.
 * 
 * @param {Object} home Team performance stats
 * @param {Object} away Team performance stats
 * @param {Object} leagueAverages
 * @param {Object} options
 */
export function projectBasketballGame(home, away, leagueAverages = { pace: 100.0, offRtg: 114.0 }, options = {}) {
  const hcaPoints = options?.hcaPoints ?? 2.8;
  const sims = options?.simulations ?? 25000;

  // 1. Calculate Expected Game Pace (Possessions per 48 mins)
  const expectedPace = (home.pace * away.pace) / leagueAverages.pace;

  // 2. Calculate Efficiency Ratings
  // Home Offensive Rating adjusted for Away Defensive Rating
  const homeAdjOffRtg = (home.offRtg * away.defRtg) / leagueAverages.offRtg;
  // Away Offensive Rating adjusted for Home Defensive Rating
  const awayAdjOffRtg = (away.offRtg * home.defRtg) / leagueAverages.offRtg;

  // 3. Expected Points before variance
  const homeBasePoints = expectedPace * (homeAdjOffRtg / 100) + (hcaPoints / 2);
  const awayBasePoints = expectedPace * (awayAdjOffRtg / 100) - (hcaPoints / 2);

  const projectedTotal = homeBasePoints + awayBasePoints;
  const projectedSpread = homeBasePoints - awayBasePoints; // Positive means Home favored

  // 4. Monte Carlo Simulation for Distribution & Betting Lines
  const stdDevTeam = 11.2; // Typical NBA single-game points standard deviation

  let homeWins = 0;
  let awayWins = 0;

  // Standard bookmaker lines tracking
  const linesToEvaluate = [
    projectedTotal - 5,
    projectedTotal,
    projectedTotal + 5
  ];

  const totalProbabilities = {};
  for (const line of linesToEvaluate) {
    totalProbabilities[line.toFixed(1)] = { over: 0, under: 0 };
  }

  const spreadProbabilities = {
    coverHomeMinus3_5: 0,
    coverHomeMinus5_5: 0,
    coverHomeMinus7_5: 0,
  };

  for (let i = 0; i < sims; i++) {
    const simHome = randomNormal(homeBasePoints, stdDevTeam);
    const simAway = randomNormal(awayBasePoints, stdDevTeam);

    if (simHome > simAway) homeWins++;
    else awayWins++;

    const simTotal = simHome + simAway;
    for (const line of linesToEvaluate) {
      if (simTotal > line) totalProbabilities[line.toFixed(1)].over++;
      else totalProbabilities[line.toFixed(1)].under++;
    }

    const simDiff = simHome - simAway;
    if (simDiff > 3.5) spreadProbabilities.coverHomeMinus3_5++;
    if (simDiff > 5.5) spreadProbabilities.coverHomeMinus5_5++;
    if (simDiff > 7.5) spreadProbabilities.coverHomeMinus7_5++;
  }

  // Normalize simulation counts to probabilities
  const probHomeWin = homeWins / sims;
  const probAwayWin = awayWins / sims;

  for (const line of Object.keys(totalProbabilities)) {
    totalProbabilities[line].overProb = totalProbabilities[line].over / sims;
    totalProbabilities[line].underProb = totalProbabilities[line].under / sims;
    totalProbabilities[line].fairOverOdds = 1 / totalProbabilities[line].overProb;
    totalProbabilities[line].fairUnderOdds = 1 / totalProbabilities[line].underProb;
  }

  return {
    expectedPace: Math.round(expectedPace * 10) / 10,
    projectedScore: {
      home: Math.round(homeBasePoints * 10) / 10,
      away: Math.round(awayBasePoints * 10) / 10,
      total: Math.round(projectedTotal * 10) / 10,
      spread: Math.round(projectedSpread * 10) / 10
    },
    winProbabilities: {
      home: probHomeWin,
      away: probAwayWin,
      fairOdds: {
        home: 1 / probHomeWin,
        away: 1 / probAwayWin
      }
    },
    overUnderDistributions: totalProbabilities,
    spreadCoverage: {
      coverHomeMinus3_5: spreadProbabilities.coverHomeMinus3_5 / sims,
      coverHomeMinus5_5: spreadProbabilities.coverHomeMinus5_5 / sims,
      coverHomeMinus7_5: spreadProbabilities.coverHomeMinus7_5 / sims,
    }
  };
}
