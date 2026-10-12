/**
 * Dixon-Coles & Bivariate Poisson Football Modeling Engine
 * Translates match goal expectancies (lambda_home, mu_away) into full probability distributions.
 */

function factorial(n) {
  if (n <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

function poisson(k, lambda) {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

/**
 * Dixon-Coles bivariate adjustment factor tau(x, y, rho)
 * Accounts for score correlation at low goal counts.
 */
function dixonColesTau(x, y, lambda, mu, rho = -0.05) {
  if (x === 0 && y === 0) return 1 - (lambda * mu * rho);
  if (x === 0 && y === 1) return 1 + (lambda * rho);
  if (x === 1 && y === 0) return 1 + (mu * rho);
  if (x === 1 && y === 1) return 1 - rho;
  return 1.0;
}

/**
 * Generates exact score probability matrix (up to maxGoals x maxGoals)
 */
export function generateScoreMatrix(lambdaHome, muAway, rho = -0.05, maxGoals = 8) {
  const matrix = [];
  let homeWinProb = 0;
  let drawProb = 0;
  let awayWinProb = 0;

  let bttsYesProb = 0;
  let bttsNoProb = 0;

  const overUnder = {
    0.5: { over: 0, under: 0 },
    1.5: { over: 0, under: 0 },
    2.5: { over: 0, under: 0 },
    3.5: { over: 0, under: 0 },
    4.5: { over: 0, under: 0 },
  };

  const scoreRankings = [];

  for (let x = 0; x <= maxGoals; x++) {
    matrix[x] = [];
    const pX = poisson(x, lambdaHome);
    for (let y = 0; y <= maxGoals; y++) {
      const pY = poisson(y, muAway);
      const tau = dixonColesTau(x, y, lambdaHome, muAway, rho);
      const prob = pX * pY * tau;
      matrix[x][y] = prob;

      // 1X2
      if (x > y) homeWinProb += prob;
      else if (x === y) drawProb += prob;
      else awayWinProb += prob;

      // BTTS
      if (x > 0 && y > 0) bttsYesProb += prob;
      else bttsNoProb += prob;

      // Over / Under
      const totalGoals = x + y;
      for (const line of Object.keys(overUnder)) {
        const threshold = parseFloat(line);
        if (totalGoals > threshold) overUnder[threshold].over += prob;
        else overUnder[threshold].under += prob;
      }

      scoreRankings.push({ home: x, away: y, prob });
    }
  }

  // Sort score rankings descending by probability
  scoreRankings.sort((a, b) => b.prob - a.prob);

  return {
    lambdaHome,
    muAway,
    expectedTotalGoals: lambdaHome + muAway,
    expectedGoalDifference: lambdaHome - muAway,
    probabilities: {
      oneXTwo: {
        home: homeWinProb,
        draw: drawProb,
        away: awayWinProb,
        fairOdds: {
          home: 1 / homeWinProb,
          draw: 1 / drawProb,
          away: 1 / awayWinProb
        }
      },
      btts: {
        yes: bttsYesProb,
        no: bttsNoProb,
        fairOdds: {
          yes: 1 / bttsYesProb,
          no: 1 / bttsNoProb
        }
      },
      overUnder: {
        0.5: { ...overUnder[0.5], fairOddsOver: 1 / overUnder[0.5].over, fairOddsUnder: 1 / overUnder[0.5].under },
        1.5: { ...overUnder[1.5], fairOddsOver: 1 / overUnder[1.5].over, fairOddsUnder: 1 / overUnder[1.5].under },
        2.5: { ...overUnder[2.5], fairOddsOver: 1 / overUnder[2.5].over, fairOddsUnder: 1 / overUnder[2.5].under },
        3.5: { ...overUnder[3.5], fairOddsOver: 1 / overUnder[3.5].over, fairOddsUnder: 1 / overUnder[3.5].under },
        4.5: { ...overUnder[4.5], fairOddsOver: 1 / overUnder[4.5].over, fairOddsUnder: 1 / overUnder[4.5].under }
      },
      topPredictedScores: scoreRankings.slice(0, 5)
    }
  };
}

/**
 * Inverts market consensus odds (Total Goals and Handicap) into expected goal parameters lambda and mu
 */
export function solveGoalParametersFromMarket(expectedTotal, expectedSpread) {
  // Total = lambda + mu, Spread = lambda - mu
  const lambda = (expectedTotal + expectedSpread) / 2;
  const mu = (expectedTotal - expectedSpread) / 2;
  return {
    lambdaHome: Math.max(0.1, lambda),
    muAway: Math.max(0.1, mu)
  };
}
