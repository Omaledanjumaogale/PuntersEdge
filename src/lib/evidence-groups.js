/** Presentation grouping only: exact settlement identities and cohort evidence remain on every option.
 * @param {any[]} rows @returns {any[]} */
export function groupEvidenceSports(rows){
 const sports=new Map();const order=['football','basketball','nba','hockey','baseball'];
 const compare=(/** @type {any} */a,/** @type {any} */b)=>b.modelProb-a.modelProb||b.cohort.interval.low-a.cohort.interval.low||a.id.localeCompare(b.id);
 for(const row of rows){let sport=sports.get(row.sport);if(!sport){sport={sport:row.sport,markets:new Map(),count:0};sports.set(row.sport,sport);}const family=combinedMarket(row);
 const title=family.title,key=JSON.stringify([row.sport,row.scope,family.key]);let market=sport.markets.get(key);if(!market){market={key,title:`${row.scope.replaceAll('_',' ')} · ${title}`,fixtures:new Map(),count:0,best:row.modelProb,scope:row.scope,kind:row.kind,side:row.side,family:family.key};sport.markets.set(key,market);}let fixture=market.fixtures.get(row.fixtureId);if(!fixture){fixture={...row,options:[]};market.fixtures.set(row.fixtureId,fixture);}fixture.options.push(row);market.best=Math.max(market.best,row.modelProb);market.count++;sport.count++;
 }
 return [...sports.values()].sort((a,b)=>order.indexOf(a.sport)-order.indexOf(b.sport)).map(s=>({...s,markets:[...s.markets.values()].map(m=>({...m,fixtures:[...m.fixtures.values()].map(f=>({...f,options:[...f.options].sort(compare)})).sort((a,b)=>compare(a.options[0],b.options[0])||a.kickoff-b.kickoff)})).sort((a,b)=>marketOrder(a)-marketOrder(b)||b.best-a.best||a.title.localeCompare(b.title))}));
}

/** Explicit market order shared across sports; unsupported families are simply absent. @param {any} m */
export function marketOrder(m){
 const order=['handicap','team-total:over','double-chance','draw-no-bet','team-total:under','match-total','btts','winner'];
 // Keep each sport's shorter period forecasts together before full-game markets.
 // Basketball has a useful chronology: quarter, half, then full match.
 const periods=/** @type {Record<string,number>} */({first_quarter:0,first_half:1,first_period:0,first_inning:0,first_five:1,regulation:2,full:100});
 const scopeRank=periods[m.scope]??50;
 const i=order.indexOf(m.family??combinedMarket(m).key);
 return scopeRank*100+(i<0?50:i);
}

/** Yellow scoring families share a dedicated Top markets section. @param {any} row */
export function topMarket(row){return ['football','basketball','nba'].includes(row.sport)&&(['match-total','team-home','team-away','handicap'].includes(row.kind)||['bttsYes','bttsNo'].includes(row.side));}

/** Presentation only; exact option keys, lines and evidence are never merged. @param {any} row */
export function combinedMarket(row){
 if(row.kind==='handicap')return {key:'handicap',title:'Handicap / spread'};
 if(['team-home','team-away'].includes(row.kind))return {key:'team-total:'+row.side,title:'Team totals · '+(row.side==='over'?'Over':'Under')};
 if(row.kind==='match-total')return {key:'match-total',title:'Match total · Over / Under'};
 if(['dc1x','dcx2','dc12'].includes(row.side))return {key:'double-chance',title:'Double chance · 1X / X2 / 12'};
 if(['dnbh','dnba'].includes(row.side))return {key:'draw-no-bet',title:'Draw no bet'};
 if(['bttsYes','bttsNo'].includes(row.side))return {key:'btts',title:'Both teams to score · Yes / No'};
 if(row.kind==='winner')return {key:'winner',title:'Match winner / result'};
 if(row.kind==='two-consecutive')return {key:'two-consecutive',title:'Team to score two consecutive goals'};
 if(row.kind==='corners')return {key:'corners',title:'Corners · Over / Under'};
 if(['csh','csa'].includes(row.side))return {key:'clean-sheet',title:'Clean sheet'};
 return {key:row.kind+':'+row.side,title:row.title};
}
/** @param {any} row */
export function combinedMarketKey(row){return JSON.stringify([row.scope,combinedMarket(row).key]);}
