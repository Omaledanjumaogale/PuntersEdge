import test from 'node:test';import assert from 'node:assert/strict';
import {itemOutcome} from '../src/lib/slips.js';
import {contributionsFor} from '../src/lib/feeds/performance.js';
import {validateSlipSize} from '../src/lib/slip-pricing.js';
for(const sport of ['football','basketball','nba','hockey','baseball'])test(`${sport} saved projections settle totals, team totals, handicaps and observed periods`,()=>{
 const pick={sport,selection:'Saved option',fixtureStatus:'finished',score:{home:3,away:1}};
 for(const [key,result] of [['total:over:3.5','won'],['total:under:3.5','lost'],['home:over:2.5','won'],['home:under:2.5','lost'],['away:under:1.5','won'],['handicap:home:-1.5','won']])assert.equal(itemOutcome({...pick,marketKey:'forecast:full:'+key}),result);
 assert.equal(itemOutcome({...pick,marketKey:'period:first_half:total:under:1.5'}),'ungraded');
 assert.equal(itemOutcome({...pick,marketKey:'period:first_half:total:under:1.5',periodScores:{first_half:{home:0,away:1}}}),'won');
});
test('all settled PASS and unpriced directions count independently of featured verdict',()=>{
 const rows=[{key:'forecast:full:total:over:2.5',market:'Total projection',selection:'Over 2.5',result:'won'},{key:'forecast:full:home:under:1.5',market:'Home team total',selection:'Home Under 1.5',result:'lost'}].map(s=>({...s,modelProb:.6,marketProb:.6,grade:'PASS',pricing:'derived',scope:'full',verdict:false}));
 const groups=contributionsFor({selections:rows,kickoff:Date.now(),modelVersion:'test'});assert.equal(groups.summary.n,2);assert.equal(groups.summary.quotedN,0);assert.equal(groups.verdict,undefined);assert.equal(groups['directions:'+encodeURIComponent('full · Match total · Over')].won,1);assert.equal(groups['directions:'+encodeURIComponent('full · Team total · Under')].lost,1);
});
test('ticket capacity uses bytes rather than a 30 or 100 selection ceiling',()=>{assert.doesNotThrow(()=>validateSlipSize(Array.from({length:350},(_,id)=>({id,selection:'Under 2.5'}))));assert.throws(()=>validateSlipSize([{selection:'x'.repeat(710000)}]),/storage size budget/);});
