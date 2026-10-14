/** @param {string} key @param {Record<string,{home:number,away:number}>} scores */
export function settlePeriod(key,scores) {
 const m=/^period:(first_half|first_quarter|first_period|regulation|first_five|first_inning):(total|home|away|handicap):(over|under|home|away):(-?\d+(?:\.\d+)?)$/.exec(key);
 if(!m)return null;const s=scores?.[m[1]],line=Number(m[4]);if(!s||![s.home,s.away].every(Number.isFinite)||!Number.isInteger(line*4))return null;
 const value=m[2]==='total'?s.home+s.away:m[2]==='handicap'?(m[3]==='home'?s.home-s.away:s.away-s.home):s[m[2]==='home'?'home':'away'];
 const lines=Math.abs(line*4%2)===1?[line-.25,line+.25]:[line];
 /** @type {number[]} */ const parts=lines.map(l=>{const diff=m[2]==='handicap'?value+l:(value-l)*(m[3]==='over'?1:-1);return diff>0?1:diff<0?-1:0;});
 const result=parts.reduce((a,b)=>a+b,0)/parts.length;return /** @type {'won'|'lost'|'push'|'half-won'|'half-lost'} */(result===1?'won':result===-1?'lost':result===0?'push':result>.0?'half-won':'half-lost');
}
