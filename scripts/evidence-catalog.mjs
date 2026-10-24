import {scoringAssessment} from '../src/lib/scoring-assessment.js';
import {updateEvidenceHistory} from './evidence-history.mjs';
/** Runner-only ledger catalog. R2 holds the bulk data; Convex stores a small protected pointer. */
import {settleSnapshot} from '../src/lib/feeds/performance.js';
import {createHash} from 'node:crypto';import {compactEvidence,buildEvidenceReport,EVIDENCE_SCHEMA} from '../src/lib/evidence-shortlist.js';import {gzipJson,parseGzip} from '../src/lib/feeds/ingest-runtime.js';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export async function refreshEvidenceCatalog({rpc,blobs,now=Date.now()}){
 const state=await rpc.query('evidence:state',{});if(!state.ingest)return {skipped:'Retained production state unavailable'};
 const previous=state.catalog,old=previous?.stateKey?await blobs.get(previous.stateKey):null;
 const catalog=old?parseGzip(old):{schema:EVIDENCE_SCHEMA,fixtures:{},fingerprints:{},lastAuditAt:0,missingArchives:0};
 const storeBytes=await blobs.get(state.ingest);if(!storeBytes)throw Error('Retained production state unavailable');const store=parseGzip(storeBytes);
 let readArchives=0,invalidPublications=0;
 if(catalog.schema!==EVIDENCE_SCHEMA)throw Error('Evidence schema upgrade requires an explicit migration');
 if(!catalog.lastAuditAt||now-catalog.lastAuditAt>=86400000){let cursor,missing=0;
  do{const page=await rpc.query('evidence:sources',cursor?{cursor}:{});
   for(let i=0;i<page.page.length;i+=4){const updates=await Promise.all(page.page.slice(i,i+4).map(async source=>{
    if(catalog.fingerprints[source.fixtureId]===source.fingerprint)return null;
    const hot=store.projections?.[source.fixtureId];let raw=hot&&hot.state==='finished'&&hot.publishedAt===source.publishedAt&&JSON.stringify(hot.score)===JSON.stringify(source.score)?structuredClone(hot):null;
    if(!raw){let bytes=source.blobKey?await blobs.get(source.blobKey):null;if(!bytes&&source.legacyUrl){const r=await fetch(source.legacyUrl,{signal:AbortSignal.timeout(60000)});if(r.ok)bytes=new Uint8Array(await r.arrayBuffer());}if(!bytes){missing++;return null;}raw=parseGzip(bytes);readArchives++;}
    if(raw.publishedAt!==source.publishedAt){invalidPublications++;return null;}if(source.score)settleSnapshot(raw,{status:{state:'finished',...source.score,periodScores:source.periodScores??raw.periodScores??{}}},source.finishedAt??now);raw.observedAt=source.observedAt??raw.observedAt;
    const compact=compactEvidence(raw);if(!compact){invalidPublications++;return null;}return {id:source.fixtureId,fingerprint:source.fingerprint,compact};
   }));for(const u of updates)if(u){catalog.fixtures[u.id]=u.compact;catalog.fingerprints[u.id]=u.fingerprint;}}
   cursor=page.isDone?null:page.continueCursor;
  }while(cursor);catalog.lastAuditAt=now;catalog.missingArchives=missing;catalog.invalidPublications=invalidPublications;
 }
 const upcoming=[];
 for(const p of Object.values(store.projections??{})){const c=compactEvidence(p);if(!c)continue;const game=store.games?.[c.fixtureId];
  if(c.state==='finished'&&(!catalog.fixtures[c.fixtureId]||c.observedAt>=catalog.fixtures[c.fixtureId].observedAt))catalog.fixtures[c.fixtureId]=c;
  // Keep the published pre-match snapshot active through live play. The client
  // removes it only after the provider supplies a finished result.
  const currentState=game?.status?.state??c.state;
  if(['scheduled','live'].includes(c.state)&&['scheduled','live'].includes(currentState))upcoming.push({...c,state:currentState});
 }
 const report=buildEvidenceReport(Object.values(catalog.fixtures),upcoming,now);
 report.history=await updateEvidenceHistory({catalog,report,store,blobs,now});
 report.research=store.footballResearchReport??null;
 report.scoringAssessment=scoringAssessment(Object.values(catalog.fixtures),now);
 report.coverage={missingArchives:catalog.missingArchives,invalidPublications:catalog.invalidPublications};
 const version=hash({...report,generatedAt:0}),reportKey=`archives/evidence/${version}-report.gz`,stateKey=`archives/evidence/${hash(catalog)}-state.gz`;
 if(reportKey!==previous?.reportKey)await blobs.put(reportKey,gzipJson(report));if(stateKey!==previous?.stateKey)await blobs.put(stateKey,gzipJson(catalog));
 const retired=[];for(const entry of previous?.retired??[]){if(entry.key===stateKey||entry.key===reportKey)continue;if(entry.after<=now)await blobs.delete(entry.key);else retired.push(entry);}
 for(const key of [previous?.reportKey,previous?.stateKey])if(key&&![reportKey,stateKey].includes(key)&&!retired.some(x=>x.key===key))retired.push({key,after:now+86400000});
 const coverage={history:report.history,historicalFixtures:report.historicalFixtures,settledOptions:report.settledOptions,cohorts:report.cohortCount,upcomingFixtures:report.upcoming.length,missingArchives:catalog.missingArchives,invalidPublications:catalog.invalidPublications};
 const published=await rpc.mutation('evidence:publish',{expectedVersion:previous?.version??null,version,reportKey,stateKey,updatedAt:now,coverage,retired});
 return {published,readArchives,...coverage,reportBytes:gzipJson(report).length};
}
