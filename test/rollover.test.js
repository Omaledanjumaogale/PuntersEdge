import test from 'node:test';import assert from 'node:assert/strict';import {rolloverDay,rolloverTickets,rolloverStreak,rolloverCandidates,rolloverSelectedDay,ROLLOVER_QUOTE_MAX_AGE_MS} from '../src/lib/rollover.js';
const now=Date.parse('2026-10-30T08:00:00Z'),day=rolloverDay(now);
const row=(i,extra={})=>({id:'r'+i,fixtureId:'f'+i,sport:i%2?'football':'nba',matchTitle:'Home '+i+' vs Away '+i,kickoff:now+3600000,state:'scheduled',pricing:'quoted',odds:1.5,quoteObservedAt:now,modelProb:.9,pushProb:0,cohort:{binaryN:100,won:90,strikeRate:.9,interval:{low:.82},push:0,partial:0},...extra});
test('rollover uses Lagos days and never fabricates unpriced or stale target odds',()=>{assert.equal(rolloverDay(Date.parse('2026-10-30T23:30:00Z')),'2026-10-31');const r=rolloverTickets([row(1,{odds:0}),row(2,{quoteObservedAt:now-ROLLOVER_QUOTE_MAX_AGE_MS-1}),row(3,{modelProb:.54})],day,now);assert.ok(r.tickets.every(t=>t.picks.length===0));assert.deepEqual(r.rejected,{unpriced:1,staleQuote:1,insufficientEvidence:1,noEdge:0});});
test('rollover targets are distinct across tickets, deterministically ranked and within real combined odds tolerance',()=>{const rows=Array.from({length:40},(_,i)=>row(i,{odds:[1.25,1.5,2,3][i%4]})),r=rolloverTickets(rows,day,now),ids=[];for(const t of r.tickets){assert.ok(t.picks.length>=2);assert.ok(t.odds>=t.target*.9&&t.odds<=t.target*1.1);assert.ok(Math.abs(t.picks.reduce((p,r)=>p*r.odds,1)-t.odds)<1e-9);for(const p of t.picks)ids.push(p.fixtureId);}assert.equal(ids.length,new Set(ids).size);assert.deepEqual(r,rolloverTickets([...rows].reverse(),day,now));});
test('positive-value mode excludes negative model edge, partial outcomes, started games and other days',()=>{const rows=[row(1,{odds:1.1}),row(2,{pushProb:.1}),row(3,{kickoff:now-1}),row(4,{kickoff:now+86400000})];assert.ok(rolloverTickets(rows,day,now,[],{positiveValueOnly:true}).tickets.every(t=>!t.picks.length));});
test('duplicate provider copies and multiple markets never create repeated event legs',()=>{const rows=Array.from({length:40},(_,i)=>row(i,{matchTitle:'Same Home vs Same Away',sport:i%2?'basketball':'nba'}));assert.ok(rolloverTickets(rows,day,now).tickets.every(t=>!t.picks.length));});
test('daily streaks remain per target and require uninterrupted consecutive wins',()=>{const r=[{day:'2026-10-29',target:2,status:'won'},{day:'2026-10-28',target:2,status:'won'},{day:'2026-10-27',target:2,status:'lost'},{day:'2026-10-30',target:3,status:'won'}];assert.equal(rolloverStreak(r,2,now),2);assert.equal(rolloverStreak(r,3,now),1);assert.equal(rolloverStreak([...r,{day:'2026-10-30',target:2,status:'won'}],2,now),3);assert.equal(rolloverStreak(r.filter(x=>x.day!=='2026-10-29'),2,now),0);assert.equal(rolloverStreak([...r,{day:'2026-10-29',target:5,status:'void'}],5,now),0);});
test('a loss today resets the current streak and frozen tickets reserve their events across refreshes',()=>{assert.equal(rolloverStreak([{day:'2026-10-30',target:2,status:'lost'},{day:'2026-10-29',target:2,status:'won'}],2,now),0);const rows=Array.from({length:30},(_,i)=>row(i,{odds:[1.25,1.5,2,3][i%4]})),saved=[{day,target:2,legs:[rows[0],rows[1]]}],r=rolloverTickets(rows,day,now,saved);assert.equal(r.tickets[0].status,'recorded');assert.ok(r.tickets.every(t=>t.picks.every(p=>p.fixtureId!==rows[0].fixtureId&&p.fixtureId!==rows[1].fixtureId)));});

test('probability-first mode accepts low prices and limited historical cohorts with recorded quote age',()=>{
 const rows=Array.from({length:16},(_,i)=>row(i,{odds:1.1,modelProb:.8,quoteObservedAt:now-12*3600000,cohort:{binaryN:0}}));
 const result=rolloverTickets(rows,day,now);assert.equal(result.eligible,16);assert.ok(result.tickets[0].picks.length>=2);assert.equal(rolloverTickets(rows,day,now,[],{positiveValueOnly:true}).eligible,0);
 assert.equal(rolloverTickets([row(0,{quoteObservedAt:null})],day,now).eligible,0);
});
test('midnight follows Today while preserving explicitly selected history',()=>{
 const before=Date.parse('2026-10-30T22:59:59Z'),after=before+2000;
 assert.equal(rolloverSelectedDay('2026-10-30',before,after),'2026-10-31');assert.equal(rolloverSelectedDay('2026-10-29',before,after),'2026-10-29');
});
test('current canonical quote updates price without changing published probability or renewing unknown timestamps',()=>{
 const signature=JSON.stringify(['full','winner','home',null]);
 const report={upcoming:[{fixtureId:'f',sport:'football',kickoff:now+3600000,publishedAt:now-1000,rows:[{key:'home',signature,modelProb:.83,pricing:'derived',odds:0,quoteObservedAt:now-1000}]}],groups:{}};
 const games=new Map([['f',{status:{state:'scheduled'}}]]),predictions=new Map([['f',{markets:[{selections:[{id:'f:home',pricing:'quoted',bestOdds:1.4,bookmaker:'Book',quoteObservedAt:now-3000}]}]}]]);
 const r=rolloverCandidates(report,predictions,games,new Map(),now);assert.equal(r.length,1);assert.equal(r[0].odds,1.4);assert.equal(r[0].modelProb,.83);assert.equal(r[0].quoteObservedAt,now-3000);assert.equal(r[0].cohort.binaryN,0);
 predictions.get('f').markets[0].selections[0].quoteObservedAt=null;const missing=rolloverCandidates(report,predictions,games,new Map(),now);assert.equal(missing[0].quoteObservedAt,null);
 games.get('f').status.state='finished';assert.equal(rolloverCandidates(report,predictions,games,new Map(),now).length,0);
});

test('football total aliases retain the timestamp of their actual bookmaker market',()=>{
 const signature=JSON.stringify(['full','match-total','over',2.5]),fixture={fixtureId:'f',sport:'football',kickoff:now+3600000,publishedAt:now-1000,rows:[{key:'over25',signature,modelProb:.75,pricing:'derived'}]};
 const predictions=new Map([['f',{markets:[{selections:[{id:'f:o2.5',pricing:'quoted',bestOdds:1.6,bookmaker:'Book'}]}]}]]),games=new Map([['f',{status:{state:'scheduled'}}]]),inputs=new Map([['f',{quoteFetchedAt:{Book:{over25:now-1000}},quoteSourceAt:{Book:{over25:now-2000}}}]]);
 const [r]=rolloverCandidates({upcoming:[fixture],groups:{}},predictions,games,inputs,now);assert.equal(r.odds,1.6);assert.equal(r.quoteObservedAt,now-2000);assert.equal(r.quotedSelectionId,'f:o2.5');
});
