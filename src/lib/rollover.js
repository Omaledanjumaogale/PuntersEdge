/** Lagos calendar date. @param {number} time */
export const rolloverDay=time=>new Date(time+3600000).toISOString().slice(0,10);
/** Bounded deterministic beam search. Each fixture can appear once across a day's tickets.
 * Conservative edge uses the lower of published Model % and the historical Wilson floor.
 * Historical cohorts are descriptive, not independent validation of future returns.
 * @param {any[]} rows @param {string} day @param {number} [now] */
export function rolloverTickets(rows,day,now=Date.now()){
 const rejected={unpriced:0,staleQuote:0,insufficientEvidence:0,noEdge:0},pool=[];
 for(const row of rows){if(row.kickoff<=now||rolloverDay(row.kickoff)!==day||row.state==='finished')continue;
  if(row.pricing!=='quoted'||!Number.isFinite(row.odds)||row.odds<=1){rejected.unpriced++;continue;}
  if(!Number.isFinite(row.quoteObservedAt)||now-row.quoteObservedAt>1800000||row.quoteObservedAt>now+60000){rejected.staleQuote++;continue;}
  const c=row.cohort;if(!c||c.binaryN<20||!Number.isFinite(c.interval?.low)||!Number.isFinite(row.modelProb)||row.modelProb<.55){rejected.insufficientEvidence++;continue;}
  const probability=Math.min(row.modelProb,c.interval.low),edge=probability*row.odds-1;
  // Exclude push/partial markets from the simple binary accumulator calculation.
  if(edge<=0||row.pushProb>0||c.push>0||c.partial>0){rejected.noEdge++;continue;}
  pool.push({...row,screenProbability:probability,conservativeEdge:edge});
 }
 pool.sort((a,b)=>b.screenProbability-a.screenProbability||b.conservativeEdge-a.conservativeEdge||a.id.localeCompare(b.id));
 const used=new Set(),tickets=[];
 for(const target of [2,3,5,10]){const lower=target*.9,upper=target*1.1;let beam=[{picks:[],odds:1,probability:1}],best=null;
  const events=new Map();for(const r of pool){if(used.has(event(r)))continue;const key=event(r);if(!events.has(key))events.set(key,[]);events.get(key).push(r);}
  for(const options of events.values()){
   const next=[...beam];for(const ticket of beam){if(ticket.picks.length>=12)continue;for(const r of options.slice(0,4)){const odds=ticket.odds*r.odds;if(odds>upper)continue;const candidate={picks:[...ticket.picks,r],odds,probability:ticket.probability*r.screenProbability};next.push(candidate);if(candidate.picks.length>=2&&odds>=lower&&(!best||candidate.probability>best.probability||candidate.probability===best.probability&&Math.abs(odds-target)<Math.abs(best.odds-target)))best=candidate;}}
   // Preserve diversity in odds progress, rather than pruning all low-probability long tickets.
   const buckets=new Map();for(const t of next){const key=Math.floor(Math.log(t.odds)/Math.log(upper)*100),bucket=buckets.get(key)??[];bucket.push(t);bucket.sort((a,b)=>b.probability-a.probability);buckets.set(key,bucket.slice(0,3));}beam=[...buckets.values()].flat();
  }
  if(best)for(const r of best.picks)used.add(event(r));tickets.push({target,...(best??{picks:[],odds:0,probability:0}),status:best?'available':'no-qualified-combination'});
 }
 return {tickets,eligible:pool.length,rejected};
}
/** Duplicate feeds can use different IDs for the same event. @param {any} row */
function event(row){return JSON.stringify([row.sport==='nba'?'basketball':row.sport,String(row.matchTitle).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,''),Math.floor(row.kickoff/60000)]);}
