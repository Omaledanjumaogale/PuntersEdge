import { v } from 'convex/values';
import { query, mutation, internalQuery, internalMutation } from './_generated/server';
import { requireSubscription, requireUser } from './access';
import { validatePushSubscription } from './pushValidation.js';

export const publicVapid = query({ args: {}, handler: async ctx => {
  await requireSubscription(ctx);
  return { publicKey: process.env.PUBLIC_VAPID_KEY ?? null };
}});
export const register = mutation({ args: { endpoint: v.string(), p256dh: v.string(), auth: v.string() }, handler: async (ctx,args) => {
  const userId = await requireSubscription(ctx);
  validatePushSubscription(args);
  const existing = await ctx.db.query('push_subscriptions').withIndex('by_endpoint',q=>q.eq('endpoint',args.endpoint)).unique();
  if (existing && existing.userId !== userId) throw new Error('This device belongs to another account. Disable notifications first.');
  if (existing) await ctx.db.patch(existing._id,{...args});
  else {
    const devices = await ctx.db.query('push_subscriptions').withIndex('by_user',q=>q.eq('userId',userId)).take(6);
    if (devices.length >= 5) throw new Error('Five devices are already registered. Remove a device before adding another.');
    await ctx.db.insert('push_subscriptions',{userId,...args,createdAt:Date.now()});
  }
}});
export const remove = mutation({ args: {endpoint:v.string()}, handler:async(ctx,{endpoint})=>{
  const userId = await requireUser(ctx);
  const existing=await ctx.db.query('push_subscriptions').withIndex('by_endpoint',q=>q.eq('endpoint',endpoint)).unique();
  if(existing?.userId===userId) await ctx.db.delete(existing._id);
}});
export const recipients = internalQuery({args:{cursor:v.optional(v.string())},handler:async(ctx,{cursor})=>{
  const page=await ctx.db.query('push_subscriptions').paginate({numItems:50,cursor:cursor ?? null});
  const result=[];
  for (const device of page.page) {
    const user = await ctx.db.get(device.userId);
    if (!user) continue;
    const membership=await ctx.db.query('subscriptions').withIndex('by_user',q=>q.eq('userId',device.userId)).unique();
    if(device.userId===process.env.SUPER_ADMIN_USER_ID || membership && membership.expiresAt>Date.now()) result.push(device);
  }
  return {recipients:result,nextCursor:page.continueCursor,isDone:page.isDone};
}});
export const prune = internalMutation({args:{id:v.id('push_subscriptions')},handler:async(ctx,{id})=>{await ctx.db.delete(id);}});
