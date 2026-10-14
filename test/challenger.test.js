import test from 'node:test';
import assert from 'node:assert/strict';
import { footballChallenger, challengerDecision } from '../src/lib/engine/challenger.js';
const artifact = {version:'candidate-1',league:'L',trainedThrough:'2026-01-01T00:00:00Z',intercept:Math.log(1.4),homeAdvantage:0,rho:-.06,teams:{a:{attack:0,defence:0},b:{attack:0,defence:0}}};
const fixture = {fixtureId:'f',league:'L',homeId:'a',awayId:'b',predictedAt:'2026-02-01T10:00:00Z',kickoff:'2026-02-01T12:00:00Z'};
test('trained challenger preserves normalized symmetric 1X2 and remains shadow',()=>{
 const r=footballChallenger(artifact,fixture);const p=r.probabilities.oneXTwo;
 assert.ok(Math.abs(p.home+p.draw+p.away-1)<1e-10);assert.ok(Math.abs(p.home-p.away)<1e-10);assert.equal(r.recommendation,'PASS');
});
test('future training, wrong league and unknown teams cannot produce eligible forecasts',()=>{
 assert.throws(()=>footballChallenger({...artifact,trainedThrough:fixture.predictedAt},fixture));
 assert.throws(()=>footballChallenger(artifact,{...fixture,league:'other'}));
 assert.equal(footballChallenger(artifact,{...fixture,homeId:'missing'}).reason,'unseen_team');
 assert.equal(footballChallenger({...artifact,rho:1},fixture).reason,'invalid_dependence_for_fixture');
});
const selection={...fixture,modelVersion:'candidate-1',market:'1x2',rules:'90min',probability:.8,lowerProbability:.7,pushProbability:0,odds:1.6,pricing:'quoted',quoteObservedAt:'2026-02-01T09:59:00Z',independent:true,dataComplete:true};
const policy={approved:true,version:'candidate-1',league:'L',market:'1x2',rules:'90min',maxQuoteAgeMs:120000,minProbability:.65,minLowerEV:.02};
test('validation, freshness, independence and uncertainty are required',()=>{
 assert.equal(challengerDecision(selection,policy).action,'ELIGIBLE');
 for(const patch of [{independent:false},{pricing:'derived'},{lowerProbability:.5},{dataComplete:false},{quoteObservedAt:'2026-02-01T08:00:00Z'}]) assert.equal(challengerDecision({...selection,...patch},policy).action,'PASS');
 assert.equal(challengerDecision(selection,{...policy,version:'wrong'}).action,'PASS');
 assert.equal(challengerDecision(selection,{}).action,'PASS');
});
test('push is separated from conditional win probability and expected value',()=>{
 const r=challengerDecision({...selection,pushProbability:.2},policy);
 assert.ok(Math.abs(r.successProbability-.64)<1e-12);assert.ok(Math.abs(r.expectedValue-.224)<1e-12);
});
