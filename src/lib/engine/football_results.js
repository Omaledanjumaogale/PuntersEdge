import {settleTwoConsecutive} from './goal_sequence.js';
/** @param {string} key @param {any} corners */
export function settleCorners(key,corners){const m=/^corners:regulation:(home|away|total):(over|under):(\d+\.5)$/.exec(key);if(!m||corners?.scope!=='regulation'||!Number.isInteger(corners.home)||!Number.isInteger(corners.away)||corners.home<0||corners.away<0)return null;const n=m[1]==='total'?corners.home+corners.away:corners[m[1]];return (n>Number(m[3]))===(m[2]==='over')?'won':'lost';}
/** Small authoritative facts for saved-slip settlement; raw events stay in private R2. @param {any} game */
export function footballResults(game){const out=/** @type {Record<string,'won'|'lost'>} */({});if(game.status.state!=='finished')return out;
 for(const side of /** @type {const} */(['home','away'])){const key=`sequence:regulation:two-consecutive:${side}`,r=settleTwoConsecutive(game.goalSequence,game.status,side);if(r)out[key]=r;}
 if(game.status.detail==='FT')for(const scope of ['total','home','away'])for(const direction of ['over','under']){const key=`corners:regulation:${scope}:${direction}:${scope==='total'?9.5:4.5}`,r=settleCorners(key,game.corners);if(r)out[key]=r;}return out;
}
