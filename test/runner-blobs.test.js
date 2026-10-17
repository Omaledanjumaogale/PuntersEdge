import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runnerBlobs} from '../scripts/runner-blobs.mjs';
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
