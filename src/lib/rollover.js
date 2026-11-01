/** @typedef {{picks:any[],odds:number,probability:number}} Ticket */
import {cohortKey,evidenceMarket} from './evidence-shortlist.js';
export const ROLLOVER_QUOTE_MAX_AGE_MS=36*3600000;
/** All published options, without the evidence-shortlist's display thresholds.
 * Current quoted prices may change after publication; probabilities remain frozen.
 * @param {any} report @param {Map<string,any>} predictions @param {Map<string,any>} games @param {Map<string,any>} inputs @param {number} [now] */
export function rolloverCandidates(report,predictions,games,inputs,now=Date.now()){
 const rows=[];
 for(const f of report?.upcoming??[]){const g=games.get(f.fixtureId);if(f.kickoff<=now||f.publishedAt>now||g?.status?.state!=='scheduled'||f.state==='finished')continue;
  const p=predictions.get(f.fixtureId),input=inputs.get(f.fixtureId),quotes=new Map();
  for(const s of p?.markets?.flatMap((/** @type {any} */m)=>m.selections)??[]){if(s.pricing!=='quoted'||s.bestOdds<=1)continue;const key=s.id.slice(f.fixtureId.length+1),market=evidenceMarket(key,f.sport);if(!market)continue;
   let at=s.quoteObservedAt;
   if(!Number.isFinite(at)){const fields=f.sport==='football'&&['o2.5','u2.5'].includes(key)?[key==='o2.5'?'over25':'under25']:key==='homeMl'?['homeMoneyline']:key==='awayMl'?['awayMoneyline']:/^[ou]\d/.test(key)?['totalLine',key[0]==='o'?'overOdds':'underOdds']:/^sp[ha]/.test(key)?['spreadLine',key[2]==='h'?'homeSpreadOdds':'awaySpreadOdds']:[key];const times=fields.map(k=>{const fetched=input?.quoteFetchedAt?.[s.bookmaker]?.[k],source=input?.quoteSourceAt?.[s.bookmaker]?.[k];return Number.isFinite(source)?Number.isFinite(fetched)?Math.min(source,fetched):source:fetched;});at=times.every(Number.isFinite)?Math.min(...times):null;}
   const old=quotes.get(market.signature);if(!old||at>old.at||at===old.at&&s.bestOdds>old.selection.bestOdds)quotes.set(market.signature,{selection:s,at});
  }
  for(const r of f.rows??[]){const q=quotes.get(r.signature),cohort=report.groups?.[cohortKey(f,r)]??{binaryN:0,won:0,lost:0,push:0,partial:0,strikeRate:null,interval:{low:0,high:1}};
   rows.push({...f,...r,id:`${f.fixtureId}:${r.key}`,cohort,odds:q?.selection.bestOdds??(r.pricing==='quoted'?r.odds:0),pricing:q?'quoted':r.pricing,bookmaker:q?.selection.bookmaker??'Published quote',quoteObservedAt:q?q.at:r.quoteObservedAt,quotedSelectionId:q?.selection.id??null});
  }
 }return rows;
}
/** Preserve a historical tab when the date rolls forward; only a selected Today follows midnight.
 * @param {string} selected @param {number} before @param {number} after */
export function rolloverSelectedDay(selected,before,after){return selected===rolloverDay(before)?rolloverDay(after):selected;}
/** Lagos calendar date. @param {number} time */
export const rolloverDay=time=>new Date(time+3600000).toISOString().slice(0,10);
/** Consecutive calendar wins ending at the most recent completed day. Gaps,
 * pending, losses and voids break the streak; targets never pool their records.
 * @param {any[]} records @param {number} target @param {number} [now] */
export function rolloverStreak(records,target,now=Date.now()){
 const today=rolloverDay(now),map=new Map(records.filter(r=>r.target===target).map(r=>[r.day,r]));
 if(map.has(today)&&!['pending','won'].includes(map.get(today).status))return 0;
 let date=today;if(map.get(today)?.status!=='won')date=rolloverDay(now-86400000);
 let streak=0;for(let i=0;i<90;i++){if(map.get(date)?.status!=='won')break;streak++;date=rolloverDay(Date.parse(date+'T12:00:00Z')-86400000);}return streak;
}
/** Bounded deterministic beam search. Each fixture can appear once across a day's tickets.
 * Published model probabilities drive the screen; historical cohorts break ties.
 * Historical cohorts are descriptive, not independent validation of future returns.
 * @param {any[]} rows @param {string} day @param {number} [now] @param {any[]} [recorded] @param {{positiveValueOnly?:boolean}} [options] */
