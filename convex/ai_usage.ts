import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
const resultValidator = v.object({ text: v.string(), provider: v.string(), generatedAt: v.number() });
export const reserve = internalMutation({
  args: { userId: v.string(), cacheKey: v.string(), provider: v.optional(v.union(v.literal("agnes"), v.literal("aihubmix"))) },
  handler: async (ctx, args) => {
    const day = new Date().toISOString().slice(0, 10);
    const row = await ctx.db.query("ai_usage").withIndex("by_user", q => q.eq("userId", args.userId)).unique();
    if (row?.day === day && row.cacheKey === args.cacheKey && row.result) return { result: row.result };
    const count = row?.day === day ? row.count : 0;
    if (count >= 10) throw new Error("Daily AI limit reached (10 requests). Deterministic analysis is still available.");
    if (row?.day === day && row.cacheKey === args.cacheKey && !row.result && Date.now() - row.updatedAt < 30_000) throw new Error("This explanation is already being requested. Please wait before trying again.");
    // Reserve the account-wide provider budget atomically before any LLM call.
    // No Cloudflare provider or automatic fallback is supported.
    const budgetId = `__provider_budget__:${args.provider ?? "agnes"}`;
    const budget = await ctx.db.query("ai_usage").withIndex("by_user", q => q.eq("userId", budgetId)).unique();
    const spent = budget?.day === day ? budget.count : 0;
    if (spent >= 100) throw new Error("The application's daily AI budget is exhausted. Deterministic analysis remains available.");
    const budgetValues = { userId: budgetId, day, count: spent + 1, cacheKey: "daily-budget", updatedAt: Date.now() };
    if (budget) await ctx.db.patch(budget._id, budgetValues); else await ctx.db.insert("ai_usage", budgetValues);
    const values = { userId: args.userId, day, count: count + 1, cacheKey: args.cacheKey, result: undefined, updatedAt: Date.now() };
    if (row) await ctx.db.patch(row._id, values); else await ctx.db.insert("ai_usage", values);
    return { result: null };
  }
});
export const save = internalMutation({
  args: { userId: v.string(), cacheKey: v.string(), result: resultValidator },
  handler: async (ctx, args) => {
    const row = await ctx.db.query("ai_usage").withIndex("by_user", q => q.eq("userId", args.userId)).unique();
    if (row?.cacheKey === args.cacheKey) await ctx.db.patch(row._id, { result: args.result });
  }
});
