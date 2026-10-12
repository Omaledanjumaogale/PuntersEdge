import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  football_matches: defineTable({
    fixtureId: v.string(),
    homeTeam: v.string(),
    awayTeam: v.string(),
    league: v.string(),
    kickoffTime: v.string(),
    status: v.string(),
    expectedGoals: v.object({
      homeLambda: v.number(),
      awayMu: v.number(),
    }),
    probabilities: v.object({
      homeWin: v.number(),
      draw: v.number(),
      awayWin: v.number(),
      over25: v.number(),
      under25: v.number(),
      bttsYes: v.number(),
      bttsNo: v.number(),
    }),
    topScorelines: v.array(
      v.object({
        home: v.number(),
        away: v.number(),
        prob: v.number(),
      })
    ),
    odds: v.object({
      sportybet: v.object({
        home: v.number(),
        draw: v.number(),
        away: v.number(),
        over25: v.number(),
        under25: v.number(),
      }),
      oneXbet: v.object({
        home: v.number(),
        draw: v.number(),
        away: v.number(),
        over25: v.number(),
        under25: v.number(),
      }),
      twentyTwoBet: v.object({
        home: v.number(),
        draw: v.number(),
        away: v.number(),
        over25: v.number(),
        under25: v.number(),
      }),
    }),
    bestValue: v.object({
      market: v.string(),
      selection: v.string(),
      bestOdds: v.number(),
      bookmaker: v.string(),
      fairOdds: v.number(),
      edgePercent: v.number(),
      kellyStakePercent: v.number(),
      grade: v.string(),
    }),
    marketSteamAlert: v.boolean(),
    lineupAlert: v.string(),
  })
    .index("by_fixture", ["fixtureId"])
    .index("by_league", ["league"]),

  basketball_fixtures: defineTable({
    fixtureId: v.string(),
    homeTeam: v.string(),
    awayTeam: v.string(),
    league: v.string(),
    kickoffTime: v.string(),
    status: v.string(),
    paceMetrics: v.object({
      possessionsPer48: v.number(),
      homeOffRating: v.number(),
      awayOffRating: v.number(),
      homeDefRating: v.number(),
      awayDefRating: v.number(),
    }),
    projectedScore: v.object({
      home: v.number(),
      away: v.number(),
      total: v.number(),
    }),
    probabilities: v.object({
      homeWin: v.number(),
      awayWin: v.number(),
      spreadCoverHome: v.number(),
      overTotal: v.number(),
      underTotal: v.number(),
    }),
    odds: v.object({
      sportybet: v.object({
        homeMoneyline: v.number(),
        awayMoneyline: v.number(),
        spreadLine: v.number(),
        homeSpreadOdds: v.number(),
        totalLine: v.number(),
        overOdds: v.number(),
        underOdds: v.number(),
      }),
      oneXbet: v.object({
        homeMoneyline: v.number(),
        awayMoneyline: v.number(),
        spreadLine: v.number(),
        homeSpreadOdds: v.number(),
        totalLine: v.number(),
        overOdds: v.number(),
        underOdds: v.number(),
      }),
      twentyTwoBet: v.object({
        homeMoneyline: v.number(),
        awayMoneyline: v.number(),
        spreadLine: v.number(),
        homeSpreadOdds: v.number(),
        totalLine: v.number(),
        overOdds: v.number(),
        underOdds: v.number(),
      }),
    }),
    bestValue: v.object({
      market: v.string(),
      selection: v.string(),
      bestOdds: v.number(),
      bookmaker: v.string(),
      fairOdds: v.number(),
      edgePercent: v.number(),
      kellyStakePercent: v.number(),
      grade: v.string(),
    }),
    marketSteamAlert: v.boolean(),
    lineupAlert: v.string(),
  })
    .index("by_fixture", ["fixtureId"])
    .index("by_league", ["league"]),

  user_betslips: defineTable({
    userId: v.string(),
    items: v.array(
      v.object({
        fixtureId: v.string(),
        sport: v.string(),
        matchTitle: v.string(),
        market: v.string(),
        selection: v.string(),
        bookmaker: v.string(),
        odds: v.number(),
        edgePercent: v.number(),
      })
    ),
    stake: v.number(),
    betType: v.string(),
    totalOdds: v.number(),
    potentialReturn: v.number(),
    safetyScore: v.number(),
    status: v.string(),
  }).index("by_user", ["userId"]),

  ai_match_insights: defineTable({
    fixtureId: v.string(),
    sport: v.string(),
    summary: v.string(),
    marketAnalysis: v.string(),
    lineupAnalysis: v.string(),
    quantRecommendation: v.string(),
  }).index("by_fixture", ["fixtureId"]),
});
