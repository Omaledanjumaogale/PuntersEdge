export const DEFAULT_NOTIFICATION_PREFERENCES={newMatches:true,liveStarts:true,scoreUpdates:false,finishedGames:true,activities:true};
export const NOTIFICATION_LABELS={newMatches:'New matches',liveStarts:'Games going live',scoreUpdates:'Live score changes',finishedGames:'Final scores and corrections',activities:'Saved tickets and membership activity'};
/** Detect changes once per committed provider refresh; never broadcast a historical first-load backfill. */
export function notificationCounts(/** @type {Record<string,any>} */ before,/** @type {Record<string,any>} */ after,/** @type {number} */ now){
 const counts={newMatches:0,liveStarts:0,scoreUpdates:0,finishedGames:0};if(!Object.keys(before).length)return counts;
 for(const [id,current] of Object.entries(after)){
  const previous=before[id];const state=current.status?.state;
  if(!previous){if(state==='scheduled'&&current.kickoff>now&&current.kickoff<now+86400000)counts.newMatches++;continue;}
  if(current.kickoff<now-2*86400000)continue;
  const old=previous.status?.state;
  if(state==='live'&&old!=='live')counts.liveStarts++;
  const changed=current.status?.home!==previous.status?.home||current.status?.away!==previous.status?.away;
  if(state==='live'&&old==='live'&&changed)counts.scoreUpdates++;
  if(state==='finished'&&(old!=='finished'||changed))counts.finishedGames++;
 }
 return counts;
}
