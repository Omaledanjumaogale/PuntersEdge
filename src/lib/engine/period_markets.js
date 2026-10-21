import {generateScoreMatrix} from './football_model.js';
import {scoreDistribution,SCORE_SPORTS} from './score_sports.js';
import {normalOutcomes} from './outcomes.js';
/** Separately fitted scope forecasts; no bookmaker quotes are fabricated.
 * @param {any} input @param {any} prediction */
export function addPeriodMarkets(input,prediction) {
 for(const a of input.periodArtifacts??[]){
  const h=a.teams[String(input.homeId)],w=a.teams[String(input.awayId)];if(!h||!w)continue;
  let home=a.intercept+a.homeAdvantage+h.attack+w.defence,away=a.intercept+w.attack+h.defence;
  const gaussian=['nba','basketball'].includes(a.sport);if(!gaussian){home=Math.exp(home);away=Math.exp(away);}
  if(!Number.isFinite(home+away)||home<=0||away<=0||(!gaussian&&Math.max(home,away)>12))continue;
  /** @type {number[][]} */ let matrix=[];
  if(!gaussian)matrix=a.sport==='football'?generateScoreMatrix(home,away,a.rho??0,20).matrix:scoreDistribution(home,away,{...SCORE_SPORTS[/** @type {'hockey'|'baseball'} */(a.sport)],...(a.scoreConfig??{}),finalScoreModel:false}).matrix;
  const outcomes=(/** @type {'total'|'home'|'away'|'margin'} */kind,/** @type {number} */line)=>{
   if(gaussian)return normalOutcomes(kind==='total'?home+away:kind==='home'?home:kind==='away'?away:home-away,kind==='total'?a.totalSd:kind==='margin'?a.marginSd:a.teamSd,kind==='margin'?-line:line);
   let win=0,push=0,lose=0;for(let x=0;x<matrix.length;x++)for(let y=0;y<matrix[x].length;y++){const v=kind==='total'?x+y:kind==='home'?x:kind==='away'?y:x-y;const d=kind==='margin'?v+line:v-line;if(d>0)win+=matrix[x][y];else if(d<0)lose+=matrix[x][y];else push+=matrix[x][y];}
   return {win,push,lose,conditional:win/(win+lose)};
  };
  const labels={first_half:'First half',first_quarter:'First quarter',first_period:'First period',regulation:'Regulation',first_five:'First five innings',first_inning:'First inning'};
  const title=/** @type {any} */(labels)[a.scope]??a.scope, rows=[];
  for(const kind of /** @type {const} */(['total','home','away'])){
   const line=Math.floor(kind==='total'?home+away:kind==='home'?home:away)+.5;const o=outcomes(kind,line);
   for(const side of ['over','under']){const p=side==='over'?o.conditional:1-o.conditional;rows.push({id:`${input.fixtureId}:period:${a.scope}:${kind}:${side}:${line}`,fixtureId:input.fixtureId,sport:a.sport,matchTitle:prediction.matchTitle,league:input.league,market:`${title} ${kind==='total'?'total':kind+' team total'}`,selection:`${kind==='total'?'':(kind==='home'?prediction.homeTeam:prediction.awayTeam)+' '}${side==='over'?'Over':'Under'} ${line}`,modelProb:p,marketProb:p,pushProb:o.push,fairOdds:1/p,bestOdds:0,bookmaker:'No quoted period price',edgePercent:0,kellyStakePercent:0,grade:'PASS',pricing:'derived',eligible:false,modelVersion:a.version,scope:a.scope,eligibilityReasons:['Period model unvalidated','No executable period quote']});}
  }
  for(const line of (gaussian?[-3.5,0,3.5]:[-1.5,-.5,0,.5,1.5])){
   const o=outcomes('margin',line);
   for(const side of ['home','away']){const p=side==='home'?o.conditional:1-o.conditional;const label=side==='home'?line:-line;rows.push({id:`${input.fixtureId}:period:${a.scope}:handicap:${side}:${label}`,fixtureId:input.fixtureId,sport:a.sport,matchTitle:prediction.matchTitle,league:input.league,market:`${title} handicap`,selection:`${side==='home'?prediction.homeTeam:prediction.awayTeam} ${label>0?'+':''}${label}`,modelProb:p,marketProb:p,pushProb:o.push,fairOdds:1/p,bestOdds:0,bookmaker:'No quoted period price',edgePercent:0,kellyStakePercent:0,grade:'PASS',pricing:'derived',eligible:false,modelVersion:a.version,scope:a.scope,eligibilityReasons:['Period model unvalidated','No executable period quote']});}
  }
  prediction.markets.push({key:`period:${a.scope}`,title:`${title} · fitted forecast`,emoji:'⏱️',blurb:`Separately fitted ${a.version}; no quoted price or validated recommendation.`,selections:rows});
 }
 return prediction;
}