export function rolloverTickets(rows,day,now=Date.now(),recorded=[],options={}){
 const frozen=recorded.filter(r=>r.day===day),reserved=new Set(frozen.flatMap(t=>t.legs.map((/** @type {any} */l)=>l.fixtureId))),names=new Set(frozen.flatMap(t=>t.legs.map((/** @type {any} */l)=>eventName(l))));
 const rejected={unpriced:0,staleQuote:0,insufficientEvidence:0,noEdge:0},pool=[];
 for(const row of rows){if(reserved.has(row.fixtureId)||names.has(eventName(row))||row.kickoff<=now||rolloverDay(row.kickoff)!==day||row.state==='finished')continue;
  if(row.pricing!=='quoted'||!Number.isFinite(row.odds)||row.odds<=1){rejected.unpriced++;continue;}
  if(!Number.isFinite(row.quoteObservedAt)||now-row.quoteObservedAt>ROLLOVER_QUOTE_MAX_AGE_MS||row.quoteObservedAt>now+60000){rejected.staleQuote++;continue;}
  if(!Number.isFinite(row.modelProb)||row.modelProb<.55||row.modelProb>=1){rejected.insufficientEvidence++;continue;}
  const probability=row.modelProb,edge=probability*row.odds-1;
  // Exclude push/partial markets from the simple binary accumulator calculation.
  if(options.positiveValueOnly&&edge<=0||row.pushProb>0||row.line!==null&&row.line!==undefined&&!Number.isInteger(row.line*2)){rejected.noEdge++;continue;}
  pool.push({...row,screenProbability:probability,modelEdge:edge});
 }
 pool.sort((a,b)=>b.screenProbability-a.screenProbability||(b.cohort?.interval?.low??0)-(a.cohort?.interval?.low??0)||b.modelEdge-a.modelEdge||a.id.localeCompare(b.id));
 const used=new Set(),tickets=[];
 for(const target of [2,3,5,10]){if(frozen.some(t=>t.target===target)){tickets.push({target,picks:[],odds:0,probability:0,status:'recorded'});continue;}const lower=target*.9,upper=target*1.1;let beam=/** @type {Ticket[]} */([{picks:[],odds:1,probability:1}]),best=/** @type {Ticket|null} */(null);
  const events=new Map();for(const r of pool){if(used.has(event(r)))continue;const key=event(r);if(!events.has(key))events.set(key,[]);events.get(key).push(r);}
  for(const options of events.values()){
   const next=[...beam];for(const ticket of beam){if(ticket.picks.length>=12)continue;for(const r of options.slice(0,4)){const odds=ticket.odds*r.odds;if(odds>upper)continue;const candidate={picks:[...ticket.picks,r],odds,probability:ticket.probability*r.screenProbability};next.push(candidate);if(candidate.picks.length>=2&&odds>=lower&&(!best||candidate.probability>best.probability||candidate.probability===best.probability&&Math.abs(odds-target)<Math.abs(best.odds-target)))best=candidate;}}
   // Preserve diversity in odds progress, rather than pruning all low-probability long tickets.
   const buckets=/** @type {Map<number,Ticket[]>} */(new Map());for(const t of next){const key=Math.floor(Math.log(t.odds)/Math.log(upper)*100),bucket=buckets.get(key)??[];bucket.push(t);bucket.sort((a,b)=>b.probability-a.probability);buckets.set(key,bucket.slice(0,3));}beam=[...buckets.values()].flat();
  }
  if(best)for(const r of best.picks)used.add(event(r));tickets.push({target,...(best??{picks:[],odds:0,probability:0}),status:best?'available':'no-qualified-combination'});
 }
 return {tickets,eligible:pool.length,rejected};
}
/** Duplicate feeds can use different IDs for the same event. @param {any} row */
function event(row){return JSON.stringify([row.sport==='nba'?'basketball':row.sport,String(row.matchTitle).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,''),Math.floor(row.kickoff/60000)]);}
/** @param {any} row */
function eventName(row){return JSON.stringify([String(row.matchTitle).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,''),Math.floor(row.kickoff/60000)]);}
