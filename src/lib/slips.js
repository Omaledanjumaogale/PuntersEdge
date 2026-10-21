import {settlePeriod} from './engine/period_settlement.js';
import {fixtureMetadataLines} from './fixture-metadata.js';
import {slipPricing} from './slip-pricing.js';
import { settle } from './engine/settlement.js';
/** @typedef {{selection:string,marketKey?:string,sport?:string,family?:string,fixtureStatus?:string,periodScores?:Record<string,{home:number,away:number}>,score?:{home:number,away:number,regHome?:number,regAway?:number}}} OutcomeItem */
/** @typedef {OutcomeItem & {league?:string,tournament?:string,country?:string,matchTitle:string,bookmaker:string,odds:number,modelProb?:number,kickoff?:number|string,market?:string}} ShareItem */

/** Convert saved market IDs to the engine's score-settlement vocabulary. */
export function settlementKey(/** @type {OutcomeItem} */ item) {
  const key = item.marketKey;
  if (!key) return null;
  if (key === 'over25') return 'o2.5';
  if (key === 'under25') return 'u2.5';
  if (['over', 'under', 'homeSpread', 'awaySpread'].includes(key)) {
    const match = item.selection.match(/(-?\d+(?:\.\d+)?)\s*(?:points?|goals?)?$/i);
    if (!match) return null;
    return `${key === 'over' ? 'o' : key === 'under' ? 'u' : key === 'homeSpread' ? 'sph' : 'spa'}${Number(match[1])}`;
  }
  const forecast=/^forecast:full:(total|home|away):(over|under):([\d.]+)$/.exec(key);
  if(forecast)return `${forecast[1]==='total'?'':forecast[1]==='home'?'teamh':'teama'}${forecast[2]==='over'?'o':'u'}${forecast[3]}`;
  const handicap=/^forecast:full:handicap:(home|away):(-?[\d.]+)$/.exec(key);
  if(handicap)return `${item.sport==='football'?'ah':'sp'}${handicap[1]==='home'?'h':'a'}${handicap[2]}`;
  return key;
}
export function itemOutcome(/** @type {OutcomeItem} */ item) {
  if (item.fixtureStatus === 'cancelled') return 'void';
  if (item.fixtureStatus !== 'finished' || !item.score) return 'pending';
  if(item.marketKey?.startsWith('period:'))return settlePeriod(item.marketKey,item.periodScores??{})??'ungraded';
  const key = settlementKey(item);
  if (!key) return 'ungraded';
  const family = item.family === 'nba' || item.sport === 'nba' ? 'basketball' : item.family || item.sport;
  if (!['football','basketball','hockey','baseball'].includes(family ?? '')) return 'ungraded';
  return settle(/** @type {'football'|'basketball'|'hockey'|'baseball'} */ (family), key, item.score) || 'ungraded';
}
export function slipOutcome(/** @type {OutcomeItem[]} */ items, /** @type {string} */ betType = 'acca') {
  const outcomes = items.map(itemOutcome);
  if (betType === 'acca' && outcomes.some(value => value === 'lost')) return 'lost';
  if (outcomes.some(value => value === 'pending')) return 'pending';
  if (outcomes.some(value => value === 'ungraded')) return 'ungraded';
  if (outcomes.every(value => value === 'void' || value === 'push')) return 'void';
  if (outcomes.some(value => value === 'half-lost' || value === 'half-won')) return 'partial';
  if (outcomes.every(value => value === 'lost' || value === 'void' || value === 'push')) return 'lost';
  if (betType === 'singles' && outcomes.some(value => value === 'lost')) return 'mixed';
  return 'won';
}
export function shareSlipText(/** @type {{name:string,betType:string,stake:number,potentialReturn:number,items:ShareItem[]}} */ slip) {
  const pricing=slipPricing(slip.items,slip.stake,slip.betType);
  const money = (/** @type {number} */ number) => `NGN ${Number(number).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
  return [
    `PuntersEdge — ${slip.name}`,
    'https://puntersedge.ewinproject.org/betslips',
    `${slip.betType === 'acca' ? 'Accumulator' : 'Singles'} · ${slip.items.length} selections`,
    `${pricing.unpricedCount?'Quoted subset odds':'Combined odds'}: ${pricing.quotedCount?pricing.totalOdds.toFixed(2):'Unavailable'}${pricing.unpricedCount?' · '+pricing.unpricedCount+' unpriced selections excluded':''}`,
    ...slip.items.map((item, index) => `*${index + 1}. ${item.matchTitle}*\n${fixtureMetadataLines(item).join('\n')}\n${item.kickoff ? new Date(item.kickoff).toLocaleString('en-NG',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'})+' WAT\n' : ''}Pick: ${item.selection}\n${item.market ? 'Market: '+item.market+'\n' : ''}Odds: ${item.odds>1?item.odds.toFixed(2):'Unpriced'} · ${item.bookmaker}\n${item.modelProb !== undefined ? 'Model: '+(item.modelProb*100).toFixed(1)+'%\n' : ''}${item.score ? `\nScore: ${item.score.home}-${item.score.away}${item.score.regHome !== undefined && item.score.regAway !== undefined && (item.score.regHome !== item.score.home || item.score.regAway !== item.score.away) ? ` (regulation ${item.score.regHome}-${item.score.regAway})` : ''} · ${itemOutcome(item)}` : ''}`),
    `Stake: ${money(slip.stake)}${slip.betType === 'singles' ? ' per selection' : ''}`,
    `${pricing.unpricedCount?'Quoted subset return (full ticket unknown)':'Potential return'}: ${money(pricing.potentialReturn)}`,
    'Analytical record only. PuntersEdge does not place bets. 18+.',
  ].join('\n\n');
}
