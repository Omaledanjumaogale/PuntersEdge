import {test}from'node:test';import assert from'node:assert/strict';
import {executeIngest,gzipJson,parseGzip,compactSnapshot}from'../src/lib/feeds/ingest-runtime.js';
import {emptyStore}from'../src/lib/feeds/store.js';import {FOOTBALL_INPUTS}from'../src/lib/data/fixtures.js';
const now=Date.parse('2026-10-16T06:00:00Z');
function harness(){
 const store=emptyStore(),input=FOOTBALL_INPUTS[0];store.games.fixture={uid:'fixture',sport:'football',home:input.homeTeam,away:input.awayTeam,league:'Test',kickoff:now+86400000,status:{state:'scheduled'},odds:Object.fromEntries(Object.entries(input.odds).map(([k,v])=>[k,{...v,at:now}])),ext:{as:'fixture'},updated:now};
 const files=new Map([['state/initial.gz',gzipJson(store)]]),calls=[],state={storeKey:'state/initial.gz',ledgers:{},lastRun:{}};
 let failArchive=false;
 const rpc={query:async()=>[],action:async(name,args)=>{calls.push([name,args]);},mutation:async(name,args)=>{
 calls.push([name,args]);if(name==='feed:claim')return structuredClone(state);if(name==='performance:archiveBatch'&&failArchive)throw Error('Simulated archive outage');
 if(name==='feed:commitEdge')Object.assign(state,args,{feedVersion:args.version});if(name==='feed:ackArchive'&&state.pendingArchiveKey===args.key)delete state.pendingArchiveKey;
 }};
 const blobs={get:async key=>files.get(key)??null,put:async(key,bytes)=>{files.set(key,bytes);return key;},delete:async key=>files.delete(key)};
 const run=at=>executeIngest({rpc,blobs,keys:{apiSports:'',oddsApi:'',oddspapi:''},now:at,publicFetcher:async()=>({}),sleep:async()=>{}});
 return{run,state,files,calls,setFail:value=>{failArchive=value;}};
}
test('unchanged forecasts do not republish every half hour, and hot copies omit archived prose',async()=>{
 const h=harness();const first=await h.run(now);assert.equal(first.archiveChanges,1);
 const stored=parseGzip(h.files.get(h.state.storeKey));assert.ok(stored.projections.fixture.selections.every(s=>!('opportunity'in s)&&!('eligibilityReasons'in s)));
 const evidence=[...h.files.entries()].filter(([key])=>key.startsWith('archives/'));assert.ok(evidence.length);assert.ok(parseGzip(evidence[0][1]).selections.some(s=>s.eligibilityReasons));
 const second=await h.run(now+30*60000);assert.equal(second.archiveChanges,0);assert.equal(h.calls.filter(([name])=>name==='performance:archiveBatch').length,1);
});
test('archive outbox survives commit failure and is replayed before processing new results',async()=>{
 const h=harness();h.setFail(true);await assert.rejects(h.run(now),/archive outage/);assert.ok(h.state.pendingArchiveKey);const key=h.state.pendingArchiveKey;assert.ok(h.files.has(key));
 h.setFail(false);await h.run(now+30*60000);assert.equal(h.state.pendingArchiveKey,undefined);assert.equal(h.files.has(key),false);
});
test('hot-copy compaction preserves settlement fields and original immutable snapshot',()=>{
 const p={fixtureId:'x',priorPublication:{publishedAt:1},publicationHistory:[1],selections:[{key:'home',modelProb:.7,grade:'A',result:'won',opportunity:{note:'frozen'},eligibilityReasons:['frozen']}],input:{ratings:{homeMean:2}}};
 const compact=compactSnapshot(p);assert.equal(compact.selections[0].modelProb,.7);assert.equal(compact.selections[0].result,'won');assert.equal(p.selections[0].opportunity.note,'frozen');assert.equal(compact.priorPublication,undefined);
});
