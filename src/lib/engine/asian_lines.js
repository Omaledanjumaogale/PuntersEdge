/** Complete quarter-line outcome distribution; never treat a half win as a full win.
 * @param {number[][]} matrix @param {number} line @param {'home'|'away'} side */
export function asianOutcomes(matrix,line,side='home') {
 if(!Number.isFinite(line)||!Number.isInteger(line*4))throw new Error('Whole, half and quarter lines only');
 const lines=Math.abs(line*4%2)===1?[line-.25,line+.25]:[line];
 const p={win:0,halfWin:0,push:0,halfLose:0,lose:0};
 for(let h=0;h<matrix.length;h++)for(let a=0;a<matrix[h].length;a++){
  const margin=side==='home'?h-a:a-h;/** @type {number[]} */ const parts=lines.map(l=>margin+l>0?1:margin+l<0?-1:0);const result=parts.reduce((s,x)=>s+x,/** @type {number} */(0))/parts.length;
  p[result===1?'win':result===.5?'halfWin':result===0?'push':result===-.5?'halfLose':'lose']+=matrix[h][a];
 }
 const winningCredit=p.win+.5*p.halfWin,losingCredit=p.lose+.5*p.halfLose;
 return {...p,fairOdds:winningCredit>0?1+losingCredit/winningCredit:null};
}
/** Informational quarter lines: theoretical fair prices, no fabricated bookmaker offers.
 * @param {any} input @param {any} prediction */
export function addAsianQuarterMarkets(input,prediction) {
 if(prediction.family!=='football')return prediction;
 // Reconstruct the full matrix; the UI matrix is truncated for display.
 const matrix=input.fullScoreMatrix;if(!matrix)return prediction;
 const rows=[];for(const line of [-1.75,-1.25,-.75,-.25,.25,.75,1.25,1.75])for(const side of /** @type {const} */(['home','away'])){
  const p=asianOutcomes(matrix,line,side);if(!p.fairOdds)continue;
  rows.push({id:`${prediction.fixtureId}:ah${side==='home'?'h':'a'}${line}`,fixtureId:prediction.fixtureId,sport:'football',matchTitle:prediction.matchTitle,league:prediction.league,market:'Asian handicap · quarter line',selection:`${side==='home'?prediction.homeTeam:prediction.awayTeam} ${line>0?'+':''}${line}`,modelProb:p.win,marketProb:p.win,pushProb:p.push,settlementProbabilities:p,fairOdds:p.fairOdds,bestOdds:0,bookmaker:'No quoted quarter-line price',edgePercent:0,kellyStakePercent:0,grade:'PASS',pricing:'derived',eligible:false,eligibilityReasons:['No executable quarter-line quote','Half outcomes require complete distribution']});
 }
 prediction.markets.push({key:'asian-quarter',title:'Asian quarter handicaps',emoji:'⚖️',blurb:'Full win, half win, push, half loss and loss are modeled separately. Fair prices are theoretical.',selections:rows});return prediction;
}
