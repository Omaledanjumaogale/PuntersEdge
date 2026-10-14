"use node";
import {internalAction} from './_generated/server';
import {makeFunctionReference} from 'convex/server';
import {v} from 'convex/values';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {contributionsFor} from '../src/lib/feeds/performance.js';
/** Full pre-match inputs and every market remain compressed for reproducible model research. */
export const storeBatch=internalAction({args:{snapshots:v.optional(v.array(v.string())),storageIds:v.optional(v.array(v.id('_storage'))),attempt:v.optional(v.number())},handler:async(ctx,args)=>{
 const raws=[...(args.snapshots??[])];
 for(const id of args.storageIds??[]){const blob=await ctx.storage.get(id);if(!blob)throw new Error('Archive payload missing');raws.push(gunzipSync(Buffer.from(await blob.arrayBuffer()),{maxOutputLength:16*1024*1024}).toString('utf8'));}
 try { for(const raw of raws){
  const p=JSON.parse(raw);
  const bytes=Buffer.from(JSON.stringify(p));
  const storageId=await ctx.storage.store(new Blob([gzipSync(bytes)],{type:'application/gzip'}));
  const {fixtureId,sport,family,match,league,kickoff,publishedAt,modelVersion,state}=p;
  for(const publication of [p,p.priorPublication].filter(Boolean)){
    const pubId=await ctx.storage.store(new Blob([gzipSync(Buffer.from(JSON.stringify(publication)))],{type:'application/gzip'}));
    await ctx.runMutation(makeFunctionReference<'mutation'>('performance:publication'),{fixtureId,publishedAt:publication.publishedAt,modelVersion:publication.modelVersion,storageId:pubId,...(publication.artifactVersion?{artifactVersion:publication.artifactVersion}:{})});
  }
  const contributions=contributionsFor(p);
  await ctx.runMutation(makeFunctionReference<'mutation'>('performance:record'),{observedAt:p.observedAt??publishedAt,fixtureId,sport,family,match,league,kickoff,publishedAt,modelVersion,state,storageId,contributions,fingerprint:createHash('sha256').update(bytes).digest('hex'),recent:p.selections.filter((s:any)=>s.result&&s.result!=='ungraded').sort((a:any,b:any)=>Number(b.verdict)-Number(a.verdict)).slice(0,20),...(p.finishedAt?{finishedAt:p.finishedAt}:{}),...(p.score?{score:p.score}:{})});
 } for(const id of args.storageIds??[])await ctx.storage.delete(id); } catch(error) {
  const attempt=args.attempt??0;
  if(attempt<4){await ctx.scheduler.runAfter(60000*2**attempt,makeFunctionReference<'action'>('performanceArchive:storeBatch'),{...(args.snapshots?{snapshots:args.snapshots}:{}),...(args.storageIds?{storageIds:args.storageIds}:{}),attempt:attempt+1});return;}
  throw error;
 }
}});
