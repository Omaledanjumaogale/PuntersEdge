import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {fittedInput} from '../src/lib/engine/artifacts.js';
import {buildFootballPrediction,buildBasketballPrediction} from '../src/lib/engine/prediction_pipeline.js';
import {buildScoreSportPrediction} from '../src/lib/engine/score_sports.js';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const history=read('training/private/production-history.json');
const totals={};
for(const sport of ['football','nba','basketball','hockey','baseball']){
 const artifact=read(`training/artifacts/${sport}.json`),names=new Map();
 for(const file of readdirSync('training/private').filter(n=>n.startsWith(sport)&&n.endsWith('games.json')))for(const game of read('training/private/'+file)){names.set(game.home,String(game.homeId));names.set(game.away,String(game.awayId));}
 const rows=[];let skipped=0;
 for(const s of history.snapshots.filter(s=>s.sport===sport&&s.score)){
  const verdict=s.selections.find(v=>v.verdict&&['won','lost'].includes(v.result));if(!verdict)continue;
  const input=structuredClone(s.input),game={sport,league:input.league,homeId:names.get(input.homeTeam),awayId:names.get(input.awayTeam)};
  if(Date.parse(artifact.trainedThrough)>=s.publishedAt||!game.homeId||!game.awayId||game.league!==artifact.league){skipped++;continue;}
  const candidate=fittedInput(input,game,[{artifact,mode:'active',approved:false}],s.publishedAt);
  if(!candidate.modelArtifact){skipped++;continue;}
  const p=sport==='football'?buildFootballPrediction(candidate,{now:s.publishedAt}):['nba','basketball'].includes(sport)?buildBasketballPrediction(candidate,{now:s.publishedAt,sport}):buildScoreSportPrediction(candidate,sport,{now:s.publishedAt});
  const row=p.markets.flatMap(g=>g.selections).find(v=>v.id===`${s.fixtureId}:${verdict.key}`);if(!row){skipped++;continue;}
  const y=Number(verdict.result==='won');rows.push({fixtureId:s.fixtureId,selection:verdict.key,result:verdict.result,champion:verdict.modelProb,challenger:row.modelProb,championBrier:(verdict.modelProb-y)**2,challengerBrier:(row.modelProb-y)**2});
 }
 totals[sport]={n:rows.length,skipped,championBrier:rows.length?rows.reduce((a,r)=>a+r.championBrier,0)/rows.length:null,challengerBrier:rows.length?rows.reduce((a,r)=>a+r.challengerBrier,0)/rows.length:null,rows};
}
const report={exportedAt:history.exportedAt,scope:'Same frozen original verdicts, mapped by exact provider team names; candidate fit excludes these outcomes. No claim of new selection strike rate or executable candidate ROI.',results:totals};
writeFileSync('training/reports/production-comparison.json',JSON.stringify(report,null,2));console.log(JSON.stringify(Object.fromEntries(Object.entries(totals).map(([s,r])=>[s,{n:r.n,skipped:r.skipped,championBrier:r.championBrier,challengerBrier:r.challengerBrier}]))));
