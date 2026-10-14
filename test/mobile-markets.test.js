import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStore,attachOdds} from '../src/lib/feeds/store.js';
import {inputFor,predict} from '../src/lib/feeds/build.js';
import {settleSnapshot} from '../src/lib/feeds/performance.js';
import {nhlSchedule,mlbSchedule,refreshPublicSports} from '../src/lib/feeds/public_sports.js';
import {explainFacts} from '../src/lib/engine/explanation.js';
const now=Date.parse('2026-10-14T18:00:00Z');
test('fitted-only NBA without quotes publishes unique totals and team markets, with grounded notes',()=>{
 const store=emptyStore(),g={uid:'nba-f',sport:'nba',league:'NBA',home:'A',away:'B',homeId:1,awayId:2,kickoff:now+3600000,status:{state:'scheduled'},odds:{},ext:{},updated:now};
 store.modelArtifacts=[{mode:'active',approved:false,artifact:{sport:'nba',scope:'full',version:'test-fit',league:'NBA',trainedThrough:'2025-01-01',intercept:110,homeAdvantage:3,marginSd:14,totalSd:19,trainingCount:100,teams:{1:{attack:0,defence:0},2:{attack:0,defence:0}}}}];
 const input=inputFor(store,g,now),p=predict('nba',input,{now});
 const rows=p.markets.flatMap(g=>g.selections);assert.equal(new Set(rows.map(s=>s.id)).size,rows.length);assert.ok(rows.some(s=>s.id.endsWith(':homeMl')));assert.ok(rows.some(s=>s.market.includes('team total')));
 assert.ok(rows.some(s=>s.opportunity.green&&s.projectionGrade!=='PASS'));assert.ok(rows.every(s=>s.bestOdds===0&&s.grade==='PASS'&&s.kellyStakePercent===0));
 const note=explainFacts(input,new Date(now).toISOString(),p);assert.match(note,/Market comparison/);assert.match(note,/estimated outright probability/);assert.match(note,/bookmaker quote unavailable/);assert.doesNotMatch(note,/healthy|guaranteed/);
});
test('low scoring football ladders have unique IDs and full projections settle on regulation',()=>{
 const p=predict('football',{fixtureId:'f',homeTeam:'A',awayTeam:'B',league:'L',kickoffTime:new Date(now+3600000).toISOString(),status:{state:'scheduled'},ratings:{lambdaHome:.7,muAway:.7,rho:0},odds:{}},{now});
 const rows=p.markets.flatMap(g=>g.selections);assert.equal(new Set(rows.map(s=>s.id)).size,rows.length);
 const snapshot={family:'football',selections:[{key:'forecast:full:total:over:2.5',odds:0}]};
 settleSnapshot(snapshot,{status:{state:'finished',home:2,away:1,regHome:1,regAway:1}},now);assert.equal(snapshot.selections[0].result,'lost');
});
test('refreshing one odds market cannot rejuvenate a cached other market',()=>{
 const store=emptyStore(),event={id:'e',sport:'nba',league:'NBA',home:'A',away:'B',kickoff:now+3600000,odds:{Book:{homeMoneyline:1.8,awayMoneyline:2.1,totalLine:220.5,overOdds:1.9,underOdds:1.9}}};
 attachOdds(store,'op',[event],now);attachOdds(store,'op',[{...event,odds:{Book:{homeMoneyline:1.7,awayMoneyline:2.2}}}],now+600000);
 const o=Object.values(store.games)[0].odds.Book;assert.equal(o.__observed_homeMoneyline,now+600000);assert.equal(o.__observed_overOdds,now);assert.equal(o.overOdds,1.9);
});
test('public postponed schedules are never classified as pre-match ready',()=>{
 const nhl=nhlSchedule({gameWeek:[{games:[{id:1,gameState:'FUT',gameScheduleState:'PPD',startTimeUTC:new Date(now).toISOString(),homeTeam:{id:1,placeName:{default:'Toronto'},commonName:{default:'Maple Leafs'}},awayTeam:{id:2,placeName:{default:'Boston'},commonName:{default:'Bruins'}}}]}]});assert.equal(nhl[0].status.state,'postponed');
 const mlb=mlbSchedule({dates:[{games:[{gamePk:1,gameDate:new Date(now).toISOString(),status:{abstractGameState:'Preview',detailedState:'Postponed'},teams:{home:{team:{id:1,name:'Dodgers'}},away:{team:{id:2,name:'Yankees'}}}}]}]});assert.equal(mlb[0].status.state,'postponed');
});
test('public FPL aliases preserve existing licensed identity and standings, with cached requests',async()=>{
 const store=emptyStore();store.games.g={uid:'g',sport:'football',league:'Premier League',leagueId:39,season:2026,home:'Nottingham Forest',away:'Ipswich',homeId:65,awayId:57,kickoff:now+3600000,status:{state:'scheduled'},odds:{},ext:{as:'existing'},updated:now};
 const fixtures=[{id:1,team_h:1,team_a:2,kickoff_time:new Date(now+3600000).toISOString(),finished:false},{id:2,team_h:1,team_a:2,kickoff_time:new Date(now-3600000).toISOString(),finished:true,team_h_score:2,team_a_score:1}];let calls=0;
 const fetcher=async url=>{calls++;if(url.includes('bootstrap'))return {teams:[{id:1,name:"Nott'm Forest"},{id:2,name:'Ipswich Town'}]};if(url.includes('fantasy'))return fixtures;return {};};
 await refreshPublicSports(store,now,fetcher);assert.equal(store.games.g.homeId,65);assert.equal(store.games.g.awayId,57);
 const rows=store.tables['football:39:2026'].rows;assert.equal(rows.find(r=>r.teamId===65).for,2);assert.equal(rows.find(r=>r.teamId===57).against,2);
 assert.equal(calls,6);await refreshPublicSports(store,now+1000,fetcher);assert.equal(calls,6);
});
test('odds-discovered football fixtures receive missing public IDs without contaminating other Premier Leagues',async()=>{
 const store=emptyStore(),base={sport:'football',league:'Premier League',kickoff:now+3600000,status:{state:'scheduled'},odds:{},updated:now};
 store.games.g={...base,uid:'g',home:'Everton FC',away:'Chelsea FC',ext:{op:'odds-only'}};
 store.games.foreign={...base,uid:'foreign',home:'URA',away:'Entebbe',homeId:12459,awayId:26700,leagueId:585,season:2026,ext:{as:'foreign'}};
 const fetcher=async url=>url.includes('bootstrap')?{teams:[{id:1,name:'Everton'},{id:2,name:'Chelsea'}]}:url.includes('fantasy')?[{id:1,team_h:1,team_a:2,kickoff_time:new Date(now+3600000).toISOString(),finished:false},{id:2,team_h:1,team_a:2,kickoff_time:new Date(now-3600000).toISOString(),finished:true,team_h_score:2,team_a_score:1}]:{};
 await refreshPublicSports(store,now,fetcher);assert.equal(store.games.g.homeId,45);assert.equal(store.games.g.awayId,49);assert.equal(store.games.g.leagueId,'public-pl');
 assert.equal(store.tables['football:public-pl:2026'].rows.find(r=>r.teamId===45).played,1);assert.equal(store.tables['football:585:2026'],undefined);
 assert.match(inputFor(store,store.games.g,now).ratingsSource,/table/);
});
