/** Bounded persisted tickets; complete research lists are not truncated. */
export const MAX_SLIP_SELECTIONS=100;
/** Zero is the persisted "unpriced selection" marker, never an offered price. */
export const hasQuotedOdds = (/** @type {{odds:number}} */ item) => Number.isFinite(item.odds) && item.odds > 1;
/** Quoted subset only. Accumulator decimal odds multiply; missing odds contribute nothing. */
export function slipPricing(/** @type {{odds:number}[]} */ items, stake=0, betType='acca') {
 const quoted=items.filter(hasQuotedOdds),unpricedCount=items.length-quoted.length;
 const totalOdds=quoted.length?Math.round(quoted.reduce((n,item)=>n*item.odds,1)*100)/100:0;
 const potentialReturn=stake*(betType==='singles'?quoted.reduce((n,item)=>n+item.odds,0):totalOdds);
 return {quotedCount:quoted.length,unpricedCount,totalOdds,potentialReturn:Math.round(potentialReturn*100)/100,complete:unpricedCount===0};
}
export const validSlipOdds=(/** @type {number} */ odds)=>Number.isFinite(odds)&&(odds===0||(odds>1&&odds<=10000));
