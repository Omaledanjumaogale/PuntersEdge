import trainedTeams from './trained-teams.json' with {type:'json'};
import {teamKey,bestMatch} from './matching.js';
/** @param {string} state @param {string} detail */
function gameState(state,detail='') {
 if(/postpon|suspend|cancel|PPD/i.test(detail))return 'postponed';
 return ['OFF','FINAL','Final'].includes(state)?'finished':['LIVE','CRIT','Live'].includes(state)?'live':'scheduled';
}
/** Public league sources supplement schedules and team statistics; they do not approve prices. */
const identity=(/** @type {'hockey'|'baseball'|'football'} */sport,/** @type {string} */name,/** @type {number} */id)=>{
 if(sport==='football')name=(/** @type {Record<string,string>} */({'Ipswich Town':'Ipswich',"Nott'm Forest":'Nottingham Forest'}))[name]??name;
 const names=Object.entries(trainedTeams[sport]).filter(([n])=>teamKey(n)===teamKey(name)||(sport==='baseball'&&teamKey(name).split(' ').every(token=>teamKey(n).split(' ').includes(token))));
 const ids=[...new Set(names.map(([,id])=>id))];return ids.length===1?ids[0]:`public-${sport}-${id}`;
};
/** @param {any} body @returns {any[]} */
export function nhlSchedule(body){return (body.gameWeek??[]).flatMap((/** @type {any} */d)=>d.games??[]).map((/** @type {any} */g)=>{
 const books=Object.fromEntries((body.oddsPartners??[]).map((/** @type {any} */b)=>[b.partnerId,b.name]));/** @type {Record<string,Record<string,number>>} */ const odds=/** @type {Record<string,Record<string,number>>} */({});const decimal=(/** @type {any} */value)=>{const text=String(value);return /^[+-]\d+$/.test(text)?Number(text)>0?1+Number(text)/100:1+100/Math.abs(Number(text)):/^\d+\.\d+$/.test(text)?Number(text):NaN;};for(const h of g.homeTeam.odds??[]){const a=(g.awayTeam.odds??[]).find((/** @type {any} */a)=>a.providerId===h.providerId),homePrice=decimal(h.value),awayPrice=decimal(a?.value);if(homePrice>1&&awayPrice>1&&books[h.providerId])odds[`NHL partner · ${books[h.providerId]}`]={homeMoneyline:homePrice,awayMoneyline:awayPrice};}
 const home=`${g.homeTeam.placeName.default} ${g.homeTeam.commonName.default}`,away=`${g.awayTeam.placeName.default} ${g.awayTeam.commonName.default}`;
 return {id:`nhl-${g.id}`,sport:'hockey',league:'NHL',leagueId:'public-nhl',season:g.season,home,away,homeId:identity('hockey',home,g.homeTeam.id),awayId:identity('hockey',away,g.awayTeam.id),kickoff:Date.parse(g.startTimeUTC),status:{state:gameState(g.gameState,g.gameScheduleState),...(Number.isFinite(g.homeTeam.score)?{home:g.homeTeam.score,away:g.awayTeam.score}:{})},odds};
 });}
/** @param {any} body @returns {any[]} */
export function mlbSchedule(body){return(body.dates??[]).flatMap((/** @type {any} */d)=>d.games??[]).filter((/** @type {any} */g)=>!g.status.startTimeTBD).map((/** @type {any} */g)=>{
 const home=g.teams.home.team.name,away=g.teams.away.team.name;
 return {id:`mlb-${g.gamePk}`,sport:'baseball',league:'MLB',leagueId:'public-mlb',season:g.season,home,away,homeId:identity('baseball',home,g.teams.home.team.id),awayId:identity('baseball',away,g.teams.away.team.id),kickoff:Date.parse(g.gameDate),status:{state:gameState(g.status.abstractGameState,g.status.detailedState),...(g.status.abstractGameState==='Final'?{home:g.teams.home.score,away:g.teams.away.score}:{})},odds:{}};
 });}
