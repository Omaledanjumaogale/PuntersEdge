import { query } from "./_generated/server";
import { requireSubscription } from "./access";
import { v } from "convex/values";
// Legacy database tables do not drive production. Subscribe to feed.meta instead.
export const getFootballMatches=query({args:{},handler:async(ctx)=>{await requireSubscription(ctx);return [];}});
export const getBasketballFixtures=query({args:{},handler:async(ctx)=>{await requireSubscription(ctx);return [];}});
export const getFootballById=query({args:{fixtureId:v.string()},handler:async(ctx)=>{await requireSubscription(ctx);return null;}});
export const getBasketballById=query({args:{fixtureId:v.string()},handler:async(ctx)=>{await requireSubscription(ctx);return null;}});
