/** Verify a complete regulation-time sequence of goals credited to each side.
 * Own goals must be credited to the benefiting team; exclude shootouts, extra time and disallowed goals.
 * @param {any} sequence @param {any} score @param {'home'|'away'} side
 * @returns {'won'|'lost'|null}
 */
export function settleTwoConsecutive(sequence,score,side){
 if(!['home','away'].includes(side)||sequence?.complete!==true||sequence?.scope!=='regulation'||!Array.isArray(sequence?.sides))return null;
 const h=score?.regHome??score?.home,a=score?.regAway??score?.away;
 if(!Number.isInteger(h)||!Number.isInteger(a)||h<0||a<0||sequence.sides.some((/** @type {any} */s)=>!['home','away'].includes(s)))return null;
 if(sequence.sides.filter((/** @type {string} */s)=>s==='home').length!==h||sequence.sides.filter((/** @type {string} */s)=>s==='away').length!==a)return null;
 return sequence.sides.some((/** @type {string} */s,/** @type {number} */i)=>i>0&&s===side&&sequence.sides[i-1]===side)?'won':'lost';
}
