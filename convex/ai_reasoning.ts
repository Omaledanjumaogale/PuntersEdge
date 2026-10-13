import { query } from "./_generated/server";
import { requireSubscription } from "./access";
import { v } from "convex/values";
// Retired precomputed-table endpoint. ai_insights.explain reads the authoritative provider feed.
export const getMatchReasoning=query({args:{fixtureId:v.string(),sport:v.string()},handler:async(ctx)=>{await requireSubscription(ctx);return null;}});
