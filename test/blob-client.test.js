import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blobClient} from '../src/lib/feeds/blob-client.js';
test('machine writes and deletes carry same-origin CSRF metadata as well as their credential',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return new Response(null,{status:204});};
 try{
  const client=blobClient('https://example.test','test-only-credential');
  await client.put('state/abc.gz',new Uint8Array([1]));await client.delete('outbox/abc.gz');
  assert.deepEqual(calls.map(call=>call.options.method),['PUT','DELETE']);
  for(const call of calls){assert.equal(call.options.headers.Origin,'https://example.test');assert.equal(call.options.headers.Authorization,'Bearer test-only-credential');}
 }finally{globalThis.fetch=original;}
});
