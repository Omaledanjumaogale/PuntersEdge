/** Rebuild dimensions from original retained predictions, without refitting or inventing selections. */
import {ConvexHttpClient} from 'convex/browser';import {makeFunctionReference} from 'convex/server';
import {runnerBlobs} from './runner-blobs.mjs';import {parseGzip} from '../src/lib/feeds/ingest-runtime.js';
import {contributionsFor} from '../src/lib/feeds/performance.js';
const client=new ConvexHttpClient(process.env.PUBLIC_CONVEX_URL);client.setAdminAuth(process.env.CONVEX_DEPLOY_KEY);
const blobs=runnerBlobs();let cursor,updated=0,missing=0,changedDuringRead=0;
do{const page=await client.query(makeFunctionReference('performance:reindexPage'),cursor?{cursor}:{});
 for(let start=0;start<page.page.length;start+=20){const rows=[];
  const source=page.page.slice(start,start+20);
  for(let offset=0;offset<source.length;offset+=4){const inputs=await Promise.all(source.slice(offset,offset+4).map(async row=>{const bytes=row.blobKey?await blobs.get(row.blobKey):null;if(!bytes){missing++;return null;}const frozen=parseGzip(bytes);if(!Array.isArray(frozen.selections)){missing++;return null;}return {fixtureId:row.fixtureId,expectedFingerprint:row.fingerprint,contributions:contributionsFor(frozen)};}));rows.push(...inputs.filter(Boolean));}
  if(rows.length){const accepted=await client.mutation(makeFunctionReference('performance:reindexBatch'),{rows});updated+=accepted;changedDuringRead+=rows.length-accepted;}
 }
 console.log(JSON.stringify({progress:true,reindexed:updated,missingArchives:missing,changedDuringRead}));
 cursor=page.isDone?null:page.continueCursor;
}while(cursor);
console.log(JSON.stringify({reindexed:updated,missingArchives:missing,changedDuringRead,source:'Original pre-match selections and recorded results; no reconstructed picks'}));
