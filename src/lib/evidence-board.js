import {cohortKey,evidenceCatalogIsFresh,EVIDENCE_KICKOFF_GRACE_MS} from './evidence-shortlist.js';
import {combinedMarket,combinedMarketKey} from './evidence-groups.js';

/** @param {any} report @param {Map<string,any>} games @param {number} now @param {string} sort */
export function evidenceBoard(report,games,now,sort='model'){
 const fixtures=[];
 for(const f of report?.upcoming??[]){
  const game=games.get(f.fixtureId),at=f.statusObservedAt??report.generatedAt,observed=game?.statusObservedAt??0;
  const newer=game&&observed>=at,state=newer?game.status.state:f.state;
  if(game?.status?.state==='finished'||!['scheduled','live'].includes(state)||!(f.publishedAt<f.kickoff))continue;
  if(f.kickoff<=now&&(!evidenceCatalogIsFresh(newer?observed:at,now)||(state!=='live'&&now-f.kickoff>EVIDENCE_KICKOFF_GRACE_MS)))continue;
  const markets=new Map();
  for(const r of f.rows??[]){
   if(!Number.isFinite(r.modelProb)||r.modelProb<0||r.modelProb>1)continue;
   const key=combinedMarketKey(r),old=markets.get(key);
   if(old&&(old.modelProb>r.modelProb||old.modelProb===r.modelProb&&old.optionKey<=r.key))continue;
   const cohort=report.groups?.[cohortKey(f,r)];
   markets.set(key,{...r,key,optionKey:r.key,title:combinedMarket(r).title,cohort:cohort?.binaryN>0?cohort:null});
  }
  const options=[...markets.values()].sort((a,b)=>b.modelProb-a.modelProb||a.key.localeCompare(b.key));
  if(options.length)fixtures.push({...f,state,options,best:options[0].modelProb});
 }
 return fixtures.sort((a,b)=>(sort==='kickoff'?a.kickoff-b.kickoff||b.best-a.best:b.best-a.best||a.kickoff-b.kickoff)||a.fixtureId.localeCompare(b.fixtureId));
}
