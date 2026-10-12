import { ConvexClient } from "convex/browser";

const convexUrl = import.meta.env.VITE_CONVEX_URL || "https://placeholder.convex.cloud";

export const convexClient = new ConvexClient(convexUrl);

export interface FootballMatch {
  _id?: string;
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  kickoffTime: string;
  status: string;
  expectedGoals: { homeLambda: number; awayMu: number };
  probabilities: {
    homeWin: number;
    draw: number;
    awayWin: number;
    over25: number;
    under25: number;
    bttsYes: number;
    bttsNo: number;
  };
  topScorelines: Array<{ home: number; away: number; prob: number }>;
  odds: {
    sportybet: { home: number; draw: number; away: number; over25: number; under25: number };
    oneXbet: { home: number; draw: number; away: number; over25: number; under25: number };
    twentyTwoBet: { home: number; draw: number; away: number; over25: number; under25: number };
  };
  bestValue: {
    market: string;
    selection: string;
    bestOdds: number;
    bookmaker: string;
    fairOdds: number;
    edgePercent: number;
    kellyStakePercent: number;
    grade: string;
  };
  marketSteamAlert: boolean;
  lineupAlert: string;
}

export interface BasketballFixture {
  _id?: string;
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  kickoffTime: string;
  status: string;
  paceMetrics: {
    possessionsPer48: number;
    homeOffRating: number;
    awayOffRating: number;
    homeDefRating: number;
    awayDefRating: number;
  };
  projectedScore: {
    home: number;
    away: number;
    total: number;
  };
  probabilities: {
    homeWin: number;
    awayWin: number;
    spreadCoverHome: number;
    overTotal: number;
    underTotal: number;
  };
  odds: {
    sportybet: {
      homeMoneyline: number;
      awayMoneyline: number;
      spreadLine: number;
      homeSpreadOdds: number;
      totalLine: number;
      overOdds: number;
      underOdds: number;
    };
    oneXbet: {
      homeMoneyline: number;
      awayMoneyline: number;
      spreadLine: number;
      homeSpreadOdds: number;
      totalLine: number;
      overOdds: number;
      underOdds: number;
    };
    twentyTwoBet: {
      homeMoneyline: number;
      awayMoneyline: number;
      spreadLine: number;
      homeSpreadOdds: number;
      totalLine: number;
      overOdds: number;
      underOdds: number;
    };
  };
  bestValue: {
    market: string;
    selection: string;
    bestOdds: number;
    bookmaker: string;
    fairOdds: number;
    edgePercent: number;
    kellyStakePercent: number;
    grade: string;
  };
  marketSteamAlert: boolean;
  lineupAlert: string;
}

