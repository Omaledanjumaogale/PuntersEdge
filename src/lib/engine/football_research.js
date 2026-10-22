import {footballResults} from './football_results.js';
/** Chronological logistic candidates. Frozen pre-kickoff features only; separate league and side models. */
import {settleTwoConsecutive} from './goal_sequence.js';
const sigmoid=(/** @type {number} */z)=>1/(1+Math.exp(-Math.max(-30,Math.min(30,z))));
/** @param {number[]} w @param {number[]} x */
export const probability=(w,x)=>sigmoid(w.reduce((s,v,i)=>s+v*x[i],0));
/** @param {any[]} rows */
function fit(rows){const w=[0,0,0];for(let epoch=0;epoch<350;epoch++){const d=[0,0,0];for(const r of rows){const e=probability(w,r.x)-r.y;for(let i=0;i<3;i++)d[i]+=e*r.x[i];}for(let i=0;i<3;i++)w[i]-=.1*(d[i]/rows.length+(i ? .01*w[i] : 0));}return w;}
/** @param {any[]} rows @param {number[]} w @param {number} baseline */
function metrics(rows,w,baseline){if(!rows.length)return {gainLower:null,n:0,brier:null,baselineBrier:null,ece:null};let brier=0,base=0;const deltas=[];const bins=Array.from({length:5},()=>({n:0,p:0,y:0}));for(const r of rows){const p=probability(w,r.x);brier+=(p-r.y)**2;base+=(baseline-r.y)**2;deltas.push((baseline-r.y)**2-(p-r.y)**2);const b=bins[Math.min(4,Math.floor(p*5))];b.n++;b.p+=p;b.y+=r.y;}const gain=deltas.reduce((a,b)=>a+b,0)/rows.length,se=Math.sqrt(deltas.reduce((a,b)=>a+(b-gain)**2,0)/Math.max(1,rows.length-1)/rows.length);return {gainLower:gain-1.96*se,n:rows.length,brier:brier/rows.length,baselineBrier:base/rows.length,ece:bins.reduce((s,b)=>s+(b.n?Math.abs(b.p-b.y):0),0)/rows.length};}
/** @param {any[]} records @param {any} fixture @param {number} at */
export function cornerFeatures(records,fixture,at){
 const mean=(/** @type {any} */id)=>{const rs=records.filter(r=>r.league===fixture.league&&r.kickoff<fixture.kickoff&&r.corners?.observedAt<at&&(String(r.homeId)===String(id)||String(r.awayId)===String(id))).sort((a,b)=>b.kickoff-a.kickoff).slice(0,10);if(rs.length<5)return null;return rs.reduce((s,r)=>s+(String(r.homeId)===String(id)?r.corners.home:r.corners.away),0)/rs.length;};
 const h=mean(fixture.homeId),a=mean(fixture.awayId);return h===null||a===null?null:[1,h/10,a/10];
}
/** @param {any} store @param {number} now */
export function refreshFootballResearch(store,now){
 store.footballResearch??={};const records=Object.values(store.footballResearch);
 // Preserve forecasts made before the match; never reconstruct features after its result.
 for(const g of Object.values(/** @type {Record<string,any>} */(store.games))){if(g.sport!=='football')continue;const p=store.projections[g.uid],r=store.footballResearch[g.uid];if(r){g.goalSequence=r.events;g.corners=r.corners;}const facts=footballResults(g);if(Object.keys(facts).length)g.status.settledMarkets=facts;else delete g.status.settledMarkets;if(r&&p?.publishedAt<g.kickoff&&!r.pre){const e=p.forecast?.expectedGoals;if(Number.isFinite(e?.homeLambda)&&Number.isFinite(e?.awayMu))r.pre={at:p.publishedAt,x:[1,e.homeLambda/3,e.awayMu/3],version:p.modelVersion};}}
 const models=[];const leagues=[...new Set(records.map((/** @type {any} */r)=>r.league))];
 for(const league of leagues)for(const target of ['sequence-home','sequence-away','corners-total','corners-home','corners-away']){
  const data=[];for(const r of records.filter((/** @type {any} */r)=>r.league===league).sort((/** @type {any} */a,/** @type {any} */b)=>a.kickoff-b.kickoff)){
   let x,y,availableAt;
   if(target.startsWith('sequence')){x=r.pre?.x;const result=settleTwoConsecutive(r.events,r.score,target.endsWith('home')?'home':'away');if(!x||!r.pre||r.pre.at>=r.kickoff||result===null)continue;y=Number(result==='won');availableAt=r.events.observedAt;}
   else{if(!r.corners||!r.cornerPre||r.cornerPre.at>=r.kickoff)continue;x=r.cornerPre.x;const n=target==='corners-total'?r.corners.home+r.corners.away:target==='corners-home'?r.corners.home:r.corners.away;y=Number(n>(target==='corners-total'?9.5:4.5));availableAt=r.corners.observedAt;}
   if(x.length!==3||!x.every(Number.isFinite)||!Number.isFinite(availableAt)||availableAt>now)continue;data.push({x,y,kickoff:r.kickoff,availableAt});
  }
  // Entire timestamps stay together. Train on earlier outcomes available before test starts.
  const boundary=data[Math.floor(data.length*.7)]?.kickoff??now,train=data.filter(r=>r.kickoff<boundary&&r.availableAt<boundary),test=data.filter(r=>r.kickoff>=boundary);
  const weights=train.length?fit(train):[0,0,0],baseline=train.length?train.reduce((s,r)=>s+r.y,0)/train.length:.5,validation=metrics(test,weights,baseline);
  const reasons=[];if(new Set(test.map(r=>Math.floor(r.kickoff/86400000))).size<30)reasons.push('Need validation across 30 distinct days');if(train.length<200)reasons.push('Need 200 earlier training fixtures');if(test.length<100)reasons.push('Need 100 later unseen validation fixtures');if(!test.some(r=>r.y===0)||!test.some(r=>r.y===1))reasons.push('Validation needs wins and losses');if(validation.brier===null||validation.baselineBrier===null||validation.brier>validation.baselineBrier-.005)reasons.push('No demonstrated Brier improvement over training base rate');if(validation.gainLower===null||validation.gainLower<=0)reasons.push('Brier improvement is not reliable at the paired 95% bound');if(validation.ece===null||validation.ece>.08)reasons.push('Calibration error exceeds 8%');
  models.push({league,target,version:'football-research-v1',trainedAt:now,cutoff:boundary,trainN:train.length,validation,weights,approved:reasons.length===0,reasons});
 }
 store.footballResearchModels=models;store.footballResearchReport={at:now,records:records.length,eventSequences:records.filter((/** @type {any} */r)=>r.events).length,cornerRecords:records.filter((/** @type {any} */r)=>r.corners).length,models:models.map(({weights,...m})=>m)};
 // Cache prospective corner features, even while the models remain in shadow mode.
 for(const g of Object.values(/** @type {Record<string,any>} */(store.games))){if(g.sport!=='football'||g.status.state!=='scheduled'||g.kickoff<=now||g.kickoff>now+7*86400000)continue;const x=cornerFeatures(records,g,now);if(!x)continue;if(!store.footballResearch[g.uid]&&Object.keys(store.footballResearch).length>=5000)continue;const r=store.footballResearch[g.uid]??={fixtureId:g.uid,kickoff:g.kickoff,league:g.league,homeId:g.homeId,awayId:g.awayId,home:g.home,away:g.away};r.cornerPre??={at:now,x};}
 return store.footballResearchReport;
}
/** @param {any} input @param {any} p */
export function addResearchMarkets(input,p){
 if(p.family!=='football'||!input.footballResearchModels)return p;const rows=[];
 for(const m of input.footballResearchModels){if(!m.approved||m.league!==p.league||m.trainedAt>=Date.parse(p.kickoffTime))continue;const sequence=m.target.startsWith('sequence'),home=m.target.endsWith('home'),away=m.target.endsWith('away'),x=sequence?[1,p.expectedGoals.homeLambda/3,p.expectedGoals.awayMu/3]:input.cornerResearchFeatures;if(!x)continue;const prob=probability(m.weights,x),line=home||away?4.5:9.5;
 for(const side of sequence?['yes']:['over','under']){const value=side==='under'?1-prob:prob,key=sequence?`sequence:regulation:two-consecutive:${home?'home':'away'}`:`corners:regulation:${home?'home':away?'away':'total'}:${side}:${line}`,label=sequence?`${home?p.homeTeam:p.awayTeam} to score two consecutive goals`:`${home?p.homeTeam+' ':away?p.awayTeam+' ':''}${side==='over'?'Over':'Under'} ${line} corners`;
 rows.push({id:`${p.fixtureId}:${key}`,fixtureId:p.fixtureId,sport:'football',matchTitle:p.matchTitle,league:p.league,market:sequence?'Two consecutive goals':'Corners',selection:label,modelProb:value,marketProb:value,pushProb:0,fairOdds:1/value,bestOdds:0,bookmaker:'Quote unavailable',edgePercent:0,kellyStakePercent:0,grade:'PASS',pricing:'derived',scope:'regulation',modelVersion:`${m.version}:${m.cutoff}`,eligibilityReasons:['No executable corner/sequence bookmaker quote']});}
 }
 if(rows.length)p.markets.push({key:'football-research',title:'Validated goal sequences and corners',emoji:'⚽',blurb:'Chronological validation passed for this league. Unpriced forecasts do not establish betting value.',selections:rows});return p;
}
