import { authComponent, getCurrentUser } from './auth';
import { mutation, query, internalQuery, internalMutation } from './_generated/server';
import { componentsGeneric } from 'convex/server';
import { v } from 'convex/values';

export const syncProfile = mutation({ args: {}, handler: async (ctx) => {
  const account = await authComponent.getAuthUser(ctx);
  const existing = await getCurrentUser(ctx);
  const profile = { name: account.name, email: account.email, emailVerificationTime: account.emailVerified ? existing?.emailVerificationTime ?? Date.now() : undefined };
  if (existing) {
    if (existing.name !== profile.name || existing.email !== profile.email || existing.emailVerificationTime !== profile.emailVerificationTime) await ctx.db.patch(existing._id, profile);
    return existing._id;
  }
  // Never link an old account by email alone: a separate migration must prove ownership.
  return ctx.db.insert('users', { ...profile, authSubject: account._id });
}});
export const viewer = query({ args: {}, handler: async (ctx) => {
  const user = await getCurrentUser(ctx);
  if (!user) return null;
  const subscription=await ctx.db.query('subscriptions').withIndex('by_user',q=>q.eq('userId',user._id)).unique();
  const superAdmin=Boolean(process.env.SUPER_ADMIN_USER_ID && user._id === process.env.SUPER_ADMIN_USER_ID);
  const activeSubscription=superAdmin || !!subscription && subscription.expiresAt>Date.now();
  return { role:superAdmin?'super_admin':activeSubscription?'subscriber':'member', activeSubscription, id: user._id, name: user.name ?? null, email: user.email ?? null,
    favouriteSport: user.favouriteSport ?? null, settings: user.settings ?? null, joined: user._creationTime,
    emailVerified: Boolean(user.emailVerificationTime),
    superAdmin: Boolean(process.env.SUPER_ADMIN_USER_ID && user._id === process.env.SUPER_ADMIN_USER_ID), };
}});
export const updateProfile = mutation({ args: { name: v.optional(v.string()), favouriteSport: v.optional(v.string()) }, handler: async (ctx, args) => {
  const user = await getCurrentUser(ctx);
  if (!user) throw new Error('Sign in to update your profile.');
  if (args.favouriteSport && !['football','basketball','nba','hockey','baseball','both'].includes(args.favouriteSport)) throw new Error('Invalid sport.');
  await ctx.db.patch(user._id, { ...(args.name !== undefined ? { name: args.name.trim().slice(0,40) } : {}), ...(args.favouriteSport !== undefined ? { favouriteSport: args.favouriteSport } : {}) });
}});

export const byAuthSubject = internalQuery({ args: { subject: v.string() }, handler: async (ctx, args) => ctx.db.query('users').withIndex('by_auth_subject', q => q.eq('authSubject', args.subject)).unique() });

export const updateSettings = mutation({args:{settings:v.object({bankroll:v.number(),kellyFraction:v.number(),modelWeight:v.number(),motion:v.boolean(),theme:v.union(v.literal('system'),v.literal('light'),v.literal('dark'))})},handler:async(ctx,{settings})=>{
 const user=await getCurrentUser(ctx);if(!user)throw new Error('Sign in to synchronize settings.');
 if(!Number.isFinite(settings.bankroll)||settings.bankroll<0||settings.bankroll>1e12||![settings.kellyFraction,settings.modelWeight].every(n=>Number.isFinite(n)&&n>=0&&n<=1))throw new Error('Invalid analysis settings.');
 if(JSON.stringify(user.settings)!==JSON.stringify(settings))await ctx.db.patch(user._id,{settings});
}});

/** Deploy-key-only bootstrap binds the owner's confirmed signup to a local ID.
 * This never grants a session or marks an email verified. Normal sign-in remains required.
 */
export const bootstrapAdminProfile = internalMutation({args:{subject:v.string()},handler:async(ctx,{subject})=>{
 const expected=process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
 if(!expected)throw new Error('Administrator bootstrap email is not configured.');
 const account=await ctx.runQuery(componentsGeneric().betterAuth.adapter.findOne,{model:'user',where:[{field:'_id',value:subject}]});
 if(!account || String(account.email).toLowerCase()!==expected)throw new Error('Administrator account mismatch.');
 const existing=await ctx.db.query('users').withIndex('by_auth_subject',q=>q.eq('authSubject',subject)).unique();
 if(existing)return {id:existing._id,emailVerified:account.emailVerified};
 const id=await ctx.db.insert('users',{authSubject:subject,email:account.email,name:account.name,emailVerificationTime:account.emailVerified?Date.now():undefined});
 return {id,emailVerified:account.emailVerified};
}});
