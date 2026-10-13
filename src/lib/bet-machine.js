/** A bounded probability optimizer, using published predictions and real quotes only. */
/** @typedef {{id:string;fixtureId:string;sport:string;market:string;selection:string;modelProb:number;bestOdds:number;pricing:string;edgePercent:number;pushProb?:number;[key:string]:any}} Pick */
/** @param {any[]} predictions @param {any} options @param {number} now */
export function machineCandidates(predictions, options, now = Date.now()) {
 const rows = [];
 for(const p of predictions) {
  const kickoff=Date.parse(p.kickoffTime);
  if(p.status.state!=='scheduled'||kickoff<=now||kickoff<options.from||kickoff>options.to||!options.publishedIds.has(p.fixtureId)||!options.sports.includes(p.sport))continue;
  if(options.direction==='home' && p.probabilities && p.probabilities.homeWin <= Math.max(p.probabilities.awayWin,p.probabilities.draw??0))continue;
  if(options.direction==='away' && p.probabilities && p.probabilities.awayWin <= Math.max(p.probabilities.homeWin,p.probabilities.draw??0))continue;
  for(const group of p.markets) for(const pick of group.selections) {
   if(pick.pricing!=='quoted'||!Number.isFinite(pick.bestOdds)||pick.bestOdds<options.minOdds||pick.bestOdds>options.maxOdds||pick.modelProb<options.minProbability||pick.modelProb>1)continue;
   if(options.positiveValue && !(pick.edgePercent>0 && pick.edgePercent<=25))continue;
   if(options.markets.length && !options.markets.includes(group.key))continue;
   const key=pick.id.slice(p.fixtureId.length+1);
   const direction= /^(?:o\d|over)/.test(key)?'over':/^(?:u\d|under)/.test(key)?'under':/^(?:home|h$|sph|th)/.test(key)?'home':/^(?:away|a$|spa|ta)/.test(key)?'away':key==='draw'?'draw':'other';
   if(options.direction!=='all'&&direction!==options.direction)continue;
   rows.push({...pick,kickoffTime:p.kickoffTime,group:group.key,successProbability:pick.modelProb*(1-(pick.pushProb??0))});
  }
 }
 return rows.sort((a,b)=>b.successProbability-a.successProbability||b.edgePercent-a.edgePercent||a.id.localeCompare(b.id));
}
/** @param {Pick[]} candidates @param {{legs:number;minTotal:number;maxTotal:number}} options */
export function buildMachineTicket(candidates, options) {
 if(!Number.isInteger(options.legs)||options.legs<1||options.legs>12||!(options.minTotal>=1)||options.maxTotal<options.minTotal)throw new Error('Choose 1–12 legs and a valid combined odds range.');
 const pool=candidates.slice(0,200);
 let beam=[{picks:/** @type {Pick[]} */([]),odds:1,probability:1,last:-1}];
 for(let leg=0;leg<options.legs;leg++) {
  const next=[];
  for(const state of beam) for(let i=state.last+1;i<pool.length;i++) {
   const pick=pool[i];
   if(state.picks.some(p=>p.fixtureId===pick.fixtureId))continue;
   const odds=state.odds*pick.bestOdds;
   if(odds>options.maxTotal)continue;
   next.push({picks:[...state.picks,pick],odds,probability:state.probability*pick.modelProb*(1-(pick.pushProb??0)),last:i});
  }
  // Preserve paths across odds bands so short-priced favorites cannot starve a target range.
  next.sort((a,b)=>b.probability-a.probability);
  const kept=new Map();beam=next.filter(state=>{const band=Math.floor(Math.log(state.odds)*10);const n=kept.get(band)??0;kept.set(band,n+1);return n<12;}).slice(0,400);
  if(!beam.length)break;
 }
 const ticket=beam.filter(s=>s.picks.length===options.legs&&s.odds>=options.minTotal&&s.odds<=options.maxTotal).sort((a,b)=>b.probability-a.probability||b.odds-a.odds)[0];
 return ticket?{picks:ticket.picks,combinedOdds:ticket.odds,combinedProbability:ticket.probability,considered:pool.length}:null;
}
