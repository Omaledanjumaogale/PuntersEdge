import { likelihoodGrade } from './engine/decision_screener.js';
/** A bounded probability optimizer, using published predictions and real quotes only. */
/** @typedef {{id:string;fixtureId:string;sport:string;market:string;selection:string;modelProb:number;bestOdds:number;pricing:string;edgePercent:number;pushProb?:number;[key:string]:any}} Pick */
/** Stable event identity also catches the same event delivered under two provider IDs.
 * Names, sport and kickoff minute must agree; rematches at another time stay separate. @param {any} p */
export function machineFixtureKey(p) {
 const name=String(p.matchTitle??(p.homeTeam&&p.awayTeam?`${p.homeTeam} vs ${p.awayTeam}`:''));
 const at=Date.parse(p.kickoffTime??'');
 return name&&Number.isFinite(at)?JSON.stringify([p.sport==='nba'?'basketball':p.sport,normal(name),Math.floor(at/60000)]):String(p.fixtureId);
}
/** @param {string} text */
const normal=text=>text.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}.]+/gu,' ').trim();
/** Filters describe the selection rather than relying on a legacy ID prefix. @param {any} pick @param {string} [group] */
export function machineMarketTraits(pick,group='') {
 const key=pick.id.slice(pick.fixtureId.length+1),label=pick.selection??'';
 const totalSide=/\b(over|under)\b/i.exec(label)?.[1].toLowerCase()??(/^[ou]\d/.test(key)?(key[0]==='o'?'over':'under'):null);
 const team=!!totalSide&&(/(?:forecast:full|period:[^:]+):(?:home|away):/.test(key)||group==='team'||/team (?:total|goals|points|runs)/i.test(pick.market??'')||!/^\s*(?:over|under)\b/i.test(label));
 const direction=totalSide??(/^(?:home|h$|sph|th)/.test(key)?'home':/^(?:away|a$|spa|ta)/.test(key)?'away':key==='draw'?'draw':'other');
 const scope=pick.scope??(/^period:([^:]+):/.exec(key)?.[1]??'full');
 return {direction,team,scope};
}
/** @type {Array<[string,string]>} */
export const MACHINE_MARKET_FILTERS=[['team-over','Team total · Over points / goals / runs'],['team-under','Team total · Under points / goals / runs'],['match-over','Match total · Over points / goals / runs'],['match-under','Match total · Under points / goals / runs']];
/** @param {any} p */
const optionKey=p=>{const t=machineMarketTraits(p,p.group);return JSON.stringify([p.eventKey??machineFixtureKey(p),t.scope,t.direction,normal(p.selection).replace(/ (?:goals?|points?|runs?)$/,'')]);};
/** Remove duplicate options without dropping distinct lines or periods. Real quotes beat an unpriced copy. @param {any[]} rows */
export function uniqueMachineOptions(rows){const seen=new Map();for(const row of rows){const key=optionKey(row),old=seen.get(key);if(!old||(old.pricing!=='quoted'&&row.pricing==='quoted')||(old.pricing===row.pricing&&row.modelProb>old.modelProb))seen.set(key,row);}return [...seen.values()];}
/** @param {any[]} predictions @param {any} options @param {number} now */
export function machineCandidates(predictions, options, now = Date.now()) {
 const rows = [];
 for(const p of predictions) {
  const kickoff=Date.parse(p.kickoffTime);
  if(p.status.state!=='scheduled'||kickoff<=now||kickoff<options.from||kickoff>options.to||!options.publishedIds.has(p.fixtureId)||!options.sports.includes(p.sport))continue;
  if(p.probabilities && ((p.probabilities.homeWin??0)+(p.probabilities.awayWin??0)+(p.probabilities.draw??0)>1.03))continue;
  if(options.direction==='home' && p.probabilities && p.probabilities.homeWin <= Math.max(p.probabilities.awayWin,p.probabilities.draw??0))continue;
  if(options.direction==='away' && p.probabilities && p.probabilities.awayWin <= Math.max(p.probabilities.homeWin,p.probabilities.draw??0))continue;
  const rankedAlternatives=p.markets.flatMap((/** @type {any} */g)=>g.selections).filter((/** @type {any} */s)=>s.pricing==='quoted'&&Number.isFinite(s.modelProb)&&Number.isFinite(s.bestOdds)).sort((/** @type {any} */a,/** @type {any} */b)=>b.modelProb-a.modelProb).slice(0,4).map((/** @type {any} */s)=>({id:s.id,selection:s.selection,modelProb:s.modelProb,odds:s.bestOdds,market:s.market}));
  for(const group of p.markets) for(const pick of group.selections) {
   const observedAt=p.quoteObservedAt?.[pick.bookmaker];
   if(observedAt && (observedAt>now+60000 || now-observedAt>86400000))continue;
   const quoted=pick.pricing==='quoted'&&Number.isFinite(pick.bestOdds)&&pick.bestOdds>1;
   if((!quoted&&!options.includeUnpriced)||(quoted&&(pick.bestOdds<options.minOdds||pick.bestOdds>options.maxOdds))||!Number.isFinite(pick.modelProb)||pick.modelProb<options.minProbability||pick.modelProb>1||(pick.pushProb??0)<0||(pick.pushProb??0)>=1)continue;
   if(options.positiveValue && !(pick.edgePercent>0 && pick.edgePercent<=25))continue;
   const traits=machineMarketTraits(pick,group.key),direction=traits.direction;
   const facet=(traits.team?'team-':'match-')+direction;
   if(options.markets.length&&!options.markets.includes(group.key)&&!options.markets.includes(facet))continue;
   if(options.direction!=='all'&&direction!==options.direction)continue;
   const alternatives=rankedAlternatives.filter((/** @type {any} */s)=>s.id!==pick.id).slice(0,3);
   const marketProbability=Number.isFinite(pick.marketProb)?pick.marketProb:null;
   const divergence=marketProbability===null?null:100*Math.abs(pick.modelProb-marketProbability);
   const cohort=options.sportStats?.[p.sport];
   const evidence={basis:p.ratingsSource??'Not provided',modelProbability:pick.modelProb,marketProbability,breakEvenProbability:quoted?1/pick.bestOdds:null,divergence,verdict:pick.id===p.bestValue?.id&&p.bestValue?.eligible===true,likelihoodBand:likelihoodGrade(pick.modelProb*(1-(pick.pushProb??0))),observedAt:observedAt??null,alternatives,settledSportPicks:cohort?.picks??0,sportWinRate:cohort?.won+cohort?.lost>0?cohort.won/(cohort.won+cohort.lost):null};
   rows.push({...pick,eventKey:machineFixtureKey(p),evidence,kickoffTime:p.kickoffTime,group:group.key,successProbability:pick.modelProb*(1-(pick.pushProb??0))});
  }
 }
 return rankMachineDisplay(uniqueMachineOptions(rows));
}
/** Display order follows the visible Model %, without changing selection or accumulator maths. @template {{modelProb:number;id:string;[key:string]:any}} T @param {T[]} picks @returns {T[]} */
export const rankMachineDisplay=picks=>[...picks].sort((a,b)=>b.modelProb-a.modelProb||(b.modelProb*(1-(b.pushProb??0))-a.modelProb*(1-(a.pushProb??0)))||a.id.localeCompare(b.id));
/** Fixture combinations, rather than a different market on the same matches. @param {Pick[]} picks */
export const ticketFixtureKey=picks=>JSON.stringify(picks.map(p=>p.eventKey??machineFixtureKey(p)).sort());
/** @param {Pick[]} candidates @param {{minTotal:number;maxTotal:number;excludeFixtures?:string[]}} options */
export function buildMachineTicket(candidates, options) {
 if(!Number.isFinite(options.minTotal)||!Number.isFinite(options.maxTotal)||options.minTotal<=1||options.maxTotal<options.minTotal)throw new Error('Choose a valid combined odds range greater than 1.');
 // Keep market alternatives across fixtures rather than allowing one match to monopolize the search.
 const counts=new Map();const pool=uniqueMachineOptions(candidates).sort((a,b)=>b.modelProb*(1-(b.pushProb??0))-a.modelProb*(1-(a.pushProb??0))||b.edgePercent-a.edgePercent||a.id.localeCompare(b.id)).map(p=>({...p,eventKey:p.eventKey??machineFixtureKey(p)})).filter(p=>p.pricing==='quoted'&&Number.isFinite(p.bestOdds)&&p.bestOdds>1).filter(p=>{const count=counts.get(p.eventKey??machineFixtureKey(p))??0;counts.set(p.eventKey??machineFixtureKey(p),count+1);return count<8;});
 const excluded=new Set(options.excludeFixtures??[]);let evaluated=0;const maxEvaluations=300000;
 let beam=[{picks:/** @type {Pick[]} */([]),odds:1,probability:1,last:-1}];
 const maximum=Math.min(30,new Set(pool.map(p=>p.eventKey??machineFixtureKey(p))).size);
 let best=/** @type {typeof beam[number]|undefined} */(undefined);
 for(let depth=0;depth<maximum;depth++) {
  const next=[];
  for(const state of beam) for(let i=state.last+1;i<pool.length;i++) {
   if(++evaluated>maxEvaluations)break;
   const pick=pool[i];
   if(state.picks.some(p=>(p.eventKey??machineFixtureKey(p))===(pick.eventKey??machineFixtureKey(pick))))continue;
   const odds=state.odds*pick.bestOdds;
   if(!Number.isFinite(odds)||odds>options.maxTotal)continue;
   const probability=state.probability*pick.modelProb*(1-(pick.pushProb??0));
   const candidate={picks:[...state.picks,pick],odds,probability,last:i};
   const valid=odds>=options.minTotal&&!excluded.has(ticketFixtureKey(candidate.picks));
   if(valid){if(!best||probability>best.probability||(probability===best.probability&&candidate.picks.length<best.picks.length))best=candidate;}
   else if(!best||probability>best.probability)next.push(candidate);
  }
  // Extending a valid ticket only reduces its all-win probability; extend unfinished paths only.
  next.sort((a,b)=>b.probability-a.probability);
  const kept=new Map();beam=next.filter(state=>{if(best&&state.probability<=best.probability)return false;const band=Math.floor(Math.log(state.odds)*15);const n=kept.get(band)??0;kept.set(band,n+1);return n<12;}).slice(0,400);
  if(!beam.length||evaluated>maxEvaluations)break;
 }
 return best?{picks:rankMachineDisplay(best.picks),combinedOdds:best.odds,combinedProbability:best.probability,considered:pool.length,fixtureKey:ticketFixtureKey(best.picks),searchLimited:evaluated>maxEvaluations}:null;
}

