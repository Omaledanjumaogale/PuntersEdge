import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGames } from '../src/lib/feeds/apisports.js';
import { pickTournaments } from '../src/lib/feeds/oddspapi.js';
import { parseOddsApiEvents } from '../src/lib/feeds/theoddsapi.js';
import { sportForOddsApiKey } from '../src/lib/feeds/catalog.js';
import { listJobs } from '../src/lib/feeds/jobs.js';
import { emptyStore } from '../src/lib/feeds/store.js';
import { runTick } from '../src/lib/feeds/runner.js';
const now = Date.parse('2026-10-12T12:00:00Z');
test('date-wide fixtures retain minor competitions across basketball hockey baseball', () => {
  for (const sport of ['basketball', 'hockey', 'baseball']) {
    const games = parseGames(sport, { response: [{id:42,timestamp:now/1000,league:{id:999,name:'Regional Division 2',season:2026},country:{name:'Example country'},teams:{home:{id:1,name:'Home'},away:{id:2,name:'Away'}},scores:{home:null,away:null},status:{short:'NS'}}] });
    assert.equal(games.length,1); assert.equal(games[0].league,'Regional Division 2');
    if (sport === 'basketball') { const rows = [{id:43,timestamp:now/1000,league:{id:12,name:'NBA',season:2026},country:{name:'USA'},teams:{home:{name:'Lakers'},away:{name:'Celtics'}},status:{short:'NS'}}]; assert.equal(parseGames(sport,{response:rows}).length,0); }
  }
});
test('OddsPapi includes minor tournaments but keeps NBA out of basketball catalog', () => {
  const body = [{ tournamentId:1,tournamentName:'Regional Cup',upcomingFixtures:2 },{ tournamentId:2,tournamentName:'NBA',categoryName:'USA',liveFixtures:1 }];
  assert.deepEqual(pickTournaments('basketball',body).map(t=>t.id),[1]);
  assert.deepEqual(pickTournaments('nba',body).map(t=>t.id),[2]);
  assert.equal(pickTournaments('football',body).length,2);
});
test('dynamic odds competition mapping retains minor leagues without unsupported sports', () => {
  for (const [key,sport] of [['soccer_germany_bundesliga2','football'],['basketball_ncaab','basketball'],['icehockey_ahl','hockey'],['baseball_milb','baseball']]) {
    assert.equal(sportForOddsApiKey(key),sport);
    assert.equal(parseOddsApiEvents([{id:'test',sport_key:key,sport_title:'Minor league',home_team:'A',away_team:'B',commence_time:now/1000}])[0].sport,sport);
  }
  assert.equal(sportForOddsApiKey('tennis_atp_wimbledon'),undefined);
});
test('free sport discovery expands supported competitions without consuming odds credits', async () => {
  const lookups = {}; const store = emptyStore();
  const result = await runTick({store,lookups,now,ledgers:{},lastRun:{},keys:{apiSports:false,oddsApi:true,oddspapi:false},sleep:async()=>{},fetcher:async(_provider,url)=>({status:200,body:new URL(url).pathname === '/v4/sports' ? [{key:'soccer_germany_bundesliga2',title:'Bundesliga 2',active:true},{key:'tennis_atp_wimbledon',title:'Wimbledon',active:true},{key:'baseball_milb',active:false}] : [],headers:{get:()=>null}})});
  assert.equal(result.ledgers['the-odds-api'].used,0);
  assert.deepEqual(lookups.oddsApiSports.map(s=>s.key),['soccer_germany_bundesliga2']);
  const jobs = listJobs(store,lookups,now,{apiSports:false,oddsApi:true,oddspapi:false}).jobs;
  assert.ok(jobs.some(j=>j.params.kind==='toa-events' && j.params.key==='soccer_germany_bundesliga2'));
});
test('OddsPapi chunks rotate equally across major minor competitions and sport groups', () => {
  const lookups = {markets:{},bookmakers:[],tournaments:{ football:Array.from({length:12},(_,i)=>({id:i+1,upcoming:1})),hockey:[{id:50,upcoming:1}]}};
  const jobs = listJobs(emptyStore(),lookups,now,{apiSports:false,oddsApi:false,oddspapi:true}).jobs.filter(j=>j.params.kind==='op-odds');
  assert.ok(jobs.length>2);assert.deepEqual(new Set(jobs.map(j=>j.priority)),new Set([10]));
  assert.deepEqual(new Set(jobs.map(j=>j.group)),new Set(['football','hockey']));
});

test('late-night live fixtures refresh their actual previous date and rollover cannot reuse a different date cache',()=>{
 const current=Date.parse('2026-10-12T00:30:00Z'),store=emptyStore();
 store.games.late={uid:'nba-late',sport:'nba',league:'NBA',home:'A',away:'B',kickoff:Date.parse('2026-10-11T23:30:00Z'),status:{state:'live'},ext:{as:'late'},odds:{},updated:current};
 const jobs=listJobs(store,{},current,{apiSports:true,oddsApi:false,oddspapi:false}).jobs;
 const previous=jobs.find(j=>j.params.kind==='games'&&j.params.sport==='nba'&&j.params.date==='2026-10-11');
 assert.equal(previous.every,28*60000);assert.equal(previous.priority,1);
 const today=jobs.find(j=>j.params.kind==='games'&&j.params.sport==='nba'&&j.params.date==='2026-10-12');
 assert.ok(today.id.includes('2026-10-12'));assert.ok(previous.id.includes('2026-10-11'));
});
