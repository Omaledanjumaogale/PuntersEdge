import {query,mutation,internalMutation} from './_generated/server';
import {v} from 'convex/values';
import {requireAdmin} from './access';
const state=async(ctx:any)=>ctx.db.query('feed_state').withIndex('by_key',(q:any)=>q.eq('key','tennis-shadow')).unique();
export const summary=query({args:{},handler:async ctx=>{await requireAdmin(ctx);return (await state(ctx))?.data??{mode:'shadow',liveEnabled:false,status:'Awaiting first coverage assessment',rows:0};}});
const write=async(ctx:any,report:any)=>{if(!report||report.mode!=='shadow'||report.liveEnabled!==false||JSON.stringify(report).length>16000)throw Error('A compact shadow-only report is required');const row=await state(ctx);if(row)await ctx.db.patch(row._id,{data:report});else await ctx.db.insert('feed_state',{key:'tennis-shadow',data:report});};
export const record=internalMutation({args:{report:v.any()},handler:async(ctx,{report})=>write(ctx,report)});
export const uploaded=mutation({args:{rows:v.number(),fingerprint:v.string()},handler:async(ctx,args)=>{await requireAdmin(ctx);if(!Number.isInteger(args.rows)||args.rows<1||args.rows>5000||!/^[a-f0-9]{64}$/.test(args.fingerprint))throw Error('Invalid dataset metadata');await write(ctx,{at:Date.now(),mode:'shadow',liveEnabled:false,status:'Licensed dataset uploaded; awaiting daily offline evaluation',rows:args.rows,fingerprint:args.fingerprint});}});
