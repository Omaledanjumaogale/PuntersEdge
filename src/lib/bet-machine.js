import { likelihoodGrade } from './engine/decision_screener.js';
/** A bounded probability optimizer, using published predictions and real quotes only. */
/** @typedef {{id:string;fixtureId:string;sport:string;market:string;selection:string;modelProb:number;bestOdds:number;pricing:string;edgePercent:number;pushProb?:number;[key:string]:any}} Pick */
/** @param {any[]} predictions @param {any} options @param {number} now */
export function machineCandidates(predictions, options, now = Date.now()) {
 const rows = [];
 for(const p of predictions) {
  const kickoff=Date.parse(p.kickoffTime);
  if(p.status.state!=='scheduled'||kickoff<=now||kickoff<options.from||kickoff>options.to||!options.publishedIds.has(p.fixtureId)||!options.sports.includes(p.sport))continue;
  if(p.probabilities && ((p.probabilities.homeWin??0)+(p.probabilities.awayWin??0)+(p.probabilities.draw??0)>1.03))continue;
  if(options.direction==='home' && p.probabilities && p.probabilities.homeWin <= Math.max(p.probabilities.awayWin,p.probabilities.draw??0))continue;
  if(options.direction==='away' && p.probabilities && p.probabilities.awayWin <= Math.max(p.probabilities.homeWin,p.probabilities.draw??0))continue;
  for(const group of p.markets) for(const pick of group.selections) {
   const observedAt=p.quoteObservedAt?.[pick.bookmaker];
   if(observedAt && (observedAt>now+60000 || now-observedAt>86400000))continue;
   if(pick.pricing!=='quoted'||!Number.isFinite(pick.bestOdds)||pick.bestOdds<options.minOdds||pick.bestOdds>options.maxOdds||!Number.isFinite(pick.modelProb)||pick.modelProb<options.minProbability||pick.modelProb>1||(pick.pushProb??0)<0||(pick.pushProb??0)>=1)continue;
   if(options.positiveValue && !(pick.edgePercent>0 && pick.edgePercent<=25))continue;
   if(options.markets.length && !options.markets.includes(group.key))continue;
   const key=pick.id.slice(p.fixtureId.length+1);
   const direction= /^(?:o\d|over)/.test(key)?'over':/^(?:u\d|under)/.test(key)?'under':/^(?:home|h$|sph|th)/.test(key)?'home':/^(?:away|a$|spa|ta)/.test(key)?'away':key==='draw'?'draw':'other';
   if(options.direction!=='all'&&direction!==options.direction)continue;
   const alternatives=p.markets.flatMap((/** @type {any} */ g)=>g.selections).filter((/** @type {any} */ s)=>s.id!==pick.id&&s.pricing==='quoted'&&Number.isFinite(s.modelProb)&&Number.isFinite(s.bestOdds)).sort((/** @type {any} */ a,/** @type {any} */ b)=>b.modelProb-a.modelProb).slice(0,3).map((/** @type {any} */ s)=>({id:s.id,selection:s.selection,modelProb:s.modelProb,odds:s.bestOdds,market:s.market}));
   const marketProbability=Number.isFinite(pick.marketProb)?pick.marketProb:null;
   const divergence=marketProbability===null?null:100*Math.abs(pick.modelProb-marketProbability);
   const cohort=options.sportStats?.[p.sport];
   const evidence={basis:p.ratingsSource??'Not provided',modelProbability:pick.modelProb,marketProbability,breakEvenProbability:1/pick.bestOdds,divergence,verdict:pick.id===p.bestValue?.id&&p.bestValue?.eligible===true,likelihoodBand:likelihoodGrade(pick.modelProb*(1-(pick.pushProb??0))),observedAt:observedAt??null,alternatives,settledSportPicks:cohort?.picks??0,sportWinRate:cohort?.won+cohort?.lost>0?cohort.won/(cohort.won+cohort.lost):null};
   rows.push({...pick,evidence,kickoffTime:p.kickoffTime,group:group.key,successProbability:pick.modelProb*(1-(pick.pushProb??0))});
  }
 }
 return rows.sort((a,b)=>b.successProbability-a.successProbability||b.edgePercent-a.edgePercent||a.id.localeCompare(b.id));
}
/** @param {Pick[]} candidates @param {{minTotal:number;maxTotal:number}} options */
export function buildMachineTicket(candidates, options) {
 if(!Number.isFinite(options.minTotal)||!Number.isFinite(options.maxTotal)||options.minTotal<=1||options.maxTotal<options.minTotal)throw new Error('Choose a valid combined odds range greater than 1.');
 // Keep market alternatives across fixtures rather than allowing one match to monopolize the search.
 const counts=new Map();const pool=candidates.filter(p=>{const count=counts.get(p.fixtureId)??0;counts.set(p.fixtureId,count+1);return count<8;}).slice(0,200);
 let beam=[{picks:/** @type {Pick[]} */([]),odds:1,probability:1,last:-1}];
 const maximum=Math.min(30,new Set(pool.map(p=>p.fixtureId)).size);
 let best=/** @type {typeof beam[number]|undefined} */(undefined);
 for(let depth=0;depth<maximum;depth++) {
  const next=[];
  for(const state of beam) for(let i=state.last+1;i<pool.length;i++) {
   const pick=pool[i];
   if(state.picks.some(p=>p.fixtureId===pick.fixtureId))continue;
   const odds=state.odds*pick.bestOdds;
   if(!Number.isFinite(odds)||odds>options.maxTotal)continue;
   const probability=state.probability*pick.modelProb*(1-(pick.pushProb??0));
   const candidate={picks:[...state.picks,pick],odds,probability,last:i};
   if(odds>=options.minTotal){if(!best||probability>best.probability||(probability===best.probability&&candidate.picks.length<best.picks.length))best=candidate;}
   else if(!best||probability>best.probability)next.push(candidate);
  }
  // Extending a valid ticket only reduces its all-win probability; extend unfinished paths only.
  next.sort((a,b)=>b.probability-a.probability);
  const kept=new Map();beam=next.filter(state=>{if(best&&state.probability<=best.probability)return false;const band=Math.floor(Math.log(state.odds)*15);const n=kept.get(band)??0;kept.set(band,n+1);return n<12;}).slice(0,400);
  if(!beam.length)break;
 }
 return best?{picks:best.picks,combinedOdds:best.odds,combinedProbability:best.probability,considered:pool.length}:null;
}
