import test from 'node:test';import assert from 'node:assert/strict';import {startEvidenceRefresh} from '../src/lib/evidence-refresh.js';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(refresh){let time=0,tick;const target=new EventTarget(),doc=Object.assign(new EventTarget(),{hidden:false}),timers={setInterval:fn=>(tick=fn,1),clearInterval:()=>tick=()=>{}};const stop=startEvidenceRefresh({refresh,canRefresh:()=>true,now:()=>time,target,doc,timers});return {target,doc,stop,advance:async ms=>{time+=ms;tick();await flush();}};}
test('visible evidence retries on its own after a failed request without feed changes',async()=>{
 let calls=0;const h=harness(async()=>{calls++;if(calls===1)throw Error('offline');});await h.advance(300000);assert.equal(calls,1);await h.advance(30000);assert.equal(calls,1);await h.advance(270000);assert.equal(calls,2);h.stop();await h.advance(300000);assert.equal(calls,2);
});
test('hidden tabs stop polling and resume on visibility or network recovery without overlapping requests',async()=>{
 let calls=0,resolve;const h=harness(()=>{calls++;return new Promise(r=>resolve=r);});h.doc.hidden=true;await h.advance(300000);assert.equal(calls,0);h.doc.hidden=false;h.doc.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(calls,1);h.target.dispatchEvent(new Event('online'));await h.advance(300000);assert.equal(calls,1);resolve();await flush();h.target.dispatchEvent(new Event('focus'));await flush();assert.equal(calls,2);resolve();await flush();h.stop();h.target.dispatchEvent(new Event('focus'));assert.equal(calls,2);
});
