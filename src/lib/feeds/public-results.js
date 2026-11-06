import {bestMatch} from './matching.js';
const routes={nba:'basketball/nba',NHL:'hockey/nhl',MLB:'baseball/mlb','Premier League':'soccer/eng.1','Champions League':'soccer/uefa.champions','Copa del Rey':'soccer/esp.copa_del_rey'};
/** Verified final scores only. Never translate an old kickoff into a result.
 * @param {any} body @param {any[]} games @param {number} now */
export function applyPublicResults(body,games,now){let updated=0;
 for(const event of body.events??[]){const c=event.competitions?.[0];if(c?.status?.type?.completed!==true&&event.status?.type?.completed!==true)continue;
  const h=c.competitors?.find((/** @type {any} */t)=>t.homeAway==='home'),a=c.competitors?.find((/** @type {any} */t)=>t.homeAway==='away'),home=Number(h?.score),away=Number(a?.score),kickoff=Date.parse(c.date??event.date);
  if(!h||!a||h.score==null||a.score==null||!Number.isInteger(home)||!Number.isInteger(away)||home<0||away<0||kickoff>=now)continue;
  const target={home:h.team?.displayName??'',away:a.team?.displayName??'',kickoff},pool=games.filter(g=>g.status.state!=='finished'&&g.kickoff<now),opts={windowMs:15*60000,minTeam:.88};
  const match=bestMatch(target,pool,opts);if(!match)continue;const other=bestMatch(target,pool.filter(g=>g.uid!==match.item.uid),opts);if(other&&Math.abs(other.score-match.score)<.1)continue;
  const g=match.item,periodScores={};const period=(/** @type {number[]} */ids)=>{const hs=ids.map(i=>h.linescores?.find((/** @type {any} */x)=>x.period===i)?.value),as=ids.map(i=>a.linescores?.find((/** @type {any} */x)=>x.period===i)?.value);return [...hs,...as].every(x=>Number.isInteger(x)&&x>=0)?{home:hs.reduce((n,v)=>n+v,0),away:as.reduce((n,v)=>n+v,0)}:null;};
  if(['nba','basketball'].includes(g.sport)){const q=period([1]),half=period([1,2]);if(q)Object.assign(periodScores,{first_quarter:q});if(half)Object.assign(periodScores,{first_half:half});}
  if(g.sport==='hockey'){const first=period([1]),regulation=period([1,2,3]);if(first)Object.assign(periodScores,{first_period:first});if(regulation)Object.assign(periodScores,{regulation});}
  // Football full-time markets require regulation scores, so exclude extra-time/shootout finals.
  if(g.sport==='football'&&(Number(c.status?.period??event.status?.period)>2||/extra|penalt|shootout/i.test(c.status?.type?.detail??'')))continue;
  g.status={state:'finished',home,away,...(g.sport==='football'?{regHome:home,regAway:away}:{}),...(Object.keys(periodScores).length?{periodScores}:{})};g.statusObservedAt=now;g.updated=now;g.publicResultSource={provider:'ESPN scoreboard',id:String(event.id),observedAt:now};updated++;
 }return updated;
}
/** Bounded, cached public result recovery. No paid API or app Worker requests.
 * @param {any} store @param {number} now @param {(url:string)=>Promise<any>} fetchJson */
export async function refreshPublicResults(store,now,fetchJson){store.publicResultChecks??={};const groups=new Map();
 for(const g of Object.values(store.games)){const game=/** @type {any} */(g),route=game.sport==='nba'?routes.nba:routes[/** @type {keyof typeof routes} */(game.league)];if(!route||game.kickoff>now-3*3600000||game.kickoff<now-14*86400000||['finished','postponed'].includes(game.status.state)||!store.projections[game.uid])continue;const day=new Date(game.kickoff).toISOString().slice(0,10).replaceAll('-',''),key=route+':'+day;if(now-(store.publicResultChecks[key]??0)<6*3600000)continue;if(!groups.has(key))groups.set(key,{route,day,games:[]});groups.get(key).games.push(game);}
 let updated=0,requests=0;for(const [key,group]of [...groups].sort((a,b)=>a[0].localeCompare(b[0])).slice(0,4)){store.publicResultChecks[key]=now;requests++;try{updated+=applyPublicResults(await fetchJson('https://site.api.espn.com/apis/site/v2/sports/'+group.route+'/scoreboard?dates='+group.day),group.games,now);}catch{/* Retry after the cache window; no outcome is inferred. */}}
 for(const [key,at]of Object.entries(store.publicResultChecks))if(now-Number(at)>15*86400000)delete store.publicResultChecks[key];return {updated,requests};
}
