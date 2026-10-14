import test from 'node:test';
import assert from 'node:assert/strict';
import {normalOutcomes,normalMeanFromPrice} from '../src/lib/engine/outcomes.js';
import {scoreDistribution,SCORE_SPORTS,buildScoreSportPrediction} from '../src/lib/engine/score_sports.js';
import {applyEvidence} from '../src/lib/engine/evidence.js';
import {selectionDecision} from '../src/lib/engine/decision_screener.js';
import {validateArtifact,fittedInput} from '../src/lib/engine/artifacts.js';
import {parseOddsApiEvents} from '../src/lib/feeds/theoddsapi.js';
import {emptyStore,attachOdds} from '../src/lib/feeds/store.js';
import {explainFacts} from '../src/lib/engine/explanation.js';
import {addPeriodMarkets} from '../src/lib/engine/period_markets.js';
import {asianOutcomes} from '../src/lib/engine/asian_lines.js';
import {settlePeriod} from '../src/lib/engine/period_settlement.js';
import {periodScores} from '../src/lib/feeds/apisports.js';
test('quarter-line Asian fair odds price half losses without claiming full success',()=>{
 const p=asianOutcomes([[.5,.2],[.3,0]],-.25,'home');assert.equal(p.win,.3);assert.equal(p.halfLose,.5);assert.equal(p.lose,.2);assert.equal(p.fairOdds,2.5);
});
test('period scores and settlement keep missing inputs ungraded and periods distinct',()=>{
 const scores=periodScores('nba',{scores:{home:{linescore:['20','30','99','99']},visitors:{linescore:['22','28','1','1']}}});assert.deepEqual(scores.first_half,{home:50,away:50});assert.deepEqual(scores.first_quarter,{home:20,away:22});
 assert.equal(settlePeriod('period:first_half:handicap:home:-0.25',scores),'half-lost');assert.equal(settlePeriod('period:first_half:total:under:100.25',scores),'half-won');assert.equal(settlePeriod('period:first_period:total:over:1.5',scores),null);
 assert.deepEqual(periodScores('baseball',{scores:{home:{innings:{'1':null}},away:{innings:{'1':0}}}}),{});
});
test('period forecasts use independent fitted scope rates and cannot create executable quotes',()=>{
 const a={sport:'football',scope:'first_half',version:'half',league:'L',trainedThrough:'2025-01-01T00:00:00Z',intercept:Math.log(.7),homeAdvantage:0,rho:0,teams:{a:{attack:0,defence:0},b:{attack:0,defence:0}}};
 const p={fixtureId:'f',homeTeam:'A',awayTeam:'B',matchTitle:'A vs B',markets:[]};addPeriodMarkets({fixtureId:'f',league:'L',homeId:'a',awayId:'b',periodArtifacts:[a]},p);
 assert.equal(p.markets.length,1);assert.equal(p.markets[0].selections.length,16);const total=p.markets[0].selections.filter(s=>s.market==='First half total');assert.ok(Math.abs(total[0].modelProb+total[1].modelProb-1)<1e-12);assert.ok(p.markets[0].selections.every(s=>s.bestOdds===0&&s.grade==='PASS'&&s.kellyStakePercent===0));
 assert.throws(()=>validateArtifact({...a,scope:'first_inning'}));
});
test('quote ingestion retains source age and removes stale timestamp on untimed replacement',()=>{
 const now=Date.parse('2026-10-14T10:00:00Z');const store=emptyStore();
 const event={id:'e',sport:'nba',league:'NBA',home:'A',away:'B',kickoff:now+3600000,odds:{Book:{homeMoneyline:1.5,awayMoneyline:2.7,__source_homeMoneyline:now-60000,__source_awayMoneyline:now-60000}}};
 attachOdds(store,'toa',[event],now);attachOdds(store,'toa',[{...event,odds:{Book:{homeMoneyline:1.6,awayMoneyline:2.5}}}],now+1000);
 const g=Object.values(store.games)[0];assert.equal(g.odds.Book.__source_homeMoneyline,undefined);assert.equal(g.odds.Book.homeMoneyline,1.6);
 const parsed=parseOddsApiEvents([{id:'e',sport_key:'basketball_nba',home_team:'A',away_team:'B',commence_time:'2026-10-14T12:00:00Z',bookmakers:[{key:'pinnacle',last_update:'2026-10-14T09:00:00Z',markets:[{key:'h2h',outcomes:[{name:'A',price:1.5},{name:'B',price:2.7}]}]}]}]);
 assert.equal(Object.values(parsed[0].odds)[0].__source_homeMoneyline,now-3600000);
});
test('facts explanation cannot infer fitness or a probability from missing evidence',()=>{
 const text=explainFacts({home:'A',away:'B',league:'L'},'2026-10-14T10:00:00Z');assert.match(text,/unavailable/);assert.match(text,/No approved calibrated model/);assert.doesNotMatch(text,/healthy|full strength/);
});
test('whole line win/push/loss agree with normal rounding and half lines have no push',()=>{
 const d=normalOutcomes(228,18,228);assert.ok(d.push>0);assert.equal(d.conditional,.5);assert.ok(Math.abs(d.win+d.lose+d.push-1)<1e-12);
 assert.ok(normalOutcomes(228,18,228.5).push<1e-12);
 assert.ok(Math.abs(normalMeanFromPrice(228,18,.6)-normalMeanFromPrice(228,18,.6))<1e-12);
 const m=normalMeanFromPrice(228,18,.65);assert.ok(Math.abs(normalOutcomes(m,18,228).conditional-.65)<1e-10);
});
test('hockey integer total push is excluded from outright under wins and final space normalizes',()=>{
 const d=scoreDistribution(3,3,SCORE_SPORTS.hockey),p=buildScoreSportPrediction({fixtureId:'h',homeTeam:'A',awayTeam:'B',league:'NHL',ratings:{homeMean:3,awayMean:3},odds:{Book:{homeMoneyline:1.9,awayMoneyline:1.9,totalLine:6,overOdds:1.9,underOdds:1.9}}},'hockey');
 const under=p.markets.flatMap(g=>g.selections).find(s=>s.id==='h:u6');assert.ok(under.pushProb>0);assert.ok(Math.abs(under.pushProb-d.totalPush(6))<1e-12);assert.ok(Math.abs(p.probabilities.homeWin+p.probabilities.awayWin+p.probabilities.draw-1)<1e-12);
 assert.ok(Math.abs(d.over(6)-(1-d.totalPush(6))*d.conditionalOver(6))<1e-12);
});
test('full-score baseball is conditioned on no final tie without a fabricated extra run',()=>{
 const d=scoreDistribution(4,4,{...SCORE_SPORTS.baseball,finalScoreModel:true});assert.equal(d.regulation.draw,0);assert.ok(Math.abs(d.moneyline.home+d.moneyline.away-1)<1e-12);assert.ok(d.totalPush(8)>0);
});
test('final-score hockey artifact cannot manufacture regulation markets or another overtime goal',()=>{
 const cfg={distribution:'poisson',finalScoreModel:true};
 const p=buildScoreSportPrediction({fixtureId:'final',homeTeam:'A',awayTeam:'B',league:'NHL',ratings:{homeMean:3,awayMean:3},scoreConfig:cfg,odds:{Book:{homeMoneyline:1.9,awayMoneyline:1.9,totalLine:6,overOdds:1.9,underOdds:1.9}}},'hockey');
 assert.equal(p.markets.some(g=>g.key==='reg'),false);assert.equal(p.regulationProbabilities.draw,0);assert.match(p.summary.caption,/final score/);
});
test('production evidence gate stays closed under re-ranking and quote staleness',()=>{
 const now=Date.parse('2026-10-14T10:00:00Z');const s={id:'f:homeMl',fixtureId:'f',modelProb:.8,marketProb:.75,bestOdds:1.5,edgePercent:20,pricing:'quoted',market:'Moneyline',bookmaker:'Book',kellyStakePercent:1};
 const p={fixtureId:'f',status:{state:'scheduled'},kickoffTime:'2026-10-14T12:00:00Z',markets:[{selections:[s]}]};
 const input={analysisEvidence:{approved:false,independent:true,domainSupported:true,approvedMarkets:['Moneyline']},quoteSourceAt:{Book:{homeMoneyline:now-1000,awayMoneyline:now-1000}}};applyEvidence(p,input,now);assert.equal(selectionDecision(s).eligible,false);assert.equal(s.kellyStakePercent,0);
 input.analysisEvidence.approved=true;applyEvidence(p,input,now);assert.equal(selectionDecision(s).eligible,true);
 input.quoteSourceAt.Book.homeMoneyline=now-3600000;applyEvidence(p,input,now);assert.equal(selectionDecision(s).eligible,false);
 applyEvidence(p,{},now);assert.equal(selectionDecision(s).eligible,false);assert.equal(p.analysisEvidence.modelVersion,'legacy-unvalidated');
});
test('unmapped, future and invalid fitted artifacts do not silently create strengths',()=>{
 const a={sport:'football',version:'v',league:'L',trainedThrough:'2025-01-01T00:00:00Z',intercept:Math.log(1.3),homeAdvantage:.1,rho:0,teams:{a:{attack:0,defence:0},b:{attack:0,defence:0}},trainingCount:100};assert.equal(validateArtifact(a),a);
 const input={ratings:{},analysisEvidence:{approved:false}};assert.equal(fittedInput(input,{sport:'football',league:'L',homeId:'x',awayId:'b'},[{mode:'active',artifact:a}],Date.now()),input);
 assert.throws(()=>validateArtifact({...a,modelWeight:2}));
});

 test('categorical settlement remains separate from binary scoring and cannot inflate strike rate',async()=>{
 const {countersFor,addCounters,statsOf,emptyCounters}=await import('../src/lib/feeds/performance.js');
 const c=emptyCounters();addCounters(c,countersFor({result:'won',modelProb:.7,marketProb:.6}));
 addCounters(c,countersFor({result:'half-lost',settlementProbabilities:{win:.3,halfWin:0,push:0,halfLose:.5,lose:.2}}));
 addCounters(c,countersFor({result:'won',settlementProbabilities:{win:.3,halfWin:0,push:0,halfLose:.5,lose:.2}}));
 const s=statsOf(c);assert.equal(s.strikeRate,100);assert.equal(s.binary,1);assert.equal(s.categoricalN,2);assert.ok(Number.isFinite(s.categoricalBrier));assert.ok(Number.isFinite(s.confidenceLow));
 });
