import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const item = v.object({
  fixtureId: v.string(),
  sport: v.string(),
  matchTitle: v.string(),
  market: v.string(),
  selection: v.string(),
  bookmaker: v.string(),
  odds: v.number(),
  modelProb: v.optional(v.number()),
  edgePercent: v.number(),
});

/** The signed-in user's saved slip. The user is taken from the session, never from arguments. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await ctx.db
      .query("user_betslips")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

export const save = mutation({
  args: { items: v.array(item), stake: v.number(), betType: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to sync your slip.");
    if (args.items.length > 30) throw new Error("A slip can hold at most 30 selections.");

    const totalOdds = Math.round(args.items.reduce((acc, i) => acc * i.odds, 1) * 100) / 100;
    const doc = {
      userId,
      items: args.items,
      stake: Math.max(0, args.stake),
      betType: args.betType,
      totalOdds,
      potentialReturn: Math.round(args.stake * totalOdds * 100) / 100,
      safetyScore: args.items.length <= 1 ? 100 : Math.max(10, Math.round(100 - (args.items.length - 1) * 18.5)),
      status: "draft",
    };

    const existing = await ctx.db
      .query("user_betslips")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return existing._id;
    }
    return await ctx.db.insert("user_betslips", doc);
  },
});
