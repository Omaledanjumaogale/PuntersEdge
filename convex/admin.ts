import { query, mutation } from './_generated/server';
import { anyApi } from 'convex/server';
import { v } from 'convex/values';
import { getCurrentUser } from './auth';
import { nextMonthlyExpiry } from './lib/billing';
import { isSuperAdmin, requireAdmin } from './access';
export const status = query({ args: {}, handler: async ctx => ({ isSuperAdmin: await isSuperAdmin(ctx) }) });
export const overview = query({ args: {}, handler: async ctx => {
  await requireAdmin(ctx);
  const payments = await ctx.db.query('payments').order('desc').take(50);
  const subscriptions = await ctx.db.query('subscriptions').order('desc').take(50);
  return { payments, subscriptions, monthlyPrice: 10000, currency: 'NGN' };
}});

/** Administrator-only manual access adjustment; every operation leaves an audit record. */
export const setMembership = mutation({ args: { userId: v.id('users'), active: v.boolean() }, handler: async (ctx, args) => {
  await requireAdmin(ctx);
  if (!(await ctx.db.get(args.userId))) throw new Error('Account not found.');
  const existing = await ctx.db.query('subscriptions').withIndex('by_user', q => q.eq('userId', args.userId)).unique();
  const now = Date.now();
  const data = { userId: args.userId, expiresAt: args.active ? nextMonthlyExpiry(now) : now, updatedAt: now };
  if (existing) await ctx.db.patch(existing._id, data); else await ctx.db.insert('subscriptions', data);
  if (args.active) await ctx.scheduler.runAt(data.expiresAt, anyApi.payments.expire, { userId: args.userId, expiresAt: data.expiresAt });
  await ctx.db.insert('admin_audit', { actorId: (await getCurrentUser(ctx))!._id, targetId: args.userId, operation: args.active ? 'grant_month' : 'revoke_membership', createdAt: now });
}});

export {dashboard as performance} from './performance';
