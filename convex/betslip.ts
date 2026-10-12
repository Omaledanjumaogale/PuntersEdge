import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getUserBetslip = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("user_betslips")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const updateBetslip = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const totalOdds = args.items.reduce((acc, item) => acc * item.odds, 1);
    const potentialReturn = Math.round(args.stake * totalOdds * 100) / 100;

    // Accumulator safety scoring logic
    // More legs = exponential bookmaker margin compounding
    let safetyScore = 100;
    if (args.items.length > 1) {
      safetyScore = Math.max(10, Math.round(100 - (args.items.length - 1) * 18.5));
    }

    const existing = await ctx.db
      .query("user_betslips")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        items: args.items,
        stake: args.stake,
        betType: args.betType,
        totalOdds: Math.round(totalOdds * 100) / 100,
        potentialReturn,
        safetyScore,
        status: "draft",
      });
      return existing._id;
    } else {
      return await ctx.db.insert("user_betslips", {
        userId: args.userId,
        items: args.items,
        stake: args.stake,
        betType: args.betType,
        totalOdds: Math.round(totalOdds * 100) / 100,
        potentialReturn,
        safetyScore,
        status: "draft",
      });
    }
  },
});
