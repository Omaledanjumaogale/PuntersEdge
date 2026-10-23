import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyStore,prune,upsertGames,attachApiSportsOdds} from '../src/lib/feeds/store.js';
import {updateRecord,buildFeed} from '../src/lib/feeds/build.js';
import {contributionsFor,statsOf,addCounters,emptyCounters,REVIEW_MS} from '../src/lib/feeds/performance.js';
import {FOOTBALL_INPUTS} from '../src/lib/data/fixtures.js';

const now=Date.parse('2026-10-12T06:00:00Z');
test('only published pre-match projections settle; inputs freeze before results and review expires after 24h',()=>{
 const store=emptyStore(),input=FOOTBALL_INPUTS[0];
 const game={uid:'football-test-1',sport:'football',home:input.homeTeam,away:input.awayTeam,league:'Test League',kickoff:now+3600000,status:{state:'scheduled'},ext:{as:'1'},odds:Object.fromEntries(Object.entries(input.odds).map(([book,prices])=>[book,{...prices,at:now}])),updated:now};
 store.games[game.uid]=game;
 store.record.settled.push({uid:'unpublished-old',kickoff:now});
 const created=updateRecord(store,now);
 assert.equal(created.length,1);assert.ok(created[0].selections.length>20);
 const frozen=JSON.stringify(created[0].input);
 game.status={state:'finished',home:2,away:1};
 const settled=updateRecord(store,now+3*3600000);
 assert.equal(settled.length,1);assert.equal(JSON.stringify(settled[0].input),frozen);
 assert.ok(settled[0].selections.every(s=>s.result));
 assert.equal(store.record.settled.some(p=>p.uid==='unpublished-old'),false);
 const end=settled[0].finishedAt;
 assert.equal(REVIEW_MS,24*3600000);
 assert.ok(buildFeed(store,end+23*3600000).reviewInputs[game.uid]);
 const delayed=structuredClone(store);delayed.games[game.uid].kickoff=end-4*86400000;
 assert.ok(buildFeed(delayed,end+23*3600000).games.some(g=>g.id===game.uid),'recently received final results survive old kickoff dates');
 assert.ok(buildFeed(store,end+REVIEW_MS-1).reviewInputs[game.uid]);
 assert.equal(buildFeed(store,end+REVIEW_MS).reviewInputs[game.uid],undefined);
 const previous=store.record.settled.length;
 prune(store,end+REVIEW_MS);updateRecord(store,end+REVIEW_MS);
 assert.equal(store.record.settled.length,previous,'settled track record survives projection review expiry');
});
test('first-seen finished fixtures never become retrospective model predictions',()=>{
 const store=emptyStore();store.games.done={uid:'done',sport:'football',home:'A',away:'B',league:'Test',kickoff:now-3600000,status:{state:'finished',home:1,away:0},odds:{},ext:{as:'done'},updated:now};
 assert.deepEqual(updateRecord(store,now),[]);assert.equal(Object.keys(store.projections).length,0);
 store.games.done.status.state='live';assert.deepEqual(updateRecord(store,now),[],'a first-seen live fixture is not a pre-match forecast');
});
test('calibration excludes pushes/half-results; ROI only uses quoted prices; corrections replace counters',()=>{
 const p={kickoff:now,selections:[
 {market:'Result',grade:'A',modelProb:.8,marketProb:.6,result:'won',profit:1,pricing:'quoted',verdict:true},
 {market:'Total',grade:'B',modelProb:.7,marketProb:.6,result:'lost',profit:-1,pricing:'derived'},
 {market:'Asian',grade:'B',modelProb:.7,marketProb:.6,result:'push',profit:0,pricing:'quoted'},
 {market:'Asian',grade:'B',modelProb:.7,marketProb:.6,result:'half-won',profit:.5,pricing:'quoted'}]};
 const c=contributionsFor(p).summary,s=statsOf(c);
 assert.equal(s.n,4);assert.equal(s.binary,2);assert.equal(s.strikeRate,50);assert.equal(s.roi,50);assert.ok(Math.abs(s.brier-.265)<1e-9);
 assert.equal(contributionsFor(p).verdict.won,1);
 assert.ok(contributionsFor({...p,finishedAt:Date.parse('2026-10-12T23:30:00Z')})['days:2026-10-13'],'daily stats use Africa/Lagos result-receipt date');
 const total=addCounters(emptyCounters(),c);addCounters(total,c,-1);assert.equal(statsOf(total).n,0);assert.equal(statsOf(total).strikeRate,null);
});