// Default initial data for zero-latency local fallback & offline PWA
export const FALLBACK_FOOTBALL: FootballMatch[] = [
  {
    fixtureId: "fb_arsenal_chelsea_01",
    homeTeam: "Arsenal FC",
    awayTeam: "Chelsea FC",
    league: "English Premier League",
    kickoffTime: "Today, 19:45 GMT",
    status: "scheduled",
    expectedGoals: { homeLambda: 1.84, awayMu: 1.12 },
    probabilities: {
      homeWin: 0.528,
      draw: 0.244,
      awayWin: 0.228,
      over25: 0.562,
      under25: 0.438,
      bttsYes: 0.548,
      bttsNo: 0.452,
    },
    topScorelines: [
      { home: 2, away: 1, prob: 0.114 },
      { home: 1, away: 1, prob: 0.108 },
      { home: 1, away: 0, prob: 0.098 },
      { home: 2, away: 0, prob: 0.088 },
      { home: 3, away: 1, prob: 0.071 },
    ],
    odds: {
      sportybet: { home: 1.95, draw: 3.65, away: 3.90, over25: 1.74, under25: 2.10 },
      oneXbet: { home: 2.02, draw: 3.75, away: 4.10, over25: 1.80, under25: 2.08 },
      twentyTwoBet: { home: 2.01, draw: 3.72, away: 4.08, over25: 1.79, under25: 2.09 },
    },
    bestValue: {
      market: "Match Winner (1X2)",
      selection: "Arsenal Win",
      bestOdds: 2.02,
      bookmaker: "1xBet",
      fairOdds: 1.89,
      edgePercent: 6.87,
      kellyStakePercent: 3.36,
      grade: "A+",
    },
    marketSteamAlert: true,
    lineupAlert: "Chelsea playmaker Palmer doubtful with ankle fatigue (-12% expected away chance creation)",
  },
  {
    fixtureId: "fb_realmadrid_barcelona_02",
    homeTeam: "Real Madrid",
    awayTeam: "FC Barcelona",
    league: "La Liga (El Clásico)",
    kickoffTime: "Tomorrow, 20:00 GMT",
    status: "scheduled",
    expectedGoals: { homeLambda: 1.95, awayMu: 1.55 },
    probabilities: {
      homeWin: 0.458,
      draw: 0.239,
      awayWin: 0.303,
      over25: 0.648,
      under25: 0.352,
      bttsYes: 0.635,
      bttsNo: 0.365,
    },
    topScorelines: [
      { home: 2, away: 1, prob: 0.098 },
      { home: 2, away: 2, prob: 0.092 },
      { home: 3, away: 1, prob: 0.078 },
      { home: 1, away: 2, prob: 0.072 },
      { home: 3, away: 2, prob: 0.065 },
    ],
    odds: {
      sportybet: { home: 2.10, draw: 3.75, away: 3.25, over25: 1.58, under25: 2.38 },
      oneXbet: { home: 2.18, draw: 3.85, away: 3.35, over25: 1.62, under25: 2.42 },
      twentyTwoBet: { home: 2.17, draw: 3.82, away: 3.34, over25: 1.61, under25: 2.40 },
    },
    bestValue: {
      market: "Total Goals",
      selection: "Over 2.5 Goals",
      bestOdds: 1.62,
      bookmaker: "1xBet",
      fairOdds: 1.54,
      edgePercent: 5.19,
      kellyStakePercent: 4.12,
      grade: "A",
    },
    marketSteamAlert: false,
    lineupAlert: "Full attacking strength confirmed across both rosters",
  },
  {
    fixtureId: "fb_bayern_dortmund_03",
    homeTeam: "Bayern Munich",
    awayTeam: "Borussia Dortmund",
    league: "Bundesliga",
    kickoffTime: "Saturday, 17:30 GMT",
    status: "scheduled",
    expectedGoals: { homeLambda: 2.35, awayMu: 1.15 },
    probabilities: {
      homeWin: 0.645,
      draw: 0.198,
      awayWin: 0.157,
      over25: 0.712,
      under25: 0.288,
      bttsYes: 0.584,
      bttsNo: 0.416,
    },
    topScorelines: [
      { home: 2, away: 1, prob: 0.125 },
      { home: 3, away: 1, prob: 0.102 },
      { home: 2, away: 0, prob: 0.096 },
      { home: 3, away: 0, prob: 0.078 },
    ],
    odds: {
      sportybet: { home: 1.48, draw: 4.80, away: 6.10, over25: 1.40, under25: 2.90 },
      oneXbet: { home: 1.55, draw: 5.00, away: 6.40, over25: 1.44, under25: 2.85 },
      twentyTwoBet: { home: 1.54, draw: 4.95, away: 6.35, over25: 1.43, under25: 2.88 },
    },
    bestValue: {
      market: "Match Winner (1X2)",
      selection: "Bayern Munich Win",
      bestOdds: 1.55,
      bookmaker: "1xBet",
      fairOdds: 1.55,
      edgePercent: 0.0,
      kellyStakePercent: 1.5,
      grade: "B",
    },
    marketSteamAlert: false,
    lineupAlert: "Bayern starting XI confirmed; high attacking momentum",
  },
];

