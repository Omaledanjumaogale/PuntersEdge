import {generateScoreMatrix} from './football_model.js';
import {scoreDistribution,SCORE_SPORTS} from './score_sports.js';
import {normalOutcomes} from './outcomes.js';
/** Complete model projections without inventing executable odds. @param {any} input @param {any} p */
export function addFullForecastMarkets(input,p){
 const gaussian=p.family==='basketball',home=gaussian?p.projectedScore.home:p.family==='football'?p.expectedGoals.homeLambda:p.projectedScore.home,away=gaussian?p.projectedScore.away:p.family==='football'?p.expectedGoals.awayMu:p.projectedScore.away;
 if(!Number.isFinite(home+away))return p;
 const model=gaussian?null:p.family==='football'?generateScoreMatrix(home,away,p.expectedGoals.rho,20):scoreDistribution(home,away,{...SCORE_SPORTS[/** @type {'hockey'|'baseball'} */(p.family)],...(input.scoreConfig??{}),finalScoreModel:true});
 const marginSd=input.fittedProjection?.marginSd??p.scoreDispersion?.marginSd??(gaussian?Math.sqrt(2)*11:1),totalSd=input.fittedProjection?.totalSd??p.scoreDispersion?.totalSd??(gaussian?Math.sqrt(2)*13:1),teamSd=Math.sqrt((marginSd**2+totalSd**2)/4);
 const outcomes=(/** @type {string} */kind,/** @type {number} */line)=>{if(gaussian)return normalOutcomes(kind==='total'?home+away:kind==='home'?home:kind==='away'?away:home-away,kind==='total'?totalSd:kind==='margin'?marginSd:teamSd,kind==='margin'?-line:line);if(!model)throw new Error('Score model missing');let win=0,push=0,lose=0;for(let h=0;h<model.matrix.length;h++)for(let a=0;a<model.matrix[h].length;a++){const value=kind==='total'?h+a:kind==='home'?h:kind==='away'?a:h-a,d=kind==='margin'?value+line:value-line;const mass=model.matrix[h][a];if(d>0)win+=mass;else if(d<0)lose+=mass;else push+=mass;}return {win,push,lose,conditional:win/(win+lose)};};
 /** @type {any[]} */ const rows=[];const step=gaussian?5:1;
 for(const kind of ['total','home','away'])for(const offset of [-1,0,1]){
  const line=Math.max(.5,Math.floor(kind==='total'?home+away:kind==='home'?home:away)+.5+offset*step),o=outcomes(kind,line);
  for(const side of ['over','under']){const probability=side==='over'?o.conditional:1-o.conditional,label=`${kind==='total'?'':(kind==='home'?p.homeTeam:p.awayTeam)+' '}${side==='over'?'Over':'Under'} ${line}`;
   if(p.markets.some((/** @type {any} */g)=>g.selections.some((/** @type {any} */s)=>s.selection.toLowerCase().startsWith(label.toLowerCase())&&s.pricing==='quoted')))continue;
   rows.push({id:`${p.fixtureId}:forecast:full:${kind}:${side}:${line}`,fixtureId:p.fixtureId,sport:p.sport,matchTitle:p.matchTitle,league:p.league,market:kind==='total'?'Full-game total projection':`${kind==='home'?p.homeTeam:p.awayTeam} team total projection`,selection:label,modelProb:probability,marketProb:probability,pushProb:o.push,fairOdds:1/probability,bestOdds:0,bookmaker:'Quote unavailable',edgePercent:0,kellyStakePercent:0,grade:'PASS',pricing:'derived',scope:'full'});
  }
 }
 for(const line of (gaussian?[-6.5,-3.5,0,3.5,6.5]:[-1.5,-.5,0,.5,1.5])){const o=outcomes('margin',line);for(const side of ['home','away']){const probability=side==='home'?o.conditional:1-o.conditional,value=side==='home'?line:-line;rows.push({id:`${p.fixtureId}:forecast:full:handicap:${side}:${value}`,fixtureId:p.fixtureId,sport:p.sport,matchTitle:p.matchTitle,league:p.league,market:'Handicap projection',selection:`${side==='home'?p.homeTeam:p.awayTeam} ${value>=0?'+':''}${value}`,modelProb:probability,marketProb:probability,pushProb:o.push,fairOdds:1/probability,bestOdds:0,bookmaker:'Quote unavailable',edgePercent:0,kellyStakePercent:0,grade:'PASS',pricing:'derived',scope:'full'});}}
 p.markets.push({key:'full-projections',title:'Totals, team totals and handicaps',emoji:'📊',blurb:'Score-distribution projections. Fair prices are estimates; quoted prices remain separately identified.',selections:[...new Map(rows.map(row=>[row.id,row])).values()]});return p;
}