test('provider merging preserves published identity and settles exactly one analysis record',()=>{
 const store=emptyStore(),input=FOOTBALL_INPUTS[0];
 const game={uid:'football-toa-initial',sport:'football',home:input.homeTeam,away:input.awayTeam,league:'Test',kickoff:now+3600000,status:{state:'scheduled'},ext:{toa:'initial'},odds:Object.fromEntries(Object.entries(input.odds).map(([book,prices])=>[book,{...prices,at:now}])),updated:now};
 store.games[game.uid]=game;updateRecord(store,now);
 const incoming={id:'real-api-id',sport:'football',home:game.home,away:game.away,league:'Test',kickoff:game.kickoff,status:{state:'finished',home:2,away:1}};
 upsertGames(store,[incoming],now+2*3600000);upsertGames(store,[incoming],now+3*3600000);
 assert.equal(Object.keys(store.games).length,1);assert.equal(store.games[game.uid].ext.as,'real-api-id');
 assert.equal(attachApiSportsOdds(store,'football',{'real-api-id':{Example:{home:2}}},now),1);
 updateRecord(store,now+3*3600000);
 assert.equal(Object.keys(store.projections).length,1);assert.equal(store.projections[game.uid].state,'finished');
});

test('grade changes are retained without changing the original published grades',()=>{
 const store=emptyStore(),input=FOOTBALL_INPUTS[0];
 const game={uid:'grade-change',sport:'football',home:input.homeTeam,away:input.awayTeam,league:'Grade League',kickoff:now+3600000,status:{state:'scheduled'},ext:{as:'grade'},odds:Object.fromEntries(Object.entries(input.odds).map(([book,prices])=>[book,{...prices,at:now}])),updated:now};
 store.games[game.uid]=game;updateRecord(store,now);const frozen=JSON.stringify(store.projections[game.uid].selections);
 store.projections[game.uid].latestGrades=Object.fromEntries(store.projections[game.uid].selections.map(s=>[s.key,'changed-test-grade']));
 updateRecord(store,now+60000);assert.ok(store.projections[game.uid].gradeHistory.length>0);assert.equal(JSON.stringify(store.projections[game.uid].selections),frozen);assert.ok(buildFeed(store,now+60000).gradeHistory[game.uid].length>0);
});
test('recent-result ratings require real minimum samples and expose model-only probabilities without fake odds',async()=>{
 const {inputFor,predict}=await import('../src/lib/feeds/build.js');const store=emptyStore();
 const scheduled={uid:'real-upcoming',sport:'football',home:'A',away:'B',homeId:1,awayId:2,league:'Real League',kickoff:now+3600000,status:{state:'scheduled'},odds:{},ext:{as:'upcoming'},updated:now};
 store.games[scheduled.uid]=scheduled;assert.equal(inputFor(store,scheduled),null);
 for(let i=0;i<6;i++){const home=i%2===0?1:2;store.games[`final-${i}`]={...scheduled,uid:`final-${i}`,homeId:home,awayId:3+i,home:home===1?'A':'B',away:`Opponent ${i}`,kickoff:now-(i+1)*3600000,status:{state:'finished',home:2,away:1}};}
 const input=inputFor(store,scheduled);assert.match(input.ratingsSource,/retained recent results/);const p=predict('football',input,{now});assert.ok(p.markets[0].selections.length>=7);assert.ok(p.markets[0].selections.every(s=>s.pricing==='derived'&&s.bestOdds===0&&s.modelProb>0&&s.modelProb<1));assert.equal(p.valueBets.length,0);
});

test('predictions are published only once a fixture enters the visible dashboard window',()=>{
 const store=emptyStore(),input=FOOTBALL_INPUTS[0];const game={uid:'future-visible',sport:'football',home:input.homeTeam,away:input.awayTeam,league:'Test',kickoff:now+7*86400000,status:{state:'scheduled'},ext:{as:'future'},odds:Object.fromEntries(Object.entries(input.odds).map(([book,prices])=>[book,{...prices,at:now}])),updated:now};store.games[game.uid]=game;
 assert.deepEqual(updateRecord(store,now),[]);assert.equal(buildFeed(store,now).games.length,0);
 updateRecord(store,now+4*86400000);const feed=buildFeed(store,now+4*86400000);assert.equal(feed.games.length,1);assert.equal(feed.projections.length,1);assert.ok(feed.inputs.football.some(input=>input.fixtureId===game.uid));
});
