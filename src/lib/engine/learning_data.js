/** Canonical actual-result corpus. Different kickoff minutes retain doubleheaders. */
const scopes={football:['full','first_half'],nba:['full','first_half','first_quarter'],basketball:['full','first_half','first_quarter'],hockey:['full','first_period','regulation'],baseball:['full','first_five','first_inning']};
/** Prevent league-name homonyms from contaminating a fitted competition. @param {any} game @param {any[]} models */
export function trainingDomain(game,models){
 const ids={football:['39','public-pl'],nba:['standard'],basketball:['120'],hockey:['57','public-nhl'],baseball:['1','public-mlb']};
 return models.some(m=>m.artifact?.sport===game.sport&&m.artifact.league===game.league&&(ids[/** @type {keyof typeof ids} */(game.sport)]?.includes(String(game.leagueId))||m.artifact.teams?.[String(game.homeId)]&&m.artifact.teams?.[String(game.awayId)]));
}
/** @param {any[]} existing @param {any[]} incoming @param {number} now @param {number} cap */
export function mergeTrainingRows(existing,incoming,now=Date.now(),cap=4000){
 const rows=new Map(),ids=new Map();
 for(const r of [...existing,...incoming]){
  if(!scopes[/** @type {keyof typeof scopes} */(r.sport)]?.includes(r.scope)||typeof r.league!=='string'||r.league.length>120||r.id==null||!['number','string'].includes(typeof r.homeId)||!['number','string'].includes(typeof r.awayId)||String(r.homeId)===String(r.awayId)||!Number.isFinite(r.kickoff)||!Number.isFinite(r.availableAt)||r.availableAt<=r.kickoff||r.availableAt>=now||![r.status?.home,r.status?.away].every(n=>Number.isInteger(n)&&n>=0&&n<500))continue;
  const group=`${r.sport}:${r.league}:${r.scope}`,key=`${group}:${r.homeId}:${r.awayId}:${Math.floor(r.kickoff/60000)}`,source=`${group}:${r.id}`,previousKey=ids.get(source),old=rows.get(key)??rows.get(previousKey);
  if(old&&old.availableAt>r.availableAt&&(old.status.home!==r.status.home||old.status.away!==r.status.away))continue;
  const same=old&&old.status.home===r.status.home&&old.status.away===r.status.away&&old.kickoff===r.kickoff;
  const sources=[...new Set([...(old?.sourceIds??[]),String(old?.id??r.id),String(r.id)])].slice(-8);
  if(previousKey&&previousKey!==key)rows.delete(previousKey);
  const row={...r,sourceIds:sources,...(same?{availableAt:Math.min(old.availableAt,r.availableAt),availabilityBasis:old.availableAt<=r.availableAt?old.availabilityBasis:r.availabilityBasis}:{})};
  rows.set(key,row);for(const id of sources)ids.set(`${group}:${id}`,key);
 }
 const groups=new Map();for(const r of rows.values()){const k=`${r.sport}:${r.league}:${r.scope}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
 return [...groups.values()].flatMap(g=>g.sort((/** @type {any} */a,/** @type {any} */b)=>a.kickoff-b.kickoff).slice(-cap));
}
