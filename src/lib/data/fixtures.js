/**
 * Sample market feed.
 *
 * Raw inputs only — team ratings, availability and bookmaker prices. All
 * probabilities, fair prices, edges and stakes are derived by the prediction
 * pipeline at runtime. Kickoffs are offsets from "now" so the demo feed never
 * goes stale; a live Convex deployment replaces this feed when configured.
 */

/** @type {import('../engine/prediction_pipeline.js').FootballInput[]} */
export const FOOTBALL_INPUTS = [
  {
    fixtureId: 'fb_arsenal_chelsea',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    league: 'Premier League',
    kickoffOffsetHours: 5,
    ratings: { lambdaHome: 1.82, muAway: 1.08, rho: -0.08 },
    absences: {
      home: [],
      away: [{ name: 'C. Palmer', position: 'MID', impactRating: 0.11, minutesWeight: 1 }]
    },
    odds: {
      SportyBet: { home: 1.95, draw: 3.65, away: 3.9, over25: 1.74, under25: 2.1, bttsYes: 1.72, bttsNo: 2.08 },
      '1xBet': { home: 2.04, draw: 3.55, away: 3.85, over25: 1.8, under25: 2.02, bttsYes: 1.76, bttsNo: 2.04 },
      '22Bet': { home: 2.01, draw: 3.55, away: 3.9, over25: 1.79, under25: 2.09, bttsYes: 1.75, bttsNo: 2.09 }
    },
    openingOdds: { home: 2.18, away: 3.6 },
    publicPct: { home: 41 }
  },
  {
    fixtureId: 'fb_realmadrid_barcelona',
    homeTeam: 'Real Madrid',
    awayTeam: 'Barcelona',
    league: 'La Liga',
    kickoffOffsetHours: 27,
    ratings: { lambdaHome: 1.92, muAway: 1.58, rho: -0.04 },
    absences: { home: [], away: [] },
    odds: {
      SportyBet: { home: 2.1, draw: 3.75, away: 3.25, over25: 1.58, under25: 2.38, bttsYes: 1.55, bttsNo: 2.4 },
      '1xBet': { home: 2.18, draw: 3.7, away: 3.3, over25: 1.64, under25: 2.42, bttsYes: 1.6, bttsNo: 2.45 },
      '22Bet': { home: 2.17, draw: 3.7, away: 3.3, over25: 1.63, under25: 2.4, bttsYes: 1.59, bttsNo: 2.43 }
    },
    openingOdds: { home: 2.2, away: 3.3 },
    publicPct: { home: 55 }
  },
  {
    fixtureId: 'fb_bayern_dortmund',
    homeTeam: 'Bayern Munich',
    awayTeam: 'Borussia Dortmund',
    league: 'Bundesliga',
    kickoffOffsetHours: 50,
    ratings: { lambdaHome: 2.38, muAway: 1.12, rho: -0.05 },
    absences: {
      home: [{ name: 'J. Musiala', position: 'MID', impactRating: 0.09, minutesWeight: 1 }],
      away: [
        { name: 'N. Schlotterbeck', position: 'DEF', impactRating: 0.07, minutesWeight: 1 },
        { name: 'G. Kobel', position: 'GK', impactRating: 0.06, minutesWeight: 1 }
      ]
    },
    odds: {
      SportyBet: { home: 1.48, draw: 4.8, away: 6.1, over25: 1.4, under25: 2.9, bttsYes: 1.66, bttsNo: 2.15 },
      '1xBet': { home: 1.55, draw: 4.6, away: 5.8, over25: 1.44, under25: 2.85, bttsYes: 1.7, bttsNo: 2.18 },
      '22Bet': { home: 1.54, draw: 4.6, away: 5.9, over25: 1.43, under25: 2.88, bttsYes: 1.69, bttsNo: 2.17 }
    },
    openingOdds: { home: 1.52, away: 6.0 },
    publicPct: { home: 71 }
  },
  {
    fixtureId: 'fb_inter_napoli',
    homeTeam: 'Inter',
    awayTeam: 'Napoli',
    league: 'Serie A',
    kickoffOffsetHours: 74,
    ratings: { lambdaHome: 1.46, muAway: 1.02, rho: -0.11 },
    absences: { home: [{ name: 'L. Martínez', position: 'FWD', impactRating: 0.1, minutesWeight: 0.8 }], away: [] },
    odds: {
      SportyBet: { home: 2.05, draw: 3.2, away: 3.85, over25: 2.15, under25: 1.68, bttsYes: 2.0, bttsNo: 1.75 },
      '1xBet': { home: 2.12, draw: 3.3, away: 3.95, over25: 2.2, under25: 1.72, bttsYes: 2.05, bttsNo: 1.8 },
      '22Bet': { home: 2.1, draw: 3.28, away: 3.92, over25: 2.18, under25: 1.73, bttsYes: 2.04, bttsNo: 1.79 }
    },
    openingOdds: { home: 1.98, away: 4.0 },
    publicPct: { home: 68 }
  },
  {
    fixtureId: 'fb_enyimba_rangers',
    homeTeam: 'Enyimba',
    awayTeam: 'Rangers International',
    league: 'NPFL',
    kickoffOffsetHours: 30,
    ratings: { lambdaHome: 1.38, muAway: 0.72, rho: -0.12 },
    absences: { home: [], away: [] },
    odds: {
      SportyBet: { home: 1.85, draw: 3.1, away: 4.6, over25: 2.55, under25: 1.48, bttsYes: 2.3, bttsNo: 1.55 },
      '1xBet': { home: 1.92, draw: 3.15, away: 4.75, over25: 2.6, under25: 1.5, bttsYes: 2.35, bttsNo: 1.58 },
      '22Bet': { home: 1.9, draw: 3.12, away: 4.7, over25: 2.58, under25: 1.49, bttsYes: 2.32, bttsNo: 1.57 }
    },
    openingOdds: { home: 1.88, away: 4.5 },
    publicPct: { home: 62 }
  }
];

