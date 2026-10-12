import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** The signed-in user's public profile, or null when signed out. */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      id: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
      favouriteSport: user.favouriteSport ?? null,
      joined: user._creationTime,
    };
  },
});

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    favouriteSport: v.optional(v.union(v.literal("football"), v.literal("basketball"), v.literal("both"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to update your profile.");
    const patch: { name?: string; favouriteSport?: string } = {};
    if (args.name !== undefined) patch.name = args.name.trim().slice(0, 40);
    if (args.favouriteSport !== undefined) patch.favouriteSport = args.favouriteSport;
    await ctx.db.patch(userId, patch);
  },
});
