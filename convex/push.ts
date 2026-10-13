import {DEFAULT_NOTIFICATION_PREFERENCES} from '../src/lib/notification-events.js';
import { v } from 'convex/values';
import { query, mutation, internalQuery, internalMutation } from './_generated/server';
import { requireSubscription, requireUser } from './access';
import { validatePushSubscription } from './pushValidation.js';

const preferencesValidator=v.object({newMatches:v.boolean(),liveStarts:v.boolean(),scoreUpdates:v.boolean(),finishedGames:v.boolean(),activities:v.boolean()});
const eventValidator=v.union(v.literal('newMatches'),v.literal('liveStarts'),v.literal('scoreUpdates'),v.literal('finishedGames'),v.literal('activities'));
export const preferences=query({args:{},handler:async(ctx)=>{const id=await requireUser(ctx);const user=await ctx.db.get(id);return user?.notificationPreferences??DEFAULT_NOTIFICATION_PREFERENCES;}});
export const savePreferences=mutation({args:{preferences:preferencesValidator},handler:async(ctx,args)=>{const id=await requireUser(ctx);await ctx.db.patch(id,{notificationPreferences:args.preferences});}});

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
export const recipients = internalQuery({args:{cursor:v.optional(v.string()),event:v.optional(eventValidator),targetUserId:v.optional(v.id("users"))},handler:async(ctx,{cursor,event,targetUserId})=>{
  const devices=targetUserId?ctx.db.query('push_subscriptions').withIndex('by_user',q=>q.eq('userId',targetUserId)):ctx.db.query('push_subscriptions');
  const page=await devices.paginate({numItems:50,cursor:cursor ?? null});
  const result=[];
  for (const device of page.page) {
    const user = await ctx.db.get(device.userId);
    if (!user) continue;
    if(targetUserId && device.userId!==targetUserId)continue;
    if(!(user.notificationPreferences??DEFAULT_NOTIFICATION_PREFERENCES)[event??'finishedGames'])continue;
    const membership=await ctx.db.query('subscriptions').withIndex('by_user',q=>q.eq('userId',device.userId)).unique();
    if(event==='activities'&&targetUserId===device.userId || device.userId===process.env.SUPER_ADMIN_USER_ID || membership && membership.expiresAt>Date.now()) result.push(device);
  }
  return {recipients:result,nextCursor:page.continueCursor,isDone:page.isDone};
}});
export const prune = internalMutation({args:{id:v.id('push_subscriptions')},handler:async(ctx,{id})=>{await ctx.db.delete(id);}});

export const claimAlert=internalMutation({args:{id:v.id('push_subscriptions'),event:eventValidator,batchId:v.string(),now:v.number(),targetUserId:v.optional(v.id('users'))},handler:async(ctx,args)=>{
 const device=await ctx.db.get(args.id);if(!device)return false;
 const user=await ctx.db.get(device.userId);if(!user||!(user.notificationPreferences??DEFAULT_NOTIFICATION_PREFERENCES)[args.event])return false;
 if(args.targetUserId&&args.targetUserId!==device.userId)return false;
 if(!(args.event==='activities'&&args.targetUserId===device.userId)&&device.userId!==process.env.SUPER_ADMIN_USER_ID){const subscription=await ctx.db.query('subscriptions').withIndex('by_user',q=>q.eq('userId',device.userId)).unique();if(!subscription||subscription.expiresAt<=args.now)return false;}
 const old=device.lastAlerts?.[args.event];if(old?.batchId===args.batchId||old&&old.at>args.now-15*60000)return false;
 await ctx.db.patch(device._id,{lastAlerts:{...(device.lastAlerts??{}),[args.event]:{batchId:args.batchId,at:args.now}}});return true;
}});

/** Browser permission alone is not a registered, account-owned backend connection. */
export const deviceStatus=query({args:{endpoint:v.string()},handler:async(ctx,{endpoint})=>{
 const userId=await requireUser(ctx);
 const device=await ctx.db.query('push_subscriptions').withIndex('by_endpoint',q=>q.eq('endpoint',endpoint)).unique();
 return device?.userId===userId?{registered:true,lastDelivery:device.lastDelivery??null}:{registered:false,lastDelivery:null};
}});
export const prepareTest=internalMutation({args:{endpoint:v.string()},handler:async(ctx,{endpoint})=>{
 const userId=await requireSubscription(ctx);
 const device=await ctx.db.query('push_subscriptions').withIndex('by_endpoint',q=>q.eq('endpoint',endpoint)).unique();
 if(!device||device.userId!==userId)throw new Error('Connect this device to your account before sending a test.');
 const user=await ctx.db.get(userId);
 if(!(user?.notificationPreferences??DEFAULT_NOTIFICATION_PREFERENCES).activities)throw new Error('Enable and save membership activity notifications before sending a test.');
 if(device.lastTestAt&&device.lastTestAt>Date.now()-5*60000)throw new Error('Please wait five minutes before sending another test to this device.');
 await ctx.db.patch(device._id,{lastTestAt:Date.now()});
 return device;
}});
export const recordDelivery=internalMutation({args:{id:v.id('push_subscriptions'),outcome:v.union(v.literal('accepted'),v.literal('failed')),statusCode:v.optional(v.number())},handler:async(ctx,args)=>{
 if(await ctx.db.get(args.id))await ctx.db.patch(args.id,{lastDelivery:{at:Date.now(),outcome:args.outcome,...(args.statusCode===undefined?{}:{statusCode:args.statusCode})}});
}});
