import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getFootballMatches = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("football_matches").order("desc").collect();
  },
});

export const getBasketballFixtures = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("basketball_fixtures").order("desc").collect();
  },
});

export const getFootballById = query({
  args: { fixtureId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("football_matches")
      .withIndex("by_fixture", (q) => q.eq("fixtureId", args.fixtureId))
      .first();
  },
});

export const getBasketballById = query({
  args: { fixtureId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("basketball_fixtures")
      .withIndex("by_fixture", (q) => q.eq("fixtureId", args.fixtureId))
      .first();
  },
});

export const seedInitialData = mutation({
  args: {},
  handler: async (ctx) => {
    const existingFootball = await ctx.db.query("football_matches").first();
    if (!existingFootball) {
      await ctx.db.insert("football_matches", {
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
      });

      await ctx.db.insert("football_matches", {
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
      });
    }

    const existingBasketball = await ctx.db.query("basketball_fixtures").first();
    if (!existingBasketball) {
      await ctx.db.insert("basketball_fixtures", {
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
        lineupAlert: "Miami Heat starting frontcourt rotation adjusted; defensive paint points allowed +4.2/game",
      });

      await ctx.db.insert("basketball_fixtures", {
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
      });
    }

    return { success: true };
  },
});