export const FALLBACK_BASKETBALL: BasketballFixture[] = [
  {
    fixtureId: "bb_boston_miami_01",
    homeTeam: "Boston Celtics",
    awayTeam: "Miami Heat",
    league: "NBA",
    kickoffTime: "Tonight, 00:30 GMT",
    status: "scheduled",
    paceMetrics: {
      possessionsPer48: 98.4,
      homeOffRating: 118.2,
      awayOffRating: 111.4,
      homeDefRating: 108.5,
      awayDefRating: 112.8,
    },
    projectedScore: {
      home: 114.8,
      away: 106.2,
      total: 221.0,
    },
    probabilities: {
      homeWin: 0.732,
      awayWin: 0.268,
      spreadCoverHome: 0.548,
      overTotal: 0.529,
      underTotal: 0.471,
    },
    odds: {
      sportybet: {
        homeMoneyline: 1.34,
        awayMoneyline: 3.45,
        spreadLine: -7.5,
        homeSpreadOdds: 1.88,
        totalLine: 219.5,
        overOdds: 1.89,
        underOdds: 1.91,
      },
      oneXbet: {
        homeMoneyline: 1.38,
        awayMoneyline: 3.65,
        spreadLine: -7.5,
        homeSpreadOdds: 1.94,
        totalLine: 219.5,
        overOdds: 1.93,
        underOdds: 1.93,
      },
      twentyTwoBet: {
        homeMoneyline: 1.37,
        awayMoneyline: 3.62,
        spreadLine: -7.5,
        homeSpreadOdds: 1.93,
        totalLine: 219.5,
        overOdds: 1.92,
        underOdds: 1.93,
      },
    },
    bestValue: {
      market: "Point Spread (-7.5)",
      selection: "Boston Celtics -7.5",
      bestOdds: 1.94,
      bookmaker: "1xBet",
      fairOdds: 1.82,
      edgePercent: 6.31,
      kellyStakePercent: 3.35,
      grade: "A+",
    },
    marketSteamAlert: true,
    lineupAlert: "Miami starting frontcourt altered; conceded paint points +4.2/game",
  },
  {
    fixtureId: "bb_lakers_warriors_02",
    homeTeam: "Los Angeles Lakers",
    awayTeam: "Golden State Warriors",
    league: "NBA",
    kickoffTime: "Tonight, 03:00 GMT",
    status: "scheduled",
    paceMetrics: {
      possessionsPer48: 101.8,
      homeOffRating: 114.6,
      awayOffRating: 115.1,
      homeDefRating: 113.2,
      awayDefRating: 114.0,
    },
    projectedScore: {
      home: 116.4,
      away: 115.8,
      total: 232.2,
    },
    probabilities: {
      homeWin: 0.514,
      awayWin: 0.486,
      spreadCoverHome: 0.505,
      overTotal: 0.572,
      underTotal: 0.428,
    },
    odds: {
      sportybet: {
        homeMoneyline: 1.92,
        awayMoneyline: 1.92,
        spreadLine: -1.5,
        homeSpreadOdds: 1.90,
        totalLine: 228.5,
        overOdds: 1.86,
        underOdds: 1.94,
      },
      oneXbet: {
        homeMoneyline: 1.97,
        awayMoneyline: 1.97,
        spreadLine: -1.5,
        homeSpreadOdds: 1.95,
        totalLine: 228.5,
        overOdds: 1.90,
        underOdds: 1.96,
      },
      twentyTwoBet: {
        homeMoneyline: 1.96,
        awayMoneyline: 1.96,
        spreadLine: -1.5,
        homeSpreadOdds: 1.94,
        totalLine: 228.5,
        overOdds: 1.89,
        underOdds: 1.95,
      },
    },
    bestValue: {
      market: "Total Game Points",
      selection: "Over 228.5 Points",
      bestOdds: 1.90,
      bookmaker: "1xBet",
      fairOdds: 1.75,
      edgePercent: 8.68,
      kellyStakePercent: 4.82,
      grade: "A+",
    },
    marketSteamAlert: true,
    lineupAlert: "Fast tempo transition expected; both squads healthy with primary shooters starting",
  },
  {
    fixtureId: "bb_panathinaikos_olympiacos_03",
    homeTeam: "Panathinaikos BC",
    awayTeam: "Olympiacos BC",
    league: "EuroLeague",
    kickoffTime: "Thursday, 19:15 GMT",
    status: "scheduled",
    paceMetrics: {
      possessionsPer48: 84.5,
      homeOffRating: 112.1,
      awayOffRating: 110.8,
      homeDefRating: 106.4,
      awayDefRating: 107.0,
    },
    projectedScore: {
      home: 78.6,
      away: 76.2,
      total: 154.8,
    },
    probabilities: {
      homeWin: 0.582,
      awayWin: 0.418,
      spreadCoverHome: 0.522,
      overTotal: 0.485,
      underTotal: 0.515,
    },
    odds: {
      sportybet: {
        homeMoneyline: 1.68,
        awayMoneyline: 2.25,
        spreadLine: -2.5,
        homeSpreadOdds: 1.88,
        totalLine: 155.5,
        overOdds: 1.90,
        underOdds: 1.90,
      },
      oneXbet: {
        homeMoneyline: 1.74,
        awayMoneyline: 2.34,
        spreadLine: -2.5,
        homeSpreadOdds: 1.93,
        totalLine: 155.5,
        overOdds: 1.93,
        underOdds: 1.93,
      },
      twentyTwoBet: {
        homeMoneyline: 1.73,
        awayMoneyline: 2.32,
        spreadLine: -2.5,
        homeSpreadOdds: 1.92,
        totalLine: 155.5,
        overOdds: 1.92,
        underOdds: 1.93,
      },
    },
    bestValue: {
      market: "Total Points",
      selection: "Under 155.5 Points",
      bestOdds: 1.93,
      bookmaker: "1xBet",
      fairOdds: 1.88,
      edgePercent: 2.65,
      kellyStakePercent: 1.45,
      grade: "A",
    },
    marketSteamAlert: false,
    lineupAlert: "Defensive half-court pace; high foul pressure expected",
  },
];
