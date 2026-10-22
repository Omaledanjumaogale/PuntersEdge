import test from 'node:test';import assert from 'node:assert/strict';
import {parseGoalSequence,parseCorners} from '../src/lib/feeds/football-observations.js';
import {refreshFootballResearch,cornerFeatures,addResearchMarkets} from '../src/lib/engine/football_research.js';
import {emptyStore,reviveStore} from '../src/lib/feeds/store.js';import {runTick} from '../src/lib/feeds/runner.js';import {settleSnapshot,settleCorners} from '../src/lib/feeds/performance.js';
const now=Date.parse('2026-10-22T20:00:00Z'),DAY=86400000;
const game={uid:'football-as-1',sport:'football',league:'League',homeId:1,awayId:2,home:'Home',away:'Away',kickoff:now-DAY,status:{state:'finished',detail:'FT',home:2,away:1},ext:{as:'1'},odds:{}};
const event=(team,elapsed,detail='Normal Goal')=>({type:'Goal',detail,team:{id:team},time:{elapsed,extra:null}});
test('goal observations reconcile regulation score and reject missing, ambiguous, own-goal and incomplete events',()=>{
 const valid={response:[event(2,5),event(1,20),event(1,90)]};assert.deepEqual(parseGoalSequence(valid,game,now).sides,['away','home','home']);
 for(const response of [[],[event(1,5),event(1,5),event(2,8)],[event(1,4,'Own Goal'),event(1,7),event(2,8)],[event(4,3),event(1,7),event(2,8)]])assert.equal(parseGoalSequence({response},game,now),null);
 assert.equal(parseGoalSequence({...valid,paging:{total:2}},game,now),null);
});
test('corners require both observed numeric counts and FT; missing/null/extra-time never become zero',()=>{
 const body={response:[{team:{id:1},statistics:[{type:'Corner Kicks',value:0}]},{team:{id:2},statistics:[{type:'Corner Kicks',value:5}]}]};assert.equal(parseCorners(body,game,now).home,0);assert.equal(settleCorners('corners:regulation:total:over:9.5',parseCorners(body,game,now)),'lost');assert.equal(parseCorners(body,{...game,status:{...game.status,detail:'AET'}},now),null);body.response[0].statistics[0].value=null;assert.equal(parseCorners(body,game,now),null);
});
test('quota reservations precede research calls; two per tick, six per day; warm successful observations are reused',async()=>{
 const store=emptyStore();for(let i=1;i<=5;i++)store.games['g'+i]={...structuredClone(game),uid:'g'+i,ext:{as:String(i)}};
 let ledger={},last={},reserved=false,research=0;for(let t=0;t<5;t++){const r=await runTick({store,lookups:{},ledgers:ledger,lastRun:last,now:now+t*60000,keys:{apiSports:true,oddsApi:false,oddspapi:false},sleep:async()=>{},reserve:async()=>{reserved=true;},fetcher:async(provider,url)=>{assert.ok(reserved);reserved=false;const u=new URL(url);if(u.pathname==='/fixtures/events'){research++;return {status:200,headers:new Headers(),body:{response:[event(2,5),event(1,20),event(1,70)]}};}if(u.pathname==='/fixtures/statistics'){research++;return {status:200,headers:new Headers(),body:{response:[]}};}return {status:200,headers:new Headers(),body:{response:[]}};}});assert.ok(r.ran.filter(id=>id.includes(':research:')).length<=2);ledger=r.ledgers;last=r.lastRun;}
 assert.ok(research>0&&research<=6);assert.ok(ledger['api-sports:football'].used<=90);assert.deepEqual(reviveStore(store).footballResearch,store.footballResearch);
});
test('training excludes post-kickoff features, respects chronology, and cannot approve a tiny dataset',()=>{
 const store=emptyStore();store.footballResearch={a:{league:'League',kickoff:now-DAY,score:{home:2,away:0},events:{complete:true,scope:'regulation',sides:['home','home'],observedAt:now},pre:{at:now,x:[1,1,.3]}}};const report=refreshFootballResearch(store,now);assert.equal(report.eventSequences,1);assert.ok(report.models.every(m=>!m.approved&&m.trainN===0&&m.validation.n===0));
 const p={family:'football',markets:[]};addResearchMarkets({},p);assert.equal(p.markets.length,0);
});
test('corner features require five prior matches per team, exclude target fixture and later observations',()=>{
 const rs=Array.from({length:5},(_,i)=>({league:'League',kickoff:now-(i+1)*DAY,homeId:1,awayId:2,corners:{home:4,away:6,observedAt:now-10000}}));assert.deepEqual(cornerFeatures(rs,{...game,kickoff:now},now),[1,.4,.6]);assert.equal(cornerFeatures(rs,{...game,kickoff:now},now-20000),null);
});
test('snapshot settles goal sequence and corner markets from verified observations only',()=>{
 const s={family:'football',selections:[{key:'sequence:regulation:two-consecutive:home',odds:0},{key:'corners:regulation:total:over:9.5',odds:0}]};settleSnapshot(s,{...game,goalSequence:{complete:true,scope:'regulation',sides:['away','home','home']},corners:{home:4,away:7,scope:'regulation'}},now);assert.deepEqual(s.selections.map(r=>r.result),['won','won']);
});

test('fitted sequence weights never use outcomes in the later chronological validation partition',()=>{
 const store=emptyStore();for(let i=0;i<500;i++){const won=i%2===0,kickoff=now-(501-i)*DAY;store.footballResearch['r'+i]={league:'League',kickoff,score:{home:2,away:1},events:{complete:true,scope:'regulation',sides:won?['away','home','home']:['home','away','home'],observedAt:kickoff+10800000},pre:{at:kickoff-60000,x:[1,won?1:.1,.4]}};}
 const r=refreshFootballResearch(store,now),m=store.footballResearchModels.find(m=>m.target==='sequence-home');assert.equal(m.trainN,350);assert.equal(m.validation.n,150);const weights=structuredClone(m.weights);
 for(let i=350;i<500;i++)store.footballResearch['r'+i].events.sides=i%2===0?['home','away','home']:['away','home','home'];
 refreshFootballResearch(store,now);const next=store.footballResearchModels.find(m=>m.target==='sequence-home');assert.deepEqual(next.weights,weights);assert.notEqual(next.validation.brier,m.validation.brier);
});

test('saved-slip grading uses authoritative market facts and refuses final-score-only goal-order inference',async()=>{
 const {itemOutcome}=await import('../src/lib/slips.js');const key='sequence:regulation:two-consecutive:home',p={marketKey:key,selection:'Home two consecutive',fixtureStatus:'finished',score:{home:2,away:1}};assert.equal(itemOutcome(p),'ungraded');assert.equal(itemOutcome({...p,settledMarkets:{[key]:'won'}}),'won');
});
