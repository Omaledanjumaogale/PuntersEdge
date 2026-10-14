import test from 'node:test';
import assert from 'node:assert/strict';
import {applyEvidence} from '../src/lib/engine/evidence.js';
import {fixtureOpportunity} from '../src/lib/engine/opportunities.js';
const now=Date.parse('2026-10-14T18:00:00Z');
function fixture(){return {fixtureId:'f',kickoffTime:new Date(now+3600000).toISOString(),status:{state:'scheduled'},markets:[{selections:[
 {id:'f:homeMl',market:'Moneyline',selection:'Home',bookmaker:'Book',modelProb:.65,marketProb:.58,bestOdds:1.8,edgePercent:17,pushProb:0,pricing:'quoted',grade:'A',kellyStakePercent:1},
 {id:'f:awayMl',market:'Moneyline',selection:'Away',bookmaker:'Book',modelProb:.35,marketProb:.42,bestOdds:2.2,edgePercent:-23,pushProb:0,pricing:'quoted',grade:'PASS',kellyStakePercent:0}
 ]}]};}
function input(approved=false){return {analysisEvidence:{approved,independent:true,domainSupported:true,approvedMarkets:['Moneyline']},quoteSourceAt:{Book:{homeMoneyline:now-1000,awayMoneyline:now-1000}}};}
test('green estimate ranks all options without promoting an unvalidated recommendation',()=>{
 const p=fixture();applyEvidence(p,input(),now);const s=fixtureOpportunity(p);
 assert.ok(s.opportunity.green);assert.equal(s.opportunity.validated,false);assert.equal(s.grade,'PASS');assert.equal(s.kellyStakePercent,0);assert.equal(p.bestValue,undefined);
 assert.equal(s.opportunity.compared,2);assert.equal(s.opportunity.rank,1);assert.match(s.opportunity.note,/validation is pending/);assert.match(s.opportunity.note,/five probability points/);
});
test('validated grade, fixture indicator and executable verdict agree',()=>{
 const p=fixture();applyEvidence(p,input(true),now);const s=fixtureOpportunity(p);assert.equal(s.opportunity.validated,true);assert.equal(s.grade,s.opportunity.grade);assert.equal(p.bestValue.id,s.id);
});
test('new retrieval never makes an explicitly old source quote fresh',()=>{
 const p=fixture(),i=input(true);i.quoteSourceAt.Book.homeMoneyline=now-86400000;
 i.quoteFetchedAt={Book:{homeMoneyline:now,awayMoneyline:now}};
 applyEvidence(p,i,now);assert.equal(fixtureOpportunity(p).opportunity.kind,'projection');assert.equal(p.bestValue,undefined);assert.equal(p.markets[0].selections[0].quoteObservedAt,now-86400000);
});
test('projection leans remain useful while live, stale or missing prices never enable a stake',()=>{
 const live=fixture();live.status.state='live';applyEvidence(live,input(true),now);assert.equal(fixtureOpportunity(live),undefined);
 for(const change of [p=>p.markets[0].selections[0].pricing='derived',p=>{const s=p.markets[0].selections[0];s.bestOdds=1.6;s.edgePercent=4;}]){const p=fixture();change(p);applyEvidence(p,input(true),now);assert.equal(fixtureOpportunity(p).opportunity.kind,'projection');assert.equal(p.bestValue,undefined);}
 const p=fixture(),i=input(true);i.quoteSourceAt.Book.homeMoneyline=now-3600000;applyEvidence(p,i,now);assert.equal(fixtureOpportunity(p).opportunity.kind,'projection');assert.equal(p.bestValue,undefined);
});
test('OddsPapi keeps per-price change provenance and excludes suspended quotes',async()=>{
 const {parseOddspapiOdds}=await import('../src/lib/feeds/oddspapi.js');
 const at=new Date(now).toISOString(),defs={m:{kind:'ml',line:0,outcomes:{h:'home',a:'away'}}};
 const f={fixtureId:1,sportId:11,tournamentId:1,participant1Id:1,participant2Id:2,startTime:new Date(now+3600000).toISOString(),bookmakerOdds:{book:{markets:{m:{outcomes:{h:{players:{'0':{price:1.8,active:true,bookmakerChangedAt:at}}},a:{players:{'0':{price:2.1,active:true,changedAt:at}}}}}}}}};
 const parse=()=>parseOddspapiOdds([f],defs,{book:'Book'},()=> 'basketball')[0].odds;
 assert.equal(parse().Book.__source_homeMoneyline,now);assert.equal(parse().Book.__source_awayMoneyline,now);
 f.bookmakerOdds.book.suspended=true;assert.deepEqual(parse(),{Book:{__inactive:1}});
 f.bookmakerOdds.book.suspended=false;f.bookmakerOdds.book.markets.m.marketActive=false;assert.deepEqual(parse(),{Book:{__inactive:1}});
});

test('suspended quote withdrawal removes a previously cached bookmaker',async()=>{
 const {emptyStore,attachOdds}=await import('../src/lib/feeds/store.js');const store=emptyStore();const event={id:'1',sport:'nba',home:'A',away:'B',league:'NBA',kickoff:now+3600000,odds:{Book:{homeMoneyline:1.8,awayMoneyline:2.1}}};
 attachOdds(store,'op',[event],now);assert.ok(Object.values(store.games)[0].odds.Book);
 attachOdds(store,'op',[{...event,odds:{Book:{__inactive:1}}}],now+1000);assert.equal(Object.values(store.games)[0].odds.Book,undefined);
});
