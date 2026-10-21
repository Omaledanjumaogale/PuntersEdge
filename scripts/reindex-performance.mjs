/** Rebuild dimensions from original retained predictions, without refitting or inventing selections. */
import {ConvexHttpClient} from 'convex/browser';import {makeFunctionReference} from 'convex/server';
import {runnerBlobs} from './runner-blobs.mjs';import {parseGzip} from '../src/lib/feeds/ingest-runtime.js';
import {contributionsFor} from '../src/lib/feeds/performance.js';
const client=new ConvexHttpClient(process.env.PUBLIC_CONVEX_URL);client.setAdminAuth(process.env.CONVEX_DEPLOY_KEY);
const blobs=runnerBlobs();let cursor,updated=0,missing=0;
do{const page=await client.query(makeFunctionReference('performance:reindexPage'),cursor?{cursor}:{});
 for(const row of page.page){const bytes=row.blobKey?await blobs.get(row.blobKey):null;if(!bytes){missing++;continue;}const frozen=parseGzip(bytes);if(!Array.isArray(frozen.selections)){missing++;continue;}
 const {_id,_creationTime,...record}=row;record.contributions=contributionsFor(frozen);record.observedAt=Date.now();record.fingerprint=row.fingerprint+':directions-v2';
 await client.mutation(makeFunctionReference('performance:archiveBatch'),{publications:[],records:[record]});updated++;
 }
 cursor=page.isDone?null:page.continueCursor;
}while(cursor);
console.log(JSON.stringify({reindexed:updated,missingArchives:missing,source:'Original pre-match selections and recorded results; no reconstructed picks'}));
