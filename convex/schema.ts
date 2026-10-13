import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // Convex Auth: users, sessions, accounts, refresh tokens, verification codes.
  ...authTables,
  users: defineTable({
    authSubject: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    favouriteSport: v.optional(v.string()),
    settings: v.optional(v.object({bankroll:v.number(),kellyFraction:v.number(),modelWeight:v.number(),motion:v.boolean(),theme:v.union(v.literal("system"),v.literal("light"),v.literal("dark"))})),
  }).index("email", ["email"]).index("by_auth_subject", ["authSubject"]),

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
    userId: v.id("users"),
    items: v.array(
      v.object({
        fixtureId: v.string(),
        sport: v.string(),
        matchTitle: v.string(),
        market: v.string(),
        selection: v.string(),
        bookmaker: v.string(),
        odds: v.number(),
        modelProb: v.optional(v.number()),
        pushProb: v.optional(v.number()),
      marketKey: v.optional(v.string()),
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

  saved_slips: defineTable({
    userId: v.id('users'), name: v.string(), items: v.array(v.object({fixtureId:v.string(),sport:v.string(),matchTitle:v.string(),market:v.string(),selection:v.string(),bookmaker:v.string(),odds:v.number(),modelProb:v.optional(v.number()),pushProb:v.optional(v.number()),edgePercent:v.number(),marketKey:v.optional(v.string()),kickoff:v.optional(v.number()),fixtureStatus:v.optional(v.string()),score:v.optional(v.object({home:v.number(),away:v.number(),regHome:v.optional(v.number()),regAway:v.optional(v.number())})),family:v.optional(v.string()),result:v.optional(v.string())})),
    stake:v.number(),betType:v.union(v.literal('acca'),v.literal('singles')),totalOdds:v.number(),potentialReturn:v.number(),updatedAt:v.number(),locked:v.boolean(),awaitingResults:v.boolean()
  }).index('by_user',['userId']).index('by_locked',['locked']).index('by_awaiting_results',['awaitingResults']),
  projection_snapshots: defineTable({fixtureId:v.string(),sport:v.string(),family:v.string(),match:v.string(),league:v.string(),kickoff:v.number(),publishedAt:v.number(),modelVersion:v.string(),state:v.string(),finishedAt:v.optional(v.number()),score:v.optional(v.object({home:v.number(),away:v.number(),regHome:v.optional(v.number()),regAway:v.optional(v.number())})),storageId:v.id('_storage'),fingerprint:v.string(),contributions:v.any(),recent:v.array(v.any())}).index('by_fixture',['fixtureId']).index('by_sport',['sport']).index('by_kickoff',['kickoff']).index('by_state_kickoff',['state','kickoff']).index('by_sport_state',['sport','state','kickoff']),
  performance_metrics: defineTable({sport:v.string(),groups:v.any(),fixtures:v.number(),settledFixtures:v.number(),verdicts:v.number(),updatedAt:v.number()}).index('by_sport',['sport']),
  // Live-data ingest. Two tiny documents only: "ingest" (quota ledgers,
  // job timestamps, lock, file ids) and "feed" (what clients read). All bulky
  // data lives gzipped in file storage, so database storage and I/O stay
  // close to zero on the free plan.
  feed_state: defineTable({
    key: v.string(),
    data: v.any(),
  }).index("by_key", ["key"]),

  push_subscriptions: defineTable({userId:v.id("users"),endpoint:v.string(),p256dh:v.string(),auth:v.string(),createdAt:v.number()}).index("by_endpoint",["endpoint"]).index("by_user",["userId"]),
  admin_audit: defineTable({ actorId: v.id("users"), targetId: v.id("users"), operation: v.string(), createdAt: v.number() }),
  payments: defineTable({
    userId: v.id("users"), provider: v.union(v.literal("flutterwave"), v.literal("korapay")),
    reference: v.string(), amount: v.number(), currency: v.string(), status: v.string(),
    createdAt: v.number(), paidAt: v.optional(v.number()), providerTransactionId: v.optional(v.string()),
    apiVersion: v.optional(v.union(v.literal('v3'), v.literal('v4'))),
    lastCheckAt:v.optional(v.number()), providerCustomerId: v.optional(v.string()), virtualAccountId: v.optional(v.string()),
  }).index("by_reference", ["reference"]).index("by_user", ["userId"]),
  subscriptions: defineTable({ userId: v.id("users"), expiresAt: v.number(), updatedAt: v.number() }).index("by_user", ["userId"]),
  ai_usage: defineTable({ userId: v.string(), day: v.string(), count: v.number(), cacheKey: v.optional(v.string()),
    result: v.optional(v.object({text: v.string(), provider: v.string(), generatedAt: v.number()})),
    updatedAt: v.number(),
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