/** @param {any} store @param {any[]} games @param {number} now */
export function mergePublicGames(store,games,now){for(const n of games){if(!Number.isFinite(n.kickoff))continue;let g=Object.values(store.games).find((/** @type {any} */g)=>g.ext?.public===n.id);if(!g){const m=bestMatch(n,Object.values(store.games).filter((/** @type {any} */g)=>g.sport===n.sport));g=m?.item;}if(g){const row=/** @type {any} */(g);row.ext.public=n.id;row.publicHome=n.home;row.publicAway=n.away;row.homeId??=n.homeId;row.awayId??=n.awayId;row.leagueId??=n.leagueId;row.season??=n.season;row.status={...row.status,...n.status};row.updated=now;for(const [book,prices]of Object.entries(n.odds??{}))row.odds[book]={...prices,at:now};}else{const uid=`${n.sport}-${n.id}`;store.games[uid]={...n,uid,ext:{public:n.id},updated:now,odds:Object.fromEntries(Object.entries(n.odds??{}).map(([book,prices])=>[book,{...prices,at:now}]))};}}}
/** @param {any} store @param {number} now @param {(url:string)=>Promise<any>} fetchJson */
export async function refreshPublicSports(store,now,fetchJson){
 if(store.publicSportsVersion===2&&now-(store.publicSportsAt??0)<30*60_000)return false;
 const day=new Date(now).toISOString().slice(0,10),end=new Date(now+7*86400000).toISOString().slice(0,10),year=new Date(now).getUTCFullYear();
 const results=await Promise.allSettled([
  fetchJson(`https://api-web.nhle.com/v1/schedule/${day}`),fetchJson('https://api-web.nhle.com/v1/standings/now'),
  fetchJson(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${day}&endDate=${end}`),fetchJson(`https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${year}`),fetchJson('https://fantasy.premierleague.com/api/bootstrap-static/'),fetchJson('https://fantasy.premierleague.com/api/fixtures/')
 ]);
 const get=(/** @type {number} */i)=>results[i].status==='fulfilled'?/** @type {PromiseFulfilledResult<any>} */(results[i]).value:null;
 if(get(0))mergePublicGames(store,nhlSchedule(get(0)),now);if(get(2))mergePublicGames(store,mlbSchedule(get(2)),now);
 const knownId=(/** @type {'hockey'|'baseball'|'football'} */sport,/** @type {string} */name,/** @type {number} */id)=>{const game=Object.values(store.games).find((/** @type {any} */g)=>g.sport===sport&&(teamKey(g.home)===teamKey(name)||teamKey(g.away)===teamKey(name)||teamKey(g.publicHome??'')===teamKey(name)||teamKey(g.publicAway??'')===teamKey(name)));const found=/** @type {any} */(game);const mapped=found?((teamKey(found.home)===teamKey(name)||teamKey(found.publicHome??'')===teamKey(name))?found.homeId:found.awayId):undefined;return mapped??identity(sport,name,id);};
 if(Array.isArray(get(1)?.standings)){const rows=get(1).standings.map((/** @type {any} */r)=>({teamId:knownId('hockey',r.teamName.default,0),team:r.teamName.default,played:r.gamesPlayed,for:r.goalFor,against:r.goalAgainst,wins:r.wins,losses:r.losses}));for(const g of Object.values(store.games).filter((/** @type {any} */g)=>g.league==='NHL')){const x=/** @type {any} */(g);store.tables[`hockey:${x.leagueId}:${x.season}`]={rows,at:now};}}
 if(Array.isArray(get(3)?.records)){const rows=get(3).records.flatMap((/** @type {any} */r)=>r.teamRecords).filter((/** @type {any} */r)=>Number.isFinite(r.runsScored)&&Number.isFinite(r.runsAllowed)).map((/** @type {any} */r)=>({teamId:identity('baseball',r.team.name,r.team.id),team:r.team.name,played:r.gamesPlayed,for:r.runsScored,against:r.runsAllowed,wins:r.wins,losses:r.losses}));for(const g of Object.values(store.games).filter((/** @type {any} */g)=>g.league==='MLB')){const x=/** @type {any} */(g);if(rows.length>=2)store.tables[`baseball:${x.leagueId}:${x.season}`]={rows,at:now};}}
 if(Array.isArray(get(4)?.teams)&&Array.isArray(get(5))){
  const teams=Object.fromEntries(get(4).teams.map((/** @type {any} */t)=>[t.id,t]));
  const games=get(5).filter((/** @type {any} */m)=>teams[m.team_h]&&teams[m.team_a]&&Number.isFinite(Date.parse(m.kickoff_time))&&Math.abs(Date.parse(m.kickoff_time)-now)<7*86400000).map((/** @type {any} */m)=>({id:`fpl-${year}-${m.id}`,sport:'football',league:'Premier League',leagueId:'public-pl',season:year,home:teams[m.team_h].name,away:teams[m.team_a].name,homeId:identity('football',teams[m.team_h].name,m.team_h),awayId:identity('football',teams[m.team_a].name,m.team_a),kickoff:Date.parse(m.kickoff_time),status:{state:m.finished?'finished':m.started?'live':'scheduled',...(m.finished?{home:m.team_h_score,away:m.team_a_score}:{})},odds:{}}));
  mergePublicGames(store,games,now);
  const rows=get(4).teams.map((/** @type {any} */t)=>({teamId:knownId('football',t.name,t.id),team:t.name,played:0,for:0,against:0}));
  for(const m of get(5))if(m.finished&&Date.parse(m.kickoff_time)<now&&Number.isFinite(m.team_h_score)&&Number.isFinite(m.team_a_score)&&teams[m.team_h]&&teams[m.team_a])for(const side of ['h','a']){const id=m['team_'+side],r=rows.find((/** @type {any} */r)=>r.teamId===knownId('football',teams[id].name,id));if(r){r.played++;r.for+=m['team_'+side+'_score'];r.against+=m['team_'+(side==='h'?'a':'h')+'_score'];}}
  for(const g of Object.values(store.games).filter((/** @type {any} */g)=>g.sport==='football'&&g.ext?.public?.startsWith('fpl-'))){const x=/** @type {any} */(g);store.tables[`football:${x.leagueId}:${x.season}`]={rows,at:now};}
 }

 store.publicSportsVersion=2;store.publicSportsAt=now;store.publicSportsStatus=results.map((r,i)=>({source:['NHL schedule','NHL standings','MLB schedule','MLB standings','Premier League teams','Premier League fixtures'][i],ok:r.status==='fulfilled',at:now}));return results.some((/** @type {any} */r)=>r.status==='fulfilled');
}
