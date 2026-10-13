import { getCurrentUser } from './auth';
import { internalQuery, query } from './_generated/server';
import type { QueryCtx, MutationCtx } from './_generated/server';

export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const userId = (await getCurrentUser(ctx))?._id;
  if (!userId) throw new Error('Sign in to continue.');
  return userId;
}
export async function isSuperAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = (await getCurrentUser(ctx))?._id;
  return !!userId && !!process.env.SUPER_ADMIN_USER_ID && userId === process.env.SUPER_ADMIN_USER_ID;
}
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  if (!(await isSuperAdmin(ctx))) throw new Error('Administrator access required.');
}
export async function requireSubscription(ctx: QueryCtx | MutationCtx) {
  const userId = await requireUser(ctx);
  if (await isSuperAdmin(ctx)) return userId;
  const subscription = await ctx.db.query('subscriptions').withIndex('by_user', q => q.eq('userId', userId)).unique();
  if (!subscription || subscription.expiresAt <= Date.now()) throw new Error('An active all-access subscription is required.');
  return userId;
}

export const subscriptionAccess = internalQuery({ args: {}, handler: async ctx => ({ userId: await requireSubscription(ctx) }) });

export const role = query({args:{},handler:async(ctx)=>{
 const user=await getCurrentUser(ctx);if(!user)return {role:'guest',active:false,expiresAt:null};
 if(await isSuperAdmin(ctx))return {role:'super_admin',active:true,expiresAt:null};
 const subscription=await ctx.db.query('subscriptions').withIndex('by_user',q=>q.eq('userId',user._id)).unique();
 const active=!!subscription&&subscription.expiresAt>Date.now();
 return {role:active?'subscriber':'member',active,expiresAt:subscription?.expiresAt??null};
}});
