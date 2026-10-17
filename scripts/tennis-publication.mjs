/** Stamp actual publication preparation, never the earlier discovery/training time. */
export function prepareTennisPublication(snapshot,now=Date.now()){
 if(!Number.isFinite(snapshot.at)||snapshot.at>now||now-snapshot.at>86400000)throw Error('Tennis source snapshot is stale or future dated');
 return {...snapshot,sourceCollectedAt:snapshot.at,at:now,
  // Two bounded 60s R2 transfers follow; a fixture must remain pre-match throughout.
  fixtures:snapshot.fixtures.filter(f=>Number.isFinite(f.kickoff)&&f.kickoff>now+120000).map(f=>({...f,publishedAt:now}))};
}
