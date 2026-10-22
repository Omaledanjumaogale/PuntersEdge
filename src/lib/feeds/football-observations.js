/** Strict API-Football completed regulation observations. No score-derived goal ordering. */
import {settleTwoConsecutive} from '../engine/goal_sequence.js';
/** @param {any} body @param {any} g @param {number} now */
export function parseGoalSequence(body,g,now){
 if(g.status.state!=='finished'||!Array.isArray(body?.response)||body.paging?.total>1)return null;
 const goals=body.response.filter((/** @type {any} */e)=>e.type==='Goal'&&['Normal Goal','Own Goal','Penalty'].includes(e.detail));
 if(body.response.some((/** @type {any} */e)=>e.type==='Goal'&&!['Normal Goal','Own Goal','Penalty','Missed Penalty'].includes(e.detail)))return null;
 // Own-goal credit semantics must be independently verified before admitting these fixtures.
 if(goals.some((/** @type {any} */e)=>e.detail==='Own Goal'))return null;
 const sides=[];let last=-1;
 for(const e of goals){const t=e.time?.elapsed,extra=e.time?.extra??0;if(!Number.isInteger(t)||t<0||!Number.isInteger(extra)||extra<0)return null;if(t>90)continue;
 const minute=t*10000+extra;if(minute<last||minute===last)return null;last=minute;
 const id=String(e.team?.id),h=String(g.homeId),a=String(g.awayId);if(id!==h&&id!==a)return null;
 // Own goals were rejected above; admitted events identify the scoring team.
 sides.push(id===h?'home':'away');}
 const seq={complete:true,scope:'regulation',sides,observedAt:now,provider:'api-football'};
 return settleTwoConsecutive(seq,g.status,'home')===null?null:seq;
}
/** @param {any} body @param {any} g @param {number} now */
export function parseCorners(body,g,now){
 // Full-match statistics may include extra time; accept FT only, never AET/PEN.
 if(g.status.state!=='finished'||g.status.detail!=='FT'||!Array.isArray(body?.response)||body.paging?.total>1)return null;
 const count=(/** @type {any} */id)=>{const rows=body.response.filter((/** @type {any} */r)=>String(r.team?.id)===String(id));if(rows.length!==1)return null;const stats=rows[0].statistics?.filter((/** @type {any} */s)=>s.type==='Corner Kicks');const v=stats?.length===1?stats[0].value:null;return Number.isInteger(v)&&v>=0&&v<=50?v:null;};
 const home=count(g.homeId),away=count(g.awayId);return home===null||away===null?null:{home,away,scope:'regulation',observedAt:now,provider:'api-football'};
}
