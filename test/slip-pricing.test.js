import test from 'node:test';
import assert from 'node:assert/strict';
import {slipPricing,validSlipOdds} from '../src/lib/slip-pricing.js';
import {shareSlipText} from '../src/lib/slips.js';
test('unpriced selections are retained while only real quoted odds multiply',()=>{
 const items=[{odds:2},{odds:0},{odds:3}];
 assert.deepEqual(slipPricing(items,100,'acca'),{quotedCount:2,unpricedCount:1,totalOdds:6,potentialReturn:600,complete:false});
 assert.equal(slipPricing(items,100,'singles').potentialReturn,500);
 assert.equal(slipPricing([{odds:0}],100).totalOdds,0);
 assert.equal(slipPricing([{odds:0}],100).potentialReturn,0);
 for(const odds of [0,1.01,10000])assert.equal(validSlipOdds(odds),true);
 for(const odds of [-1,1,Infinity,NaN,10001])assert.equal(validSlipOdds(odds),false);
});
test('export explains incomplete prices without inventing fair odds or a full payout',()=>{
 const text=shareSlipText({name:'Mixed',betType:'acca',stake:100,potentialReturn:0,items:[{matchTitle:'A v B',selection:'A',bookmaker:'Book',odds:2},{matchTitle:'C v D',selection:'Over',bookmaker:'Unpriced selection',odds:0}]});
 assert.match(text,/Quoted subset odds: 2.00/);assert.match(text,/Odds: Unpriced/);assert.match(text,/full ticket unknown/);assert.doesNotMatch(text,/Odds: 0.00/);
});
