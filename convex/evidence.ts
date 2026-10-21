import {query,internalQuery,internalMutation} from './_generated/server';
import {v} from 'convex/values';import {requireAdmin} from './access';
const row=async(ctx:any)=>ctx.db.query('feed_state').withIndex('by_key',(q:any)=>q.eq('key','evidence-shortlist')).unique();
const validKey=(s:string)=>/^archives\/evidence\/[a-f0-9]{64}-(state|report)\.gz$/.test(s);
export const meta=query({args:{},handler:async ctx=>{await requireAdmin(ctx);const d=(await row(ctx))?.data;return d?{blobKey:d.reportKey,version:d.version,updatedAt:d.updatedAt,coverage:d.coverage}:null;}});
export const state=internalQuery({args:{},handler:async ctx=>({catalog:(await row(ctx))?.data??null,ingest:(await ctx.db.query('feed_state').withIndex('by_key',q=>q.eq('key','ingest')).unique())?.data?.storeKey??null})});
export const sources=internalQuery({args:{cursor:v.optional(v.string())},handler:async(ctx,args)=>{const p=await ctx.db.query('projection_snapshots').withIndex('by_state_kickoff',q=>q.eq('state','finished')).paginate({cursor:args.cursor??null,numItems:50});return {...p,page:await Promise.all(p.page.filter(r=>r.score).map(async r=>({fixtureId:r.fixtureId,publishedAt:r.publishedAt,observedAt:r.observedAt??r.publishedAt,finishedAt:r.finishedAt??null,score:r.score,periodScores:r.periodScores??null,fingerprint:r.fingerprint,blobKey:r.blobKey??null,legacyUrl:!r.blobKey&&r.storageId?await ctx.storage.getUrl(r.storageId):null})))};}});
export const publish=internalMutation({args:{expectedVersion:v.union(v.string(),v.null()),version:v.string(),reportKey:v.string(),stateKey:v.string(),updatedAt:v.number(),coverage:v.any(),retired:v.array(v.object({key:v.string(),after:v.number()}))},handler:async(ctx,args)=>{
 if(!/^[a-f0-9]{64}$/.test(args.version)||!validKey(args.reportKey)||!validKey(args.stateKey)||args.retired.length>500||args.retired.some(x=>!validKey(x.key)))throw new Error('Invalid evidence artifact');
 const old=await row(ctx);if((old?.data?.version??null)!==args.expectedVersion||old&&args.updatedAt<old.data.updatedAt)return false;
 const {expectedVersion,...data}=args;if(old)await ctx.db.patch(old._id,{data});else await ctx.db.insert('feed_state',{key:'evidence-shortlist',data});return true;
}});
