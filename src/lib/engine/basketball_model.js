/**
 * Tempo-free basketball model.
 *
 * Projects pace and per-possession efficiency into a bivariate-normal score
 * distribution. Market probabilities are computed analytically (exact and
 * deterministic for any line); a seeded Monte Carlo is available for the
 * simulation histogram shown in the UI.
 */

import { normalCdf, mulberry32, gaussian, hashString, fairOdds, round } from './math.js';
import { normalOutcomes } from './outcomes.js';

/**
 * @typedef {{ pace: number, offRtg: number, defRtg: number }} TeamRatings
 * @typedef {{ pace: number, offRtg: number, teamSd?: number, scoreCorrelation?: number }} LeagueProfile
 */

/** League presets. EuroLeague plays 40-minute games at a slower tempo. */
export const LEAGUE_PROFILES = {
  NBA: { pace: 99.5, offRtg: 114.5, teamSd: 11.0, scoreCorrelation: 0.25 },
  EuroLeague: { pace: 72.5, offRtg: 112.0, teamSd: 9.0, scoreCorrelation: 0.22 }
};

/**
 * Core projection: expected points, margin and total plus their spread.
 * @param {TeamRatings} home
 * @param {TeamRatings} away
 * @param {LeagueProfile} [league]
 * @param {{ hcaPoints?: number, fittedProjection?: { home:number,away:number,marginSd:number,totalSd:number } }} [options]
 */
export function projectScores(home, away, league = LEAGUE_PROFILES.NBA, options = {}) {
  if(options.fittedProjection){const f=options.fittedProjection;return {expectedPace:league.pace,home:f.home,away:f.away,total:f.home+f.away,margin:f.home-f.away,teamSd:Math.sqrt((f.marginSd**2+f.totalSd**2)/4),marginSd:f.marginSd,totalSd:f.totalSd};}
  const hca = options.hcaPoints ?? 2.8;
  const expectedPace = (home.pace * away.pace) / league.pace;

  const homeAdjOff = (home.offRtg * away.defRtg) / league.offRtg;
  const awayAdjOff = (away.offRtg * home.defRtg) / league.offRtg;

  const homePts = expectedPace * (homeAdjOff / 100) + hca / 2;
  const awayPts = expectedPace * (awayAdjOff / 100) - hca / 2;

  // Scoring variance grows with possessions (√pace scaling).
  const sd = (league.teamSd ?? 11) * Math.sqrt(expectedPace / league.pace);
  const corr = league.scoreCorrelation ?? 0.25;

  return {
    expectedPace,
    home: homePts,
    away: awayPts,
    total: homePts + awayPts,
    margin: homePts - awayPts,
    teamSd: sd,
    marginSd: Math.sqrt(2 * sd * sd * (1 - corr)),
    totalSd: Math.sqrt(2 * sd * sd * (1 + corr))
  };
}

/**
 * P(total > line), analytic.
 * @param {ReturnType<typeof projectScores>} proj
 * @param {number} line
 */
export function probabilityOver(proj, line) {
  return normalOutcomes(proj.total,proj.totalSd,line).conditional;
}

/**
 * P(home covers) for a home handicap, e.g. −7.5 means home must win by 8+.
 * @param {ReturnType<typeof projectScores>} proj
 * @param {number} homeLine
 */
export function probabilityHomeCovers(proj, homeLine) {
  return normalOutcomes(proj.margin,proj.marginSd,-homeLine).conditional;
}

/**
 * Seeded Monte Carlo of the joint score distribution.
 * Returns a margin histogram plus empirical win rate — reproducible per seed.
 * @param {ReturnType<typeof projectScores>} proj
 * @param {{ simulations?: number, seed?: number, binWidth?: number }} [options]
 */
export function simulateGame(proj, options = {}) {
  const sims = options.simulations ?? 10000;
  const rand = mulberry32(options.seed ?? 42);
  const binWidth = options.binWidth ?? 3;
  const corr = 1 - (proj.marginSd ** 2) / (2 * proj.teamSd ** 2);
  const sqrtComp = Math.sqrt(Math.max(0, 1 - corr * corr));

  /** @type {Map<number, number>} */
  const bins = new Map();
  let homeWins = 0;
  let totalSum = 0;
  for (let i = 0; i < sims; i++) {
    const z1 = gaussian(rand);
    const z2 = corr * z1 + sqrtComp * gaussian(rand);
    const h = proj.home + proj.teamSd * z1;
    const a = proj.away + proj.teamSd * z2;
    if (h > a) homeWins++;
    totalSum += h + a;
    const bin = Math.floor((h - a) / binWidth) * binWidth;
    bins.set(bin, (bins.get(bin) ?? 0) + 1);
  }

  const histogram = [...bins.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([from, count]) => ({ from, to: from + binWidth, share: count / sims }));

  return { simulations: sims, homeWinRate: homeWins / sims, meanTotal: totalSum / sims, histogram };
}

/**
 * Backwards-compatible full projection used by the CLI, tests and UI.
 *
 * @param {TeamRatings} home
 * @param {TeamRatings} away
 * @param {LeagueProfile} [leagueAverages]
 * @param {{ fittedProjection?: {home:number,away:number,marginSd:number,totalSd:number}, hcaPoints?: number, simulations?: number, seed?: number,
 *           totalLines?: number[], spreadLines?: number[] }} [options]
 */
export function projectBasketballGame(home, away, leagueAverages = LEAGUE_PROFILES.NBA, options = {}) {
  const proj = projectScores(home, away, leagueAverages, options);
  const pHome = probabilityHomeCovers(proj, 0);

  const totalLines = options.totalLines ?? [proj.total - 5, proj.total, proj.total + 5].map((l) => Math.round(l) + 0.5);
  const spreadLines = options.spreadLines ?? [-3.5, -5.5, -7.5];

  /** @type {Record<string, { overProb: number, underProb: number, fairOverOdds: number, fairUnderOdds: number }>} */
  const overUnderDistributions = {};
  for (const line of totalLines) {
    const over = probabilityOver(proj, line);
    overUnderDistributions[line.toFixed(1)] = {
      overProb: over,
      underProb: 1 - over,
      fairOverOdds: fairOdds(over),
      fairUnderOdds: fairOdds(1 - over)
    };
  }

  /** @type {Record<string, number>} */
  const spreadCoverage = {};
  for (const line of spreadLines) spreadCoverage[line.toFixed(1)] = probabilityHomeCovers(proj, line);

  const seed = options.seed ?? hashString(`${home.offRtg}:${away.offRtg}:${home.pace}:${away.pace}`);
  const simulation = simulateGame(proj, { simulations: options.simulations ?? 10000, seed });

  return {
    expectedPace: round(proj.expectedPace, 1),
    projectedScore: {
      home: round(proj.home, 1),
      away: round(proj.away, 1),
      total: round(proj.total, 1),
      spread: round(proj.margin, 1)
    },
    dispersion: { marginSd: round(proj.marginSd, 2), totalSd: round(proj.totalSd, 2) },
    winProbabilities: {
      home: pHome,
      away: 1 - pHome,
      fairOdds: { home: fairOdds(pHome), away: fairOdds(1 - pHome) }
    },
    overUnderDistributions,
    spreadCoverage,
    simulation,
    projection: proj
  };
}
