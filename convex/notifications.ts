'use node';
import webpush from 'web-push';
import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import { anyApi } from 'convex/server';
import type { Doc } from './_generated/dataModel';
import { validatePushSubscription } from './pushValidation.js';

export const deliver = internalAction({args:{count:v.number(),cursor:v.optional(v.string())},handler:async(ctx,{count,cursor}):Promise<{sent:number;failed:number}>=>{
 const publicKey=process.env.PUBLIC_VAPID_KEY, privateKey=process.env.VAPID_PRIVATE_KEY, subject=process.env.VAPID_SUBJECT;
 if(!publicKey || !privateKey || !subject || count<=0) return {sent:0,failed:0};
 webpush.setVapidDetails(subject,publicKey,privateKey);
 const page: {recipients:Doc<'push_subscriptions'>[];nextCursor:string;isDone:boolean}=await ctx.runQuery(anyApi.push.recipients,{cursor});
 const payload=JSON.stringify({title:'PuntersEdge results updated',body:`${Math.min(Math.floor(count),999)} new result${count===1?' is':'s are'} ready. Open the app to view the latest analysis.`,url:'/results'});
 let sent=0,failed=0;
 for(let offset=0;offset<page.recipients.length;offset+=5){
  await Promise.all(page.recipients.slice(offset,offset+5).map(async device=>{
  try {
   validatePushSubscription(device);
   await webpush.sendNotification({endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth}},payload,{TTL:3600,urgency:'normal',timeout:10000});
   sent++;
  } catch(error) {
   failed++;
   if((error as {statusCode?:number}).statusCode===410 || (error as {statusCode?:number}).statusCode===404) await ctx.runMutation(anyApi.push.prune,{id:device._id});
  }
  }));
 }
 if(!page.isDone) await ctx.scheduler.runAfter(0,anyApi.notifications.deliver,{count,cursor:page.nextCursor});
 return {sent,failed};
}});
