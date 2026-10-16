"use node";
import {internalAction} from './_generated/server';
import {makeFunctionReference} from 'convex/server';
import {internal} from './_generated/api';
import {gunzipSync} from 'node:zlib';
import {executeIngest} from '../src/lib/feeds/ingest-runtime.js';
import {blobClient} from '../src/lib/feeds/blob-client.js';
import {predict} from '../src/lib/feeds/build.js';
import type {SPORTS} from '../src/lib/feeds/catalog.js';
/** Manual admin refresh shares the R2 pipeline. Normal half-hour runs execute on GitHub. */
export const tick=internalAction({args:{},handler:async(ctx):Promise<Record<string,unknown>>=>{
 const keys={apiSports:process.env.API_SPORTS_KEY||process.env.API_FOOTBALL_KEY||'',oddsApi:process.env.THE_ODDS_API_KEY||'',oddspapi:process.env.ODDSPAPI_KEY||''};
 const rpc={query:(name:string,args:any)=>ctx.runQuery(makeFunctionReference<'query'>(name),args),mutation:(name:string,args:any)=>ctx.runMutation(makeFunctionReference<'mutation'>(name),args),action:(name:string,args:any)=>ctx.runAction(makeFunctionReference<'action'>(name),args)};
 return executeIngest({rpc,blobs:blobClient(process.env.EDGE_DATA_URL,process.env.EDGE_DATA_SECRET),keys});
}});
/** Deployment diagnostics read the active R2 pointer, never a stale migration source. */
export const inspect=internalAction({args:{},handler:async(ctx):Promise<Record<string,unknown>>=>{
 const state=await ctx.runQuery(internal.feed.diagnosticState,{});let bytes:Uint8Array|null=null;
 if(state.feed?.blobKey)bytes=await blobClient(process.env.EDGE_DATA_URL,process.env.EDGE_DATA_SECRET).get(state.feed.blobKey);
 else if(state.feed?.storageId){const file=await ctx.storage.get(state.feed.storageId);if(file)bytes=new Uint8Array(await file.arrayBuffer());}
 if(!bytes)return {ready:false};
 const feed=JSON.parse(gunzipSync(bytes).toString()),grades:Record<string,number>={},pricing:Record<string,number>={};
 for(const[sport,inputs]of Object.entries(feed.inputs??{}))for(const input of inputs as any[])try{const projection=predict(sport as keyof typeof SPORTS,input,{});for(const group of projection.markets)for(const s of group.selections){grades[s.grade]=(grades[s.grade]??0)+1;pricing[s.pricing]=(pricing[s.pricing]??0)+1;}}catch{}
 return {ready:true,storageMode:state.feed.blobKey?'r2':'legacy',grades,pricing,counts:state.feed.counts,generatedAt:state.feed.generatedAt,projectedCount:feed.projections?.length??0,reviewCount:Object.keys(feed.reviewInputs??{}).length,lastTick:state.lastTick};
}});
