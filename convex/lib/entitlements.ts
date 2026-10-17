import type {QueryCtx,MutationCtx} from '../_generated/server';
import type {Id} from '../_generated/dataModel';
export async function entitlement(ctx:QueryCtx|MutationCtx,userId:Id<'users'>){
 const access=await ctx.db.query('account_access').withIndex('by_user',q=>q.eq('userId',userId)).unique();
 const owner=userId===process.env.SUPER_ADMIN_USER_ID;
 const subscription=await ctx.db.query('subscriptions').withIndex('by_user',q=>q.eq('userId',userId)).unique();
 const blocked=!owner&&!!access&&access.status!=='active';
 const grant=!!access&&(access.grant==='free'||access.grant==='timed'&&(access.expiresAt??0)>Date.now());
 return {active:!blocked&&(owner||grant||!!subscription&&subscription.expiresAt>Date.now()),status:blocked?access!.status:'active',kind:access?.kind??'member',expiresAt:access?.grant==='free'?null:Math.max(access?.expiresAt??0,subscription?.expiresAt??0)||null};
}
