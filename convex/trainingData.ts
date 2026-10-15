"use node";
import {internalAction} from './_generated/server';
import {makeFunctionReference} from 'convex/server';
import {v} from 'convex/values';
import {gzipSync,gunzipSync} from 'node:zlib';
import {mergeTrainingRows,trainingDomain} from '../src/lib/engine/learning_data.js';
import {createHash} from 'node:crypto';
const stateRef=makeFunctionReference<'query'>('learning:state'),patchRef=makeFunctionReference<'mutation'>('learning:patch');
async function read(ctx:any,id:any){if(!id)return null;const b=await ctx.storage.get(id);return b?JSON.parse(gunzipSync(Buffer.from(await b.arrayBuffer()),{maxOutputLength:32*1024*1024}).toString()):null;}
async function merge(ctx:any,rows:any[],state:any){const previous=await read(ctx,state.learning.corpusId)??[];const all=mergeTrainingRows(previous,rows,Date.now());const corpusId=await ctx.storage.store(new Blob([gzipSync(Buffer.from(JSON.stringify(all)))],{type:'application/gzip'}));await ctx.runMutation(patchRef,{data:{corpusId,rows:all.length,lastCollectedAt:Date.now()}});if(state.learning.corpusId)await ctx.storage.delete(state.learning.corpusId);return all;}
/** Deployment-admin seed of already licensed results; no provider calls. Sequential chunks only. */
export const seed=internalAction({args:{rows:v.array(v.any())},handler:async(ctx,{rows})=>{if(rows.length>1000)throw new Error('Maximum 1000 results per chunk');const state=await ctx.runQuery(stateRef,{});const all=await merge(ctx,rows,state);return {rows:all.length};}});
export const collect=internalAction({args:{},handler:async ctx=>{const state=await ctx.runQuery(stateRef,{}),store=await read(ctx,state.ingest.storeId);const rows:any[]=[];
 for(const g of Object.values(store?.games??{}) as any[]){if(g.status?.state!=='finished'||!g.homeId||!g.awayId||!trainingDomain(g,state.models))continue;const pairs={full:{home:g.sport==='football'?(g.status.regHome??g.status.home):g.status.home,away:g.sport==='football'?(g.status.regAway??g.status.away):g.status.away},...(g.status.periodScores??{})};for(const [scope,score]of Object.entries(pairs))rows.push({id:g.ext?.as??g.ext?.public??g.uid,sport:g.sport,scope,league:g.league,homeId:g.homeId,awayId:g.awayId,kickoff:g.kickoff,availableAt:Math.max(g.kickoff+1,g.updated??Date.now()-1),status:score,availabilityBasis:'provider result observed'});}
 const all=await merge(ctx,rows,state),models=state.models.filter((m:any)=>m.mode==='active'),bytes=JSON.stringify({rows:all,incumbents:models.map((m:any)=>({artifact:m.artifact,approved:m.approved})),collectedAt:Date.now()}),fingerprint=createHash('sha256').update(JSON.stringify(all)).digest('hex');const datasetId=await ctx.storage.store(new Blob([gzipSync(Buffer.from(bytes))],{type:'application/gzip'}));await ctx.runMutation(patchRef,{data:{datasetId,fingerprint,status:'Collected; scheduled evaluation pending'}});if(state.learning.datasetId)await ctx.storage.delete(state.learning.datasetId);return {url:await ctx.storage.getUrl(datasetId),fingerprint,rows:all.length};
}});
