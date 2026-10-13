'use node';
import webpush from 'web-push';
import { v } from 'convex/values';
import { action, internalAction } from './_generated/server';
import { anyApi } from 'convex/server';
import type { Doc } from './_generated/dataModel';
import { validatePushSubscription } from './pushValidation.js';

export const deliver = internalAction({args:{count:v.number(),cursor:v.optional(v.string()),event:v.optional(v.union(v.literal('newMatches'),v.literal('liveStarts'),v.literal('scoreUpdates'),v.literal('finishedGames'),v.literal('activities'))),batchId:v.optional(v.string()),targetUserId:v.optional(v.id('users')),activity:v.optional(v.union(v.literal('ticketSaved'),v.literal('membershipActivated'),v.literal('membershipExpired'),v.literal('testDelivery')))},handler:async(ctx,{count,cursor,event:requestedEvent,batchId:requestedBatch,targetUserId,activity}):Promise<{sent:number;failed:number}>=>{
 const event=requestedEvent??'finishedGames',batchId=requestedBatch??`${event}:${Date.now()}`;
 const publicKey=process.env.PUBLIC_VAPID_KEY, privateKey=process.env.VAPID_PRIVATE_KEY, subject=process.env.VAPID_SUBJECT;
 if(!publicKey || !privateKey || !subject || count<=0) return {sent:0,failed:0};
 webpush.setVapidDetails(subject,publicKey,privateKey);
 const page: {recipients:Doc<'push_subscriptions'>[];nextCursor:string;isDone:boolean}=await ctx.runQuery(anyApi.push.recipients,{cursor,event,targetUserId});
 const titles={newMatches:'New fixtures available',liveStarts:'Games are now live',scoreUpdates:'Live scores updated',finishedGames:'Final scores updated',activities:'Your PuntersEdge activity'};
 const descriptions={newMatches:'new upcoming fixtures',liveStarts:'games going live',scoreUpdates:'score changes',finishedGames:'final scores'};
 const body=event==='activities'?(activity==='testDelivery'?'This is your requested background notification test. Open Settings to review your connection.':activity==='ticketSaved'?'A named ticket was saved to your history.':activity==='membershipExpired'?'Your VIP membership has expired. Open your account to renew.':'Your Exclusive VIP membership is active.'):`${Math.min(Math.floor(count),999)} ${descriptions[event]} are ready to review.`;
 const payload=JSON.stringify({title:activity==='testDelivery'?'PuntersEdge notification test':titles[event],body,url:activity==='testDelivery'?'/settings':event==='activities'?(activity==='ticketSaved'?'/betslips':'/account'):'/results',tag:`puntersedge-${event}`});
 let sent=0,failed=0;
 for(let offset=0;offset<page.recipients.length;offset+=5){
  await Promise.all(page.recipients.slice(offset,offset+5).map(async device=>{
  try {
   if(!await ctx.runMutation(anyApi.push.claimAlert,{id:device._id,event,batchId,now:Date.now(),targetUserId}))return;
   validatePushSubscription(device);
   const result=await webpush.sendNotification({endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth}},payload,{TTL:3600,urgency:'normal',timeout:10000});
   await ctx.runMutation(anyApi.push.recordDelivery,{id:device._id,outcome:'accepted',statusCode:result.statusCode});
   sent++;
  } catch(error) {
   failed++;
   const statusCode=(error as {statusCode?:number}).statusCode;
   await ctx.runMutation(anyApi.push.recordDelivery,{id:device._id,outcome:'failed',...(Number.isFinite(statusCode)?{statusCode}:{})});
   if((error as {statusCode?:number}).statusCode===410 || (error as {statusCode?:number}).statusCode===404) await ctx.runMutation(anyApi.push.prune,{id:device._id});
  }
  }));
 }
 if(!page.isDone) await ctx.scheduler.runAfter(0,anyApi.notifications.deliver,{count,cursor:page.nextCursor,event,batchId,targetUserId,activity});
 return {sent,failed};
}});

/** User-clicked, owner-scoped test through the real browser push service. */
export const testDevice=action({args:{endpoint:v.string()},handler:async(ctx,args):Promise<{accepted:boolean;statusCode:number}>=>{
 const device=await ctx.runMutation(anyApi.push.prepareTest,args);
 const publicKey=process.env.PUBLIC_VAPID_KEY,privateKey=process.env.VAPID_PRIVATE_KEY,subject=process.env.VAPID_SUBJECT;
 if(!publicKey||!privateKey||!subject)throw new Error('Background notification delivery is not configured.');
 webpush.setVapidDetails(subject,publicKey,privateKey);validatePushSubscription(device);
 try{
  const result=await webpush.sendNotification({endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth}},JSON.stringify({title:'PuntersEdge notification test',body:'This is the background notification test you requested in Settings.',url:'/settings',tag:'puntersedge-test'}),{TTL:3600,urgency:'normal',timeout:10000});
  await ctx.runMutation(anyApi.push.recordDelivery,{id:device._id,outcome:'accepted',statusCode:result.statusCode});
  return {accepted:true,statusCode:result.statusCode};
 }catch(error){
  const statusCode=(error as {statusCode?:number}).statusCode;
  await ctx.runMutation(anyApi.push.recordDelivery,{id:device._id,outcome:'failed',...(Number.isFinite(statusCode)?{statusCode}:{})});
  if(statusCode===404||statusCode===410){await ctx.runMutation(anyApi.push.prune,{id:device._id});throw new Error('This device connection expired. Disconnect and enable notifications again.');}
  throw new Error('The browser push service could not accept the test. Try reconnecting this device.');
 }
}});