/** @type {import('../engine/prediction_pipeline.js').BasketballInput[]} */
export const BASKETBALL_INPUTS = [
  {
    fixtureId: 'bb_celtics_heat',
    homeTeam: 'Boston Celtics',
    awayTeam: 'Miami Heat',
    league: 'NBA',
    kickoffOffsetHours: 9,
    ratings: {
      home: { pace: 99.6, offRtg: 117.4, defRtg: 110.6 },
      away: { pace: 98.8, offRtg: 113.6, defRtg: 113.1 }
    },
    absences: [{ name: 'B. Adebayo', team: 'away', netRtgImpact: 2.1 }],
    odds: {
      SportyBet: { homeMoneyline: 1.3, awayMoneyline: 3.6, spreadLine: -8.5, homeSpreadOdds: 1.88, awaySpreadOdds: 1.9, totalLine: 219.5, overOdds: 1.89, underOdds: 1.89 },
      '1xBet': { homeMoneyline: 1.33, awayMoneyline: 3.45, spreadLine: -8.5, homeSpreadOdds: 1.94, awaySpreadOdds: 1.9, totalLine: 219.5, overOdds: 1.93, underOdds: 1.91 },
      '22Bet': { homeMoneyline: 1.32, awayMoneyline: 3.7, spreadLine: -8.5, homeSpreadOdds: 1.93, awaySpreadOdds: 1.89, totalLine: 219.5, overOdds: 1.92, underOdds: 1.9 }
    },
    openingOdds: { home: 1.4, away: 3.1 },
    publicPct: { home: 44 }
  },
  {
    fixtureId: 'bb_lakers_warriors',
    homeTeam: 'Los Angeles Lakers',
    awayTeam: 'Golden State Warriors',
    league: 'NBA',
    kickoffOffsetHours: 12,
    ratings: {
      home: { pace: 99.8, offRtg: 115.3, defRtg: 114.4 },
      away: { pace: 100.4, offRtg: 114.9, defRtg: 114.1 }
    },
    absences: [],
    odds: {
      SportyBet: { homeMoneyline: 1.92, awayMoneyline: 1.92, spreadLine: -1.5, homeSpreadOdds: 1.9, awaySpreadOdds: 1.9, totalLine: 229.5, overOdds: 1.86, underOdds: 1.94 },
      '1xBet': { homeMoneyline: 1.95, awayMoneyline: 1.93, spreadLine: -1.5, homeSpreadOdds: 1.95, awaySpreadOdds: 1.92, totalLine: 229.5, overOdds: 1.92, underOdds: 1.95 },
      '22Bet': { homeMoneyline: 1.96, awayMoneyline: 1.94, spreadLine: -1.5, homeSpreadOdds: 1.94, awaySpreadOdds: 1.91, totalLine: 229.5, overOdds: 1.91, underOdds: 1.95 }
    },
    openingOdds: { home: 1.9, away: 1.95 },
    publicPct: { home: 58 }
  },
  {
    fixtureId: 'bb_panathinaikos_olympiacos',
    homeTeam: 'Panathinaikos',
    awayTeam: 'Olympiacos',
    league: 'EuroLeague',
    kickoffOffsetHours: 56,
    hcaPoints: 3.4,
    ratings: {
      home: { pace: 72.9, offRtg: 113.4, defRtg: 108.6 },
      away: { pace: 72.4, offRtg: 111.9, defRtg: 108.9 }
    },
    absences: [],
    odds: {
      SportyBet: { homeMoneyline: 1.68, awayMoneyline: 2.25, spreadLine: -2.5, homeSpreadOdds: 1.88, awaySpreadOdds: 1.88, totalLine: 158.5, overOdds: 1.9, underOdds: 1.9 },
      '1xBet': { homeMoneyline: 1.72, awayMoneyline: 2.2, spreadLine: -2.5, homeSpreadOdds: 1.93, awaySpreadOdds: 1.91, totalLine: 158.5, overOdds: 1.93, underOdds: 1.93 },
      '22Bet': { homeMoneyline: 1.71, awayMoneyline: 2.2, spreadLine: -2.5, homeSpreadOdds: 1.92, awaySpreadOdds: 1.9, totalLine: 158.5, overOdds: 1.92, underOdds: 1.93 }
    },
    openingOdds: { home: 1.75, away: 2.2 },
    publicPct: { home: 60 }
  },
  {
    fixtureId: 'bb_nuggets_thunder',
    homeTeam: 'Denver Nuggets',
    awayTeam: 'Oklahoma City Thunder',
    league: 'NBA',
    kickoffOffsetHours: 33,
    ratings: {
      home: { pace: 99.2, offRtg: 117.6, defRtg: 112.2 },
      away: { pace: 100.1, offRtg: 117.0, defRtg: 109.0 }
    },
    absences: [{ name: 'J. Murray', team: 'home', netRtgImpact: 2.0 }],
    odds: {
      SportyBet: { homeMoneyline: 2.3, awayMoneyline: 1.62, spreadLine: 2.5, homeSpreadOdds: 1.88, awaySpreadOdds: 1.9, totalLine: 226.5, overOdds: 1.9, underOdds: 1.88 },
      '1xBet': { homeMoneyline: 2.38, awayMoneyline: 1.66, spreadLine: 2.5, homeSpreadOdds: 1.93, awaySpreadOdds: 1.93, totalLine: 226.5, overOdds: 1.94, underOdds: 1.92 },
      '22Bet': { homeMoneyline: 2.36, awayMoneyline: 1.65, spreadLine: 2.5, homeSpreadOdds: 1.92, awaySpreadOdds: 1.92, totalLine: 226.5, overOdds: 1.93, underOdds: 1.91 }
    },
    openingOdds: { home: 2.15, away: 1.72 },
    publicPct: { home: 63 }
  }
];
