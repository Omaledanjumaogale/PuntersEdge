import {selectionDecision} from './decision_screener.js';
/** @param {any} prediction @param {any} evidence @param {number} now */
export function reviewOpportunities(prediction,evidence,now) {
 const rows=prediction.markets.flatMap((/** @type {any} */g)=>g.selections),candidates=[];
 for(const s of rows){
  const raw=selectionDecision({...s,eligibilityReasons:[]});
  const scheduled=prediction.status.state==='scheduled'&&Date.parse(prediction.kickoffTime)>now;
  const fresh=Number.isFinite(s.quoteObservedAt)&&s.quoteObservedAt<=now&&now-s.quoteObservedAt<=15*60_000;
  // Sensitivity test, not a statistical confidence interval.
  const stressEV=(1-(s.pushProb??0))*(Math.max(0,s.modelProb-.05)*s.bestOdds-1)*100;
  const green=scheduled&&fresh&&evidence.independent===true&&raw.eligible&&stressEV>0;
  const validated=green&&s.eligible===true&&s.grade!=='PASS',reasons=[];
  if(!scheduled)reasons.push('Pre-match analysis has closed');
  if(s.pricing!=='quoted')reasons.push('No executable price: likelihood alone cannot establish value');
  if(!fresh)reasons.push('Source quote is missing, stale or future-dated');
  if(evidence.independent!==true)reasons.push('Independent fitted team evidence is unavailable');
  if(!raw.eligible)reasons.push('Likelihood, expected return or model/market agreement fails the selection rules');
  if(!(stressEV>0))reasons.push('Expected return fails the five-point probability sensitivity test');
  s.opportunity={green,validated,grade:green?raw.grade:'PASS',rank:null,compared:rows.length,stressEV,
   note:green?`${s.selection}: model ${(s.modelProb*100).toFixed(1)}%, quoted ${s.bestOdds.toFixed(2)} at ${s.bookmaker}; estimated EV ${s.edgePercent.toFixed(2)}% per unit, push ${((s.pushProb??0)*100).toFixed(1)}%. After subtracting five probability points, EV is ${stressEV.toFixed(2)}%. ${validated?'Validated evidence gates pass.':'Estimated opportunity only: market validation is pending; value grade remains PASS and stake is zero.'}`:reasons.join('. '),
   gradeBasis:'A+ >=70, A >=60, B >=50, C below50 decision score; weights 65% outright likelihood, 25% EV and 10% break-even cushion, discounted for model/market disagreement. This screening score is not historical accuracy.'};
  if(green)candidates.push(s);
  else {s.eligible=false;s.grade='PASS';s.kellyStakePercent=0;s.eligibilityReasons=[...new Set([...(s.eligibilityReasons??[]),...reasons])];}
 }
 candidates.sort((a,b)=>b.opportunity.stressEV-a.opportunity.stressEV||(b.successProbability??0)-(a.successProbability??0)||a.id.localeCompare(b.id));
 candidates.forEach((s,i)=>{s.opportunity.rank=i+1;s.opportunity.note+=` Ranked ${i+1} of ${candidates.length} favourable estimates after reviewing ${rows.length} available options by sensitivity-tested EV. Related markets are correlated; ranks do not justify combining them.`;});
 return prediction;
}
/** @param {any} prediction */
export function fixtureOpportunity(prediction){return prediction.markets.flatMap((/** @type {any} */g)=>g.selections).filter((/** @type {any} */s)=>s.opportunity?.green).sort((/** @type {any} */a,/** @type {any} */b)=>a.opportunity.rank-b.opportunity.rank)[0];}
