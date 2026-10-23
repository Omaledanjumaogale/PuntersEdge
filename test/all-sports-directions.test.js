import test from 'node:test';import assert from 'node:assert/strict';
import {addFullForecastMarkets,fullForecastOutcomes} from '../src/lib/engine/forecast_markets.js';import {addPeriodMarkets,periodForecastOutcomes} from '../src/lib/engine/period_markets.js';
import {buildScoreSportPrediction} from '../src/lib/engine/score_sports.js';
const sports=['football','nba','basketball','hockey','baseball'];
for(const sport of sports){
 test(`${sport}: full match and each team total favour Under below a fixed line and Over above it`,()=>{
  const gaussian=['nba','basketball'].includes(sport),centre=gaussian?100:3,delta=gaussian?15:1.5;
  const make=mean=>{const p={fixtureId:sport,sport,family:gaussian?'basketball':sport,homeTeam:'Home',awayTeam:'Away',matchTitle:'Home vs Away',league:'Test',markets:[],projectedScore:{home:mean,away:mean},expectedGoals:{homeLambda:mean,awayMu:mean,rho:0}};addFullForecastMarkets({fittedProjection:{marginSd:14,totalSd:19}},p);return p;};
  const low=make(centre),high=make(centre+delta),lowRows=low.markets.flatMap(g=>g.selections),highRows=high.markets.flatMap(g=>g.selections);
  for(const kind of ['total','home','away']){const line=Math.floor(kind==='total'?centre*2:centre)+.5;const pair=rows=>['over','under'].map(side=>rows.find(s=>s.id===`${sport}:forecast:full:${kind}:${side}:${line}`));
   // Reuse the baseline's exact line against a higher score distribution, not a different line.
   const base=pair(lowRows);assert.ok(base.every(Boolean));assert.ok(base[1].modelProb>base[0].modelProb);assert.ok(Math.abs(base[0].modelProb+base[1].modelProb-1)<1e-8);
   const lower=fullForecastOutcomes({fittedProjection:{marginSd:14,totalSd:19}},low)(kind,line);
   const higher=fullForecastOutcomes({fittedProjection:{marginSd:14,totalSd:19}},high)(kind,line);
   assert.ok(lower.conditional<.5);assert.ok(higher.conditional>.5,`${sport} ${kind} should prefer Over at the same ${line} line`);

  }
  assert.ok(highRows.every(s=>Number.isFinite(s.modelProb)&&s.modelProb>=0&&s.modelProb<=1));
 });
 for(const scope of sport==='football'?['first_half']:sport==='nba'||sport==='basketball'?['first_half','first_quarter']:sport==='hockey'?['first_period','regulation']:['first_five','first_inning']){
  test(`${sport} ${scope}: match and team Over/Under probabilities are complementary and team labels stay explicit`,()=>{
   const gaussian=['nba','basketball'].includes(sport),mean=gaussian?50:1.5;
   const artifact={sport,scope,version:'synthetic-test',intercept:gaussian?mean:Math.log(mean),homeAdvantage:0,marginSd:10,totalSd:14,teamSd:9,rho:0,teams:{1:{attack:0,defence:0},2:{attack:0,defence:0}}};
   const p={matchTitle:'Home vs Away',homeTeam:'Home',awayTeam:'Away',markets:[]};addPeriodMarkets({fixtureId:sport,homeId:1,awayId:2,league:'Test',periodArtifacts:[artifact]},p);
   for(const kind of ['total','home','away']){const centerLine=Math.floor(kind==='total'?2*mean:mean)+.5;const rows=p.markets[0].selections.filter(s=>s.id.includes(`:${scope}:${kind}:`)&&s.id.endsWith(':'+centerLine));assert.equal(rows.length,2);assert.ok(Math.abs(rows[0].modelProb+rows[1].modelProb-1)<1e-8);if(kind!=='total')assert.ok(rows.every(s=>s.selection.startsWith(kind==='home'?'Home ':'Away ')));const line=Math.floor(kind==='total'?2*mean:mean)+.5;const lower=periodForecastOutcomes(artifact,mean,mean)(kind,line),higher=periodForecastOutcomes(artifact,mean+(gaussian?15:1.5),mean+(gaussian?15:1.5))(kind,line);assert.ok(lower.conditional<.5);assert.ok(higher.conditional>.5);}
  });
 }
}
for(const sport of ['hockey','baseball'])test(`${sport}: quoted total keeps the higher-probability Under and Over even when its price fails value screening`,()=>{
 const line=sport==='hockey'?6.5:8.5;
 for(const [mean,side] of [[1,'Under'],[8,'Over']]){const p=buildScoreSportPrediction({fixtureId:sport,homeTeam:'Home',awayTeam:'Away',league:'Test',ratings:{homeMean:mean,awayMean:mean},odds:{Book:{homeMoneyline:1.9,awayMoneyline:1.9,totalLine:line,overOdds:1.9,underOdds:1.9}}},sport,{modelWeight:.9});const rows=p.markets.find(g=>g.key==='total').selections.filter(s=>s.id.endsWith(':'+ (side==='Over'?'o':'u')+line));assert.equal(rows.length,1);assert.ok(rows[0].modelProb>.5);assert.equal(rows[0].grade,'PASS');assert.equal(rows[0].kellyStakePercent,0);}
});
