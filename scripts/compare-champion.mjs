import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {tableFromResults,footballRatings,basketballRatings,scoreSportRatings} from '../src/lib/engine/ratings.js';
import {buildFootballPrediction,buildBasketballPrediction} from '../src/lib/engine/prediction_pipeline.js';
import {buildScoreSportPrediction} from '../src/lib/engine/score_sports.js';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
function metrics(rows){return {n:rows.length,strikeRate:rows.filter(r=>r.p.indexOf(Math.max(...r.p))===r.actual).length/rows.length,brier:rows.reduce((a,r)=>a+r.p.reduce((s,p,i)=>s+(p-Number(i===r.actual))**2,0),0)/rows.length,logLoss:rows.reduce((a,r)=>a-Math.log(Math.max(1e-12,r.p[r.actual])),0)/rows.length};}
for(const sport of ['football','nba','basketball','hockey','baseball']){
 let report;try{report=read(`training/reports/${sport}.json`);}catch{continue;}
 const unique=new Map();for(const name of readdirSync('training/private').filter(n=>n.startsWith(sport)&&n.endsWith('games.json')))for(const r of read('training/private/'+name))if(sport==='football'||r.status.home!==r.status.away)unique.set(r.id,r);
 const games=[...unique.values()].sort((a,b)=>a.kickoff-b.kickoff),cutoff=games[Math.floor(games.length*.6)].kickoff;
 const training=games.filter(g=>g.kickoff+48*3600000<cutoff);
 const table=tableFromResults(training.map(g=>({homeId:g.homeId,awayId:g.awayId,home:g.home,away:g.away,homeScore:g.status.home,awayScore:g.status.away})));
 if(sport==='nba')for(const row of table){row.for=0;row.against=0;}
 const scored=[],challenger=[];
 for(const row of report.predictions){const g=unique.get(row.fixtureId);const ratings=sport==='football'?footballRatings(table,g.homeId,g.awayId):sport==='nba'||sport==='basketball'?basketballRatings(table,g.homeId,g.awayId,g.league):scoreSportRatings(table,g.homeId,g.awayId,sport);if(!ratings)continue;const input={fixtureId:g.id,homeTeam:g.home,awayTeam:g.away,league:g.league,ratings,odds:{},kickoffTime:new Date(g.kickoff).toISOString()};const p=sport==='football'?buildFootballPrediction(input,{modelWeight:1}):sport==='nba'||sport==='basketball'?buildBasketballPrediction(input,{modelWeight:1,sport}):buildScoreSportPrediction(input,sport,{modelWeight:1});scored.push({p:sport==='football'?[p.probabilities.homeWin,p.probabilities.draw,p.probabilities.awayWin]:[p.probabilities.homeWin,p.probabilities.awayWin],actual:row.actual});challenger.push({p:row.probabilities,actual:row.actual});}
 report.proxyChampion=metrics(scored);report.challengerMatched=metrics(challenger);report.championComparisonLimit='Reconstructed fixed prior table/standings baseline, without historical odds or production settings; not a reproduction of live predictions.';
 writeFileSync(`training/reports/${sport}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({sport,proxyChampion:report.proxyChampion,challengerMatched:report.challengerMatched}));
}
