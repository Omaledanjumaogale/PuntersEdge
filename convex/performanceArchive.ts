"use node";
import {internalAction} from './_generated/server';
import {makeFunctionReference} from 'convex/server';
import {v} from 'convex/values';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {contributionsFor} from '../src/lib/feeds/performance.js';
/** Full pre-match inputs and every market remain compressed for reproducible model research. */
export const storeBatch=internalAction({args:{snapshots:v.array(v.string()),attempt:v.optional(v.number())},handler:async(ctx,args)=>{
 try { for(const raw of args.snapshots){
  const p=JSON.parse(raw);
  const bytes=Buffer.from(JSON.stringify(p));
  const storageId=await ctx.storage.store(new Blob([gzipSync(bytes)],{type:'application/gzip'}));
  const {fixtureId,sport,family,match,league,kickoff,publishedAt,modelVersion,state}=p;
  const contributions=contributionsFor(p);
  await ctx.runMutation(makeFunctionReference<'mutation'>('performance:record'),{fixtureId,sport,family,match,league,kickoff,publishedAt,modelVersion,state,storageId,contributions,fingerprint:createHash('sha256').update(bytes).digest('hex'),recent:p.selections.filter((s:any)=>s.result&&s.result!=='ungraded').sort((a:any,b:any)=>Number(b.verdict)-Number(a.verdict)).slice(0,20),...(p.finishedAt?{finishedAt:p.finishedAt}:{}),...(p.score?{score:p.score}:{})});
 } } catch(error) {
  const attempt=args.attempt??0;
  if(attempt<4){await ctx.scheduler.runAfter(60000*2**attempt,makeFunctionReference<'action'>('performanceArchive:storeBatch'),{snapshots:args.snapshots,attempt:attempt+1});return;}
  throw error;
 }
}});