/** A probability-ranked research shortlist, never a claim that target odds were reached.
 * The best selection per fixture prevents conflicting legs. Unquoted prices contribute no odds.
 * @param {Pick[]} candidates @param {number} [limit]
 */
export function buildModelShortlist(candidates, limit = Infinity) {
 const seen = new Set();
 const picks = [...candidates].filter(p=>Number.isFinite(p.modelProb)&&p.modelProb>0&&p.modelProb<=1&&(p.pushProb??0)>=0&&(p.pushProb??0)<1)
  .sort((a,b)=>b.modelProb*(1-(b.pushProb??0))-a.modelProb*(1-(a.pushProb??0))||a.id.localeCompare(b.id))
  .filter(p=>{if(seen.has(p.eventKey??machineFixtureKey(p)))return false;seen.add(p.eventKey??machineFixtureKey(p));return true;}).slice(0,Math.max(1,limit));
 if(!picks.length)return null;
 const quoted=picks.filter(p=>p.pricing==='quoted'&&Number.isFinite(p.bestOdds)&&p.bestOdds>1);
 return {picks:rankMachineDisplay(picks),combinedOdds:quoted.reduce((n,p)=>n*p.bestOdds,1),combinedProbability:picks.reduce((n,p)=>n*p.modelProb*(1-(p.pushProb??0)),1),considered:candidates.length,fixtureKey:ticketFixtureKey(picks),searchLimited:false};
}
