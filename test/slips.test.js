import test from 'node:test';
import assert from 'node:assert/strict';
import { itemOutcome, settlementKey, slipOutcome, shareSlipText } from '../src/lib/slips.js';
const pick = (marketKey, score, extra = {}) => ({selection:'Home Win',sport:'football',marketKey,fixtureStatus:'finished',score,...extra});
test('saved selections settle stable market keys and preserve regulation semantics', () => {
 assert.equal(itemOutcome(pick('home',{home:2,away:1})), 'won');
 assert.equal(itemOutcome(pick('over25',{home:2,away:1})), 'won');
 assert.equal(itemOutcome(pick('u2.5',{home:2,away:1})), 'lost');
 assert.equal(itemOutcome(pick('home',{home:2,away:1,regHome:1,regAway:1})), 'lost');
 assert.equal(itemOutcome(pick('regH',{home:2,away:1},{family:'hockey'})), 'ungraded');
 assert.equal(itemOutcome(pick('regX',{home:2,away:1,regHome:1,regAway:1},{family:'hockey'})), 'won');
 assert.equal(itemOutcome(pick('homeMl',{home:100,away:95},{sport:'nba'})), 'won');
});
test('unsupported saved selections remain ungraded and postponed games remain pending', () => {
 assert.equal(itemOutcome(pick(undefined,{home:2,away:1})), 'ungraded');
 assert.equal(itemOutcome(pick('unknown',{home:2,away:1})), 'ungraded');
 assert.equal(itemOutcome(pick('home',{home:2,away:1},{fixtureStatus:'postponed'})), 'pending');
 assert.equal(itemOutcome(pick('home',undefined,{fixtureStatus:'cancelled'})), 'void');
});
test('spread and total keys retain the exact saved line', () => {
 assert.equal(settlementKey(pick('homeSpread',undefined,{selection:'Home -3.5'})), 'sph-3.5');
 assert.equal(itemOutcome(pick('homeSpread',{home:101,away:98},{sport:'basketball',selection:'Home -3.5'})), 'lost');
 assert.equal(itemOutcome(pick('over',{home:101,away:98},{sport:'basketball',selection:'Over 199'})), 'push');
 assert.equal(settlementKey(pick('homeSpread',undefined,{selection:'Home spread'})), null);
});
test('accumulator and singles outcomes differ and fractional wins remain partial', () => {
 const won=pick('home',{home:2,away:1}),lost=pick('away',{home:2,away:1});
 assert.equal(slipOutcome([won,lost],'acca'), 'lost');
 assert.equal(slipOutcome([won,lost],'singles'), 'mixed');
 assert.equal(slipOutcome([pick('ahh-0.25',{home:1,away:1})]), 'partial');
 assert.equal(slipOutcome([pick('dnbh',{home:1,away:1})]), 'void');
});
test('share content includes recorded odds, named slip and retained final score', () => {
 const text=shareSlipText({name:'Weekend',betType:'singles',stake:1000,potentialReturn:2100,items:[{...pick('home',{home:2,away:1}),matchTitle:'Home v Away',bookmaker:'Book',odds:2.1}]});
 assert.match(text,/Weekend/);assert.match(text,/2\.10/);assert.match(text,/Score: 2-1 · won/);assert.match(text,/NGN 1,000 per selection/);assert.match(text,/does not place bets/);
});

test('share and PDF source text explain grading with differing regulation scores', () => {
 const text=shareSlipText({name:'Cup',betType:'acca',stake:1000,potentialReturn:2100,items:[{...pick('home',{home:3,away:3,regHome:1,regAway:1}),matchTitle:'Home v Away',bookmaker:'Book',odds:2.1}]});
 assert.match(text,/Score: 3-3 \(regulation 1-1\) · lost/);
});
