/** Presentation grouping only: exact settlement identities and cohort evidence remain on every option.
 * @param {any[]} rows @returns {any[]} */
export function groupEvidenceSports(rows){
 const sports=new Map();const order=['football','basketball','nba','hockey','baseball'];
 const compare=(/** @type {any} */a,/** @type {any} */b)=>b.modelProb-a.modelProb||b.cohort.interval.low-a.cohort.interval.low||a.id.localeCompare(b.id);
 for(const row of rows){let sport=sports.get(row.sport);if(!sport){sport={sport:row.sport,markets:new Map(),count:0};sports.set(row.sport,sport);}const direction=row.kind==='handicap'||row.kind==='winner'||row.kind==='other'||row.kind==='two-consecutive'||row.kind==='corners'?row.side:row.kind==='team-home'||row.kind==='team-away'?row.side:row.side;
 const title=row.kind==='handicap'?`${row.side==='home'?'Home':'Away'} handicap / spread`:row.kind==='match-total'?`Match total · ${row.side==='over'?'Over':'Under'}`:row.kind==='team-home'||row.kind==='team-away'?`${row.kind==='team-home'?'Home':'Away'} team total · ${row.side==='over'?'Over':'Under'}`:row.kind==='corners'?`Corners · ${row.side.replace('-',' · ')}`:row.title;
 const key=JSON.stringify([row.sport,row.scope,row.kind,direction]);let market=sport.markets.get(key);if(!market){market={key,title:`${row.scope.replaceAll('_',' ')} · ${title}`,fixtures:new Map(),count:0,best:row.modelProb,scope:row.scope,kind:row.kind,side:row.side};sport.markets.set(key,market);}let fixture=market.fixtures.get(row.fixtureId);if(!fixture){fixture={...row,options:[]};market.fixtures.set(row.fixtureId,fixture);}fixture.options.push(row);market.best=Math.max(market.best,row.modelProb);market.count++;sport.count++;
 }
 return [...sports.values()].sort((a,b)=>order.indexOf(a.sport)-order.indexOf(b.sport)).map(s=>({...s,markets:[...s.markets.values()].map(m=>({...m,fixtures:[...m.fixtures.values()].map(f=>({...f,options:[...f.options].sort(compare)})).sort((a,b)=>compare(a.options[0],b.options[0])||a.kickoff-b.kickoff)})).sort((a,b)=>marketOrder(a)-marketOrder(b)||b.best-a.best||a.title.localeCompare(b.title))}));
}

/** Explicit market order shared across sports; unsupported families are simply absent. @param {any} m */
export function marketOrder(m){const keys=['handicap:home','handicap:away','team-home:over','team-away:over','other:dc1x','other:dcx2','other:dc12','other:dnbh','team-home:under','team-away:under','match-total:over','match-total:under'];const i=keys.indexOf(m.kind+':'+m.side);return (m.scope==='full'?0:100)+(i<0?50:i);}

/** Yellow scoring families share a dedicated Top markets section. @param {any} row */
export function topMarket(row){return ['football','basketball','nba'].includes(row.sport)&&(['match-total','team-home','team-away','handicap'].includes(row.kind)||['bttsYes','bttsNo'].includes(row.side));}
