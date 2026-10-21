import test from 'node:test';import assert from 'node:assert/strict';import {buildBasketballMarkets} from '../src/lib/engine/market_book.js';
const input={fixtureId:'nba-direction',sport:'nba',homeTeam:'Falcons',awayTeam:'Bears',league:'NBA',odds:{Book:{homeMoneyline:1.9,awayMoneyline:1.9,totalLine:220.5,overOdds:1.9,underOdds:1.9}}};
test('basketball totals preserve both sides and favour Under or Over according to the score projection',()=>{
 for(const [total,side] of [[200,'Under'],[240,'Over']]){
  const markets=buildBasketballMarkets(input,{margin:0,total,marginSd:14,totalSd:19},{modelWeight:.8,kellyFraction:.25});
  const pair=markets.find(g=>g.key==='total').selections.filter(s=>s.id.endsWith('220.5'));
  assert.equal(pair.length,2);assert.ok(Math.abs(pair[0].modelProb+pair[1].modelProb-1)<1e-9);
  const best=[...pair].sort((a,b)=>b.modelProb-a.modelProb)[0];assert.ok(best.selection.startsWith(side));
  assert.ok(best.edgePercent>25);assert.equal(best.eligible,false);assert.equal(best.grade,'PASS');assert.equal(best.kellyStakePercent,0);
 }
});
