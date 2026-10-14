import { rankSelections } from './decision_screener.js';
export const MAX_QUOTE_AGE_MS = 15 * 60_000;
/** @param {string} key */
export function quoteKeys(key) {
 if(['home','draw','away'].includes(key))return ['home','draw','away'];
 if(['homeMl','awayMl'].includes(key))return ['homeMoneyline','awayMoneyline'];
 if(['over25','under25'].includes(key))return ['over25','under25'];
 if(['bttsYes','bttsNo'].includes(key))return ['bttsYes','bttsNo'];
 if(/^[ou]\d/.test(key))return ['totalLine','overOdds','underOdds'];
 if(/^sp[ha]/.test(key))return ['spreadLine','homeSpreadOdds','awaySpreadOdds'];
 return [];
}
/** Shared server/client production gates. @param {any} p @param {any} input @param {number} now */
export function applyEvidence(p,input,now) {
 const evidence=input.analysisEvidence??{approved:false,independent:false,domainSupported:false,approvedMarkets:[],modelVersion:'legacy-unvalidated'};
 p.analysisEvidence=evidence;
 p.confidenceStatus=evidence.approved?'Validated segment':'Unvalidated estimate';
 const rows=p.markets.flatMap((/** @type {any} */g)=>g.selections);
 for(const s of rows){
  const reasons=[];
  const key=s.id.slice(p.fixtureId.length+1), keys=quoteKeys(key);
  const times=keys.map(k=>input.quoteSourceAt?.[s.bookmaker]?.[k]);
  if(!evidence.approved || !evidence.approvedMarkets?.includes(s.market))reasons.push('No validated model for this market');
  if(evidence.independent!==true)reasons.push('No independent team-strength evidence');
  if(p.status.state!=='scheduled'||Date.parse(p.kickoffTime)<=now)reasons.push('Pre-match forecast only');
  if(s.pricing!=='quoted')reasons.push('No executable bookmaker quote');
  if(!keys.length||times.some(t=>!Number.isFinite(t)||t>now||now-t>MAX_QUOTE_AGE_MS))reasons.push('Quote timestamp missing or stale');
  if(evidence.domainSupported!==true)reasons.push('Competition or settlement rules not validated');
  s.eligibilityReasons=reasons;
  s.quoteObservedAt=times.length&&times.every(Number.isFinite)?Math.min(...times):null;
  if(reasons.length){s.eligible=false;s.grade='PASS';s.kellyStakePercent=0;}
 }
 p.valueBets=rankSelections(rows.filter((/** @type {any} */s)=>s.pricing==='quoted'));
 p.bestValue=p.valueBets[0];
 return p;
}
