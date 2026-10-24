/** A qualifying shortlist snapshot is recorded before kickoff, never reconstructed from a final result. */
import {createHash} from 'node:crypto';import {evidenceShortlist} from '../src/lib/evidence-shortlist.js';import {settleSnapshot} from '../src/lib/feeds/performance.js';import {gzipJson,parseGzip} from '../src/lib/feeds/ingest-runtime.js';
const day=t=>new Date(t+3600000).toISOString().slice(0,10),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export async function updateEvidenceHistory({catalog,report,store,blobs,now}){
 catalog.historyStartedAt??=now;catalog.historyIndex??={};
 // Retain every published shortlist option at the platform-wide 55% floor.
 // Admin-selected recurrence filters only control the view; they must not
 // silently decide which finished outcomes enter the production history.
 const liveGames=new Map(Object.entries(store.games??{}));
 const historyReport={...report,upcoming:[...new Map([...(report.upcoming??[]).filter(f=>f.kickoff>now),...Object.values(catalog.fixtures??{}).filter(f=>f.state==='finished')].map(f=>[f.fixtureId,f])).values()]};
 const archiveRows=evidenceShortlist(historyReport,{includePeriodForecasts:true,includePastForHistory:true,includeFinishedForHistory:true,minModel:.55,minSamples:1,minStrike:0,minFloor:0},now,liveGames).rows;
 const qualified=new Set(evidenceShortlist(report,{includePeriodForecasts:true},now,liveGames).rows.map(row=>row.id));
 const rows=archiveRows.map(row=>({...row,evidenceTier:qualified.has(row.id)?row.evidenceTier:'forecast-only'})),byDay=new Map();
 for(const row of rows){const d=day(row.kickoff);if(!byDay.has(d))byDay.set(d,[]);byDay.get(d).push(row);}
 // Recheck the retained correction window and every unresolved day. Older completed days stay in R2.
 const active=new Set([...byDay.keys(),...Object.keys(catalog.historyIndex).filter(d=>catalog.historyIndex[d].pending>0||Date.parse(d+'T00:00:00Z')>now-8*86400000)]);
 for(const d of active){const key=`archives/evidence/history/${d}.gz`,bytes=catalog.historyIndex[d]?await blobs.get(key):null;if(catalog.historyIndex[d]&&!bytes)throw Error('Recorded evidence history is unavailable; refusing to replace it');
 const shard=bytes?parseGzip(bytes):{schema:1,date:d,startedAt:catalog.historyStartedAt,rows:{}};
 for(const row of byDay.get(d)??[]){const id=hash([row.fixtureId,row.signature]);const old=shard.rows[id];if(old?.kickoff<=now)continue;
 const openBasketball=['basketball','nba'].includes(row.sport)&&['full','first_half','first_quarter'].includes(row.scope)&&['match-total','team-home','team-away','handicap'].includes(row.kind);
 shard.rows[id]={id,fixtureId:row.fixtureId,sport:row.sport,family:row.sport==='nba'?'basketball':row.sport,matchTitle:row.matchTitle,league:row.league,country:row.country,tournament:row.tournament,kickoff:row.kickoff,publishedAt:row.publishedAt,firstQualifiedAt:old?.firstQualifiedAt??now,lastQualifiedAt:now,ruleVersion:row.evidenceTier==='historical'?'default-v1':openBasketball?'basketball-open-55-v2':'published-55-archive-v1',evidenceTier:row.evidenceTier,key:row.key,selection:row.selection,group:row.group,modelProb:row.modelProb,pricing:row.pricing,odds:row.odds,modelVersion:row.artifact,source:row.source,scope:row.scope,title:row.title,probabilityBand:row.probabilityBand,cohort:row.cohort,state:'scheduled',result:'pending',score:null};
 }
 for(const row of Object.values(shard.rows)){
  const g=store.games?.[row.fixtureId],p=store.projections?.[row.fixtureId],finished=catalog.fixtures?.[row.fixtureId];
  if(g?.status.state==='finished'||p?.state==='finished'||finished?.state==='finished'){
   const score=g?.status.state==='finished'?g.status:p?.score??finished?.score;const snapshot={family:row.family,selections:[{key:row.key,odds:row.odds}],goalSequence:p?.goalSequence,corners:p?.corners};
   settleSnapshot(snapshot,g?.status.state==='finished'?g:{status:{state:'finished',...score,periodScores:p?.periodScores??{}},goalSequence:p?.goalSequence,corners:p?.corners},now);
   const result=snapshot.selections[0].result??'ungraded',finalScore=snapshot.score??row.score;if(row.state!=='finished'||row.result!==result||JSON.stringify(row.score)!==JSON.stringify(finalScore))row.resultUpdatedAt=now;row.state='finished';row.score=finalScore;row.result=result;
  }else if(g){row.state=g.status.state;if(g.status.state==='postponed'){row.result='pending';}else if(row.kickoff<=now)row.result='pending';}
  // A stale scheduled record has no verified outcome. Keep its published evidence
  // in history as ungraded instead of claiming it is live or leaving it on the board.
  if(row.state!=='finished'&&row.kickoff<now-4*60*60*1000&&g?.status.state!=='live'&&!['postponed','cancelled','abandoned'].includes(g?.status.state)){
   row.state='unresolved';row.result='ungraded';
  }
  // An unresolved provider result stays explicitly ungraded after the seven-day hot correction window.
  if(row.state!=='finished'&&now-row.kickoff>8*86400000){row.state='unresolved';row.result='ungraded';}
 }
 const values=Object.values(shard.rows),version=hash(shard);if(version!==catalog.historyIndex[d]?.version)await blobs.put(key,gzipJson(shard));
 catalog.historyIndex[d]={version,count:values.length,completed:values.filter(r=>r.state==='finished').length,pending:values.filter(r=>!['finished','unresolved'].includes(r.state)).length,updatedAt:now};
 }
 return {startedAt:catalog.historyStartedAt,days:catalog.historyIndex,ruleVersion:'all-published-55-v1'};
}
