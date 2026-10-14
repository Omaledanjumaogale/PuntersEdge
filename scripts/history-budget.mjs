/** Manual history runs reserve thirty daily calls and verify current provider usage. */
export async function historyFetch(host,path,key) {
 if(!['v3.football.api-sports.io','v2.nba.api-sports.io','v1.basketball.api-sports.io','v1.hockey.api-sports.io','v1.baseball.api-sports.io'].includes(host))throw new Error('Unapproved provider');
 const status=await fetch(`https://${host}/status`,{headers:{'x-apisports-key':key},signal:AbortSignal.timeout(15000)});
 const body=await status.json();const used=body.response?.requests?.current,limit=body.response?.requests?.limit_day;
 if(!status.ok||!Number.isFinite(used)||limit!==100||used>=65)throw new Error('Insufficient verified history quota; preserve live reserve');
 return fetch(`https://${host}${path}`,{headers:{'x-apisports-key':key},signal:AbortSignal.timeout(25000)});
}
