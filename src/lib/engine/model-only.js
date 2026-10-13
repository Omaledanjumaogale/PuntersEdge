/** Show independently supported forecasts even when providers supply no quoted prices. */
export function withModelOnlyMarkets(/** @type {any} */ prediction) {
 if(prediction.markets.some((/** @type {any} */ g)=>g.selections.length))return prediction;
 const p=prediction.probabilities;
 const rows=[['home',`${prediction.homeTeam} Win`,p.homeWin,'Match result'],['away',`${prediction.awayTeam} Win`,p.awayWin,'Match result']];
 if(p.draw!==undefined)rows.push(['draw','Draw',p.draw,'Match result']);
 if(p.over25!==undefined)rows.push(['over25','Over 2.5 Goals',p.over25,'Total goals'],['under25','Under 2.5 Goals',p.under25,'Total goals']);
 if(p.overTotal!==undefined)rows.push(['over',`Over ${prediction.marketLines.total}`,p.overTotal,'Model total'],['under',`Under ${prediction.marketLines.total}`,1-p.overTotal,'Model total']);
 if(p.bttsYes!==undefined)rows.push(['bttsYes','BTTS Yes',p.bttsYes,'Both teams to score'],['bttsNo','BTTS No',p.bttsNo,'Both teams to score']);
 prediction.markets=[{key:'forecast',title:'Model forecast · bookmaker quotes unavailable',emoji:'🧮',blurb:'Independent inputs support these model probabilities. Fair odds are theoretical, not bookmaker offers.',selections:rows.filter(r=>Number(r[2])>0&&Number(r[2])<1).map(([key,label,prob,market])=>({id:`${prediction.fixtureId}:${key}`,fixtureId:prediction.fixtureId,sport:prediction.sport,matchTitle:prediction.matchTitle,league:prediction.league,market,selection:label,modelProb:Number(prob),marketProb:Number(prob),pushProb:0,fairOdds:1/Number(prob),bestOdds:0,bookmaker:'No quoted price',edgePercent:0,kellyStakePercent:0,grade:'PASS',pricing:'derived'}))}];
 return prediction;
}
