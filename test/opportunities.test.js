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
test('stale, in-play, price-free and probability-sensitive markets cannot earn green',()=>{
 for(const change of [p=>p.status.state='live',p=>p.markets[0].selections[0].pricing='derived',p=>{const s=p.markets[0].selections[0];s.bestOdds=1.6;s.edgePercent=4;}]){const p=fixture();change(p);applyEvidence(p,input(true),now);assert.equal(fixtureOpportunity(p),undefined);assert.equal(p.bestValue,undefined);}
 const p=fixture(),i=input(true);i.quoteSourceAt.Book.homeMoneyline=now-3600000;applyEvidence(p,i,now);assert.equal(fixtureOpportunity(p),undefined);
});
