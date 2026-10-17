import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runTick } from '../src/lib/feeds/runner.js';
import { emptyStore } from '../src/lib/feeds/store.js';
import { current, planJobs } from '../src/lib/feeds/budget.js';
import { mockWorld } from './fixtures/mock-providers.js';

const now = Date.parse('2026-10-12T06:00:00Z');
test('ingest durably reserves concurrent provider calls before network I/O', async () => {
 const world = mockWorld(() => now);
 let durable = {}, writing = false;
 const snapshots = [];
 const result = await runTick({ store: emptyStore(), lookups: {}, ledgers: {}, lastRun: {}, now,
  keys: { apiSports: true, oddsApi: false, oddspapi: false }, sleep: async () => {},
  reserve: async ledger => {
   assert.equal(writing, false, 'durable reservations must be serialized'); writing = true;
   await new Promise(resolve => setTimeout(resolve, 1));
   durable = structuredClone(ledger); snapshots.push(durable); writing = false;
  },
  fetcher: async (provider, url) => {
   const host = new URL(url).host;
   const sport = host.includes('football') ? 'football' : host.includes('basketball') ? 'basketball' : host.includes('nba') ? 'nba' : host.includes('hockey') ? 'hockey' : 'baseball';
   assert.ok(durable[`api-sports:${sport}`].used >= 1, 'network call must follow durable reservation');
   return world.fetcher(provider, url);
  },
 });
 assert.equal(result.log.length,0,'mock provider calls should complete successfully');
 for (const [name, row] of Object.entries(result.ledgers)) assert.equal(durable[name].used, row.used);
 for (let i = 1; i < snapshots.length; i++) {
  for (const [name, row] of Object.entries(snapshots[i])) assert.ok(row.used >= (snapshots[i-1][name]?.used ?? 0));
 }
});
test('failed provider requests remain charged in durable ledgers', async () => {
 let durable = {};
 const result = await runTick({ store: emptyStore(), lookups: {}, ledgers: {}, lastRun: {}, now,
  keys: { apiSports: true, oddsApi: false, oddspapi: false }, sleep: async () => {},
  reserve: async ledger => { durable = structuredClone(ledger); },
  fetcher: async () => { throw new Error('connection lost after request'); },
 });
 for (const name of ['football', 'basketball', 'nba', 'hockey', 'baseball']) {
  assert.ok(result.ledgers[`api-sports:${name}`].used > 0);
  assert.equal(durable[`api-sports:${name}`].used, result.ledgers[`api-sports:${name}`].used);
 }
});
test('free-plan season denials suppress repeated table/odds calls without disabling fixtures', async () => {
 const store=emptyStore(),lookups={},world=mockWorld(() => now);
 const first=await runTick({store,lookups,ledgers:{},lastRun:{},now,keys:{apiSports:true,oddsApi:false,oddspapi:false},sleep:async()=>{},fetcher:world.fetcher});
 let denied=0,games=0;
 const fetcher=async(provider,url)=>{
  const path=new URL(url).pathname;
  if(path==='/standings'||path==='/odds'){denied++;return {status:200,body:{errors:{plan:'Free plans do not have access to this season, try from 2022 to 2024.'}},headers:{get:()=>null}};}
  games++;return world.fetcher(provider,url);
 };
 const second=await runTick({store,lookups,ledgers:first.ledgers,lastRun:first.lastRun,now:now+3600000,keys:{apiSports:true,oddsApi:false,oddspapi:false},sleep:async()=>{},fetcher});
 assert.ok(denied>0 && denied<=5,'at most one season denial per sport is needed');
 const before=denied;
 await runTick({store,lookups,ledgers:second.ledgers,lastRun:second.lastRun,now:now+2*3600000,keys:{apiSports:true,oddsApi:false,oddspapi:false},sleep:async()=>{},fetcher});
 assert.equal(denied,before,'known rejected seasons must not be fetched again today');
 assert.ok(games>0,'date-based fixtures continue refreshing');
});

test('monthly odds allocate coverage across all active sports before extra competitions',()=>{
 const firstDay=Date.parse('2026-10-01T06:00:00Z');
 const jobs=['football','basketball','nba','hockey','baseball'].flatMap((group,g)=>[0,1,2].map(i=>({id:`${group}-${i}`,ledger:'the-odds-api',cost:3,priority:g===0?9:13,group,every:0})));
 const ledgers={'the-odds-api':current('the-odds-api',undefined,firstDay)};
 const planned=planJobs(jobs,ledgers,{},firstDay);
 assert.equal(planned.run.length,2,'Seven-credit daily share under the user cap buys two three-credit calls');
 assert.equal(new Set(planned.run.map(j=>j.group)).size,2,'The first two calls cover different sports before buying extra competitions');
});

test('free-plan date denials do not spend another request on the same unsupported date today',async()=>{
 const store=emptyStore(),lookups={},world=mockWorld(()=>now);let denials=0;
 const fetcher=async(provider,url)=>{
  if(new URL(url).searchParams.get('date')==='2026-10-14'){
   denials++;return {status:200,body:{errors:{plan:'Free plans do not have access to this date, try from yesterday to tomorrow.'}},headers:{get:()=>null}};
  }
  return world.fetcher(provider,url);
 };
 const first=await runTick({store,lookups,now,ledgers:{},lastRun:{},keys:{apiSports:true,oddsApi:false,oddspapi:false},sleep:async()=>{},fetcher});
 assert.equal(denials,5);
 await runTick({store,lookups,now:now+13*3600000,ledgers:first.ledgers,lastRun:first.lastRun,keys:{apiSports:true,oddsApi:false,oddspapi:false},sleep:async()=>{},fetcher});
 assert.equal(denials,5,'unsupported dates remain suppressed when the 12-hour job becomes due');
});

test('provider throttling persists across refreshes and cannot consume repeated quota during cooldown',async()=>{
 const {runTick}=await import('../src/lib/feeds/runner.js');const {emptyStore}=await import('../src/lib/feeds/store.js');const now=Date.parse('2026-10-13T12:00:00Z');const store=emptyStore(),lookups={};let calls=0;
 const options={store,lookups,now,ledgers:{},lastRun:{},keys:{apiSports:true,oddsApi:false,oddspapi:false},sleep:async()=>{},fetcher:async()=>{calls++;return {status:429,body:{message:'Temporarily rate limited'},headers:{get:()=>null}};}};
 const first=await runTick(options);const before=calls;assert.ok(before>0);assert.ok(Object.keys(lookups.providerBackoffs).length>0);
 await runTick({...options,now:now+60000,ledgers:first.ledgers,lastRun:{}});assert.equal(calls,before,'a later refresh respects the persisted host cooldown');
});
