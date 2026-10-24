/** A qualifying shortlist snapshot is recorded before kickoff, never reconstructed from a final result. */
import {createHash} from 'node:crypto';import {evidenceShortlist} from '../src/lib/evidence-shortlist.js';import {settleSnapshot} from '../src/lib/feeds/performance.js';import {gzipJson,parseGzip} from '../src/lib/feeds/ingest-runtime.js';
const day=t=>new Date(t+3600000).toISOString().slice(0,10),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export async function updateEvidenceHistory({catalog,report,store,blobs,now}){
 catalog.historyStartedAt??=now;catalog.historyIndex??={};
 const rows=evidenceShortlist(report,{includePeriodForecasts:true},now,new Map(Object.entries(store.games??{}))).rows,byDay=new Map();
 for(const row of rows){const d=day(row.kickoff);if(!byDay.has(d))byDay.set(d,[]);byDay.get(d).push(row);}
 // Recheck the retained correction window and every unresolved day. Older completed days stay in R2.
 const active=new Set([...byDay.keys(),...Object.keys(catalog.historyIndex).filter(d=>catalog.historyIndex[d].pending>0||Date.parse(d+'T00:00:00Z')>now-8*86400000)]);
 for(const d of active){const key=`archives/evidence/history/${d}.gz`,bytes=catalog.historyIndex[d]?await blobs.get(key):null;if(catalog.historyIndex[d]&&!bytes)throw Error('Recorded evidence history is unavailable; refusing to replace it');
 const shard=bytes?parseGzip(bytes):{schema:1,date:d,startedAt:catalog.historyStartedAt,rows:{}};
 for(const row of byDay.get(d)??[]){const id=hash([row.fixtureId,row.signature]);const old=shard.rows[id];if(old?.kickoff<=now)continue;
 shard.rows[id]={id,fixtureId:row.fixtureId,sport:row.sport,family:row.sport==='nba'?'basketball':row.sport,matchTitle:row.matchTitle,league:row.league,country:row.country,tournament:row.tournament,kickoff:row.kickoff,publishedAt:row.publishedAt,firstQualifiedAt:old?.firstQualifiedAt??now,lastQualifiedAt:now,ruleVersion:row.evidenceTier==='forecast-only'?'period-open-v1':'default-v1',evidenceTier:row.evidenceTier,key:row.key,selection:row.selection,group:row.group,modelProb:row.modelProb,pricing:row.pricing,odds:row.odds,modelVersion:row.artifact,cohort:{won:row.cohort.won,lost:row.cohort.lost,binaryN:row.cohort.binaryN,strikeRate:row.cohort.strikeRate,interval:row.cohort.interval},state:'scheduled',result:'pending',score:null};
 }
 for(const row of Object.values(shard.rows)){
  const g=store.games?.[row.fixtureId],p=store.projections?.[row.fixtureId],finished=catalog.fixtures?.[row.fixtureId];
  if(g?.status.state==='finished'||p?.state==='finished'||finished?.state==='finished'){
   const score=g?.status.state==='finished'?g.status:p?.score??finished?.score;const snapshot={family:row.family,selections:[{key:row.key,odds:row.odds}],goalSequence:p?.goalSequence,corners:p?.corners};
   settleSnapshot(snapshot,g?.status.state==='finished'?g:{status:{state:'finished',...score,periodScores:p?.periodScores??{}},goalSequence:p?.goalSequence,corners:p?.corners},now);
   const result=snapshot.selections[0].result??'ungraded',finalScore=snapshot.score??row.score;if(row.state!=='finished'||row.result!==result||JSON.stringify(row.score)!==JSON.stringify(finalScore))row.resultUpdatedAt=now;row.state='finished';row.score=finalScore;row.result=result;
  }else if(g){row.state=g.status.state;if(g.status.state==='postponed'){row.result='pending';}else if(row.kickoff<=now)row.result='pending';}
  // An unresolved provider result stays explicitly ungraded after the seven-day hot correction window.
  if(row.state!=='finished'&&now-row.kickoff>8*86400000){row.state='unresolved';row.result='ungraded';}
 }
 const values=Object.values(shard.rows),version=hash(shard);if(version!==catalog.historyIndex[d]?.version)await blobs.put(key,gzipJson(shard));
 catalog.historyIndex[d]={version,count:values.length,completed:values.filter(r=>r.state==='finished').length,pending:values.filter(r=>!['finished','unresolved'].includes(r.state)).length,updatedAt:now};
 }
 return {startedAt:catalog.historyStartedAt,days:catalog.historyIndex,ruleVersion:'default-and-period-open-v1'};
}
