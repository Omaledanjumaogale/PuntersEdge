import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runnerBlobs} from '../scripts/runner-blobs.mjs';
import {publishIngestOutputs} from '../scripts/ingest-publication.mjs';
const env={CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_API_TOKEN:'test-token'};
test('scheduled R2 operations use the control API and preserve gzip bytes without a Worker hop',async()=>{
 const requests=[],bytes=new Uint8Array([31,139,1]);
 const blobs=runnerBlobs(env,{fetcher:async(url,options)=>{requests.push({url,options});return new Response(options.method==='GET'?bytes:null,{status:200});}});
 assert.deepEqual(await blobs.get('preview/current.gz'),bytes);
 await blobs.put('archives/tennis/model.gz',bytes);await blobs.delete('archives/old.gz');
 assert.equal(requests.length,3);
 assert.ok(requests.every(r=>new URL(r.url).hostname==='api.cloudflare.com'));
 assert.equal(requests[0].options.redirect,'error');
 assert.equal(requests[1].options.headers['Content-Type'],'application/gzip');
 await assert.rejects(blobs.get('state/../feed/x.gz'),/Invalid data key/);
});
test('R2 authorization failures fail closed and partial configuration never falls back',async()=>{
 assert.throws(()=>runnerBlobs({...env,CLOUDFLARE_ACCOUNT_ID:undefined}),/incomplete/);
 const blobs=runnerBlobs(env,{fetcher:async()=>new Response('sensitive provider message',{status:403})});
 await assert.rejects(blobs.get('state/a.gz'),error=>error.message.includes('(403)')&&!error.message.includes('sensitive'));
 const missing=runnerBlobs(env,{fetcher:async()=>new Response(null,{status:404})});
 assert.equal(await missing.get('state/missing.gz'),null);
});
test('R2 retries transient failures with bounded backoff and identical upload bytes',async()=>{
 const bytes=new Uint8Array([31,139,2]),delays=[],bodies=[];let calls=0;
 const blobs=runnerBlobs(env,{sleep:async ms=>delays.push(ms),fetcher:async(_url,options)=>{calls++;bodies.push([...new Uint8Array(options.body)]);if(calls===1)throw new DOMException('private token must never be logged','TimeoutError');if(calls===2)return new Response('temporary',{status:503});return new Response(null,{status:200});}});
 await blobs.put('state/retry.gz',bytes);assert.equal(calls,3);assert.deepEqual(delays,[1000,3000]);assert.deepEqual(bodies,[...Array(3)].map(()=>[...bytes]));
});
test('R2 stops after three network failures without revealing the original error',async()=>{
 let calls=0;const blobs=runnerBlobs(env,{sleep:async()=>{},fetcher:async()=>{calls++;throw Error('private token');}});
 await assert.rejects(blobs.get('state/retry.gz'),error=>error.message.includes('3 attempts')&&!error.message.includes('private token'));assert.equal(calls,3);
});
test('R2 retries interrupted downloads, respects capped rate-limit delay, and accepts repeated deletes',async()=>{
 let calls=0;const delays=[],bytes=new Uint8Array([31,139,4]);const blobs=runnerBlobs(env,{sleep:async ms=>delays.push(ms),fetcher:async()=>{calls++;if(calls===1)return new Response(null,{status:429,headers:{'Retry-After':'100'}});if(calls===2)return new Response(new ReadableStream({start(controller){controller.error(Error('interrupted'));}}));return new Response(bytes);}});
 assert.deepEqual(await blobs.get('state/retry.gz'),bytes);assert.deepEqual(delays,[30000,3000]);assert.equal(calls,3);
 let deletes=0;const removal=runnerBlobs(env,{sleep:async()=>{},fetcher:async()=>{if(++deletes===1)throw new DOMException('lost response','TimeoutError');return new Response(null,{status:404});}});await removal.delete('state/retired.gz');assert.equal(deletes,2);
});
test('evidence publication failure does not block the public preview or hide the failed stage',async()=>{
 const phases=[];let previews=0;const result=await publishIngestOutputs({refreshEvidence:async()=>{throw new DOMException('private details','TimeoutError');},publishPreview:async()=>{previews++;return {published:true};},progress:p=>phases.push(p)});
 assert.equal(previews,1);assert.deepEqual(result.failedStages,['evidence_catalog']);assert.deepEqual(result.evidence,{failed:true,errorType:'TimeoutError'});assert.equal(result.publicPreview.published,true);assert.deepEqual(phases,['evidence_catalog','public_preview']);assert.ok(!JSON.stringify(result).includes('private details'));
});
