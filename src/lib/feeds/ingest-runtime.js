import {refreshFootballResearch} from '../engine/football_research.js';
/** Heavy ingest runs on the public repository's scheduled runner; Convex holds metadata only. */
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {runTick} from './runner.js';
import {reviveStore} from './store.js';
import {SPORTS} from './catalog.js';
import {MODEL_VERSION,contributionsFor} from './performance.js';
import {notificationCounts} from '../notification-events.js';
import {buildBoardPreview} from './preview.js';
import {buildFeed,updateRecord} from './build.js';
import {usageSummary} from './budget.js';
import {refreshPublicSports} from './public_sports.js';
const hash=(/** @type {any} */value)=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
export const gzipJson=(/** @type {any} */value)=>gzipSync(Buffer.from(JSON.stringify(value)),{level:9});
export const parseGzip=(/** @type {Uint8Array} */bytes)=>JSON.parse(gunzipSync(bytes,{maxOutputLength:256*1024*1024}).toString('utf8'));
const allowed=new Set(['v3.football.api-sports.io','v1.basketball.api-sports.io','v2.nba.api-sports.io','v1.hockey.api-sports.io','v1.baseball.api-sports.io','api.the-odds-api.com','api.oddspapi.io']);
/** @param {{apiSports:string,oddsApi:string,oddspapi:string}} keys */
export function providerFetcher(keys){return async(/** @type {string} */provider,/** @type {string} */url)=>{
 const u=new URL(url);if(!allowed.has(u.host))throw new Error('Provider host not allowed');
 const headers=/** @type {Record<string,string>} */({accept:'application/json','User-Agent':'PuntersEdge/1.0'});
 if(provider==='api-sports')headers['x-apisports-key']=keys.apiSports;else u.searchParams.set('apiKey',provider==='the-odds-api'?keys.oddsApi:keys.oddspapi);
 const r=await fetch(u,{headers,signal:AbortSignal.timeout(25000)});let body;try{body=await r.json();}catch{body={message:'Invalid provider response'};}return {status:r.status,body,headers:r.headers};
};}
/** @param {any} snapshot */
export function compactSnapshot(snapshot){
 // Full immutable evidence is archived before these duplicated explanation strings are removed.
 const p=structuredClone(snapshot);delete p.priorPublication;delete p.publicationHistory;
 for(const s of p.selections){delete s.opportunity;delete s.eligibilityReasons;}return p;
}
const recentRows=(/** @type {any} */p)=>p.selections.filter((/** @type {any} */s)=>s.result&&s.result!=='ungraded').sort((/** @type {any} */a,/** @type {any} */b)=>Number(b.verdict)-Number(a.verdict)).slice(0,20).map((/** @type {any} */s)=>Object.fromEntries(['key','market','selection','bookmaker','odds','modelProb','marketProb','pushProb','edge','grade','pricing','verdict','result','profit','scope'].filter(k=>s[k]!==undefined).map(k=>[k,s[k]])));
/** rpc exposes only deployment-admin functions; blobs never enter the database.
 * @param {{rpc:any,blobs:any,keys:{apiSports:string,oddsApi:string,oddspapi:string},now?:number,fetcher?:import("./runner.js").Fetcher,publicFetcher?:(url:string)=>Promise<any>,sleep?:(ms:number)=>Promise<void>,progress?:(phase:string,count?:number)=>void}} options
 */
export async function executeIngest({rpc,blobs,keys,now=Date.now(),fetcher=providerFetcher(keys),publicFetcher=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('Public source unavailable');return r.json();},sleep=undefined,progress=()=>{}}){
 progress('claim_tick');const state=await rpc.mutation('feed:claim',{now});if(!state)return {skipped:'Another tick is running'};
 let reserved;
 const read=async(/** @type {string|null|undefined} */key,/** @type {string|null} */legacyUrl=null)=>{if(key){const bytes=await blobs.get(key);if(!bytes)throw new Error('Retained data file missing');return parseGzip(bytes);}if(legacyUrl){const r=await fetch(legacyUrl);if(!r.ok)throw new Error('Legacy retained data unavailable');return parseGzip(new Uint8Array(await r.arrayBuffer()));}return null;};
 const put=async(/** @type {string} */prefix,/** @type {any} */value)=>{const key=`${prefix}/${hash(value)}.gz`;await blobs.put(key,gzipJson(value));return key;};
 const flushArchive=async(/** @type {string|undefined|null} */key)=>{if(!key)return;const outbox=await read(key);for(const batch of outbox.batches??outbox)await rpc.mutation('performance:archiveBatch',batch);if(outbox.states?.length)await rpc.mutation('betslip:resolveSavedFixtures',{states:outbox.states});for(const event of outbox.events??[])await rpc.action('notifications:deliver',event);await rpc.mutation('feed:ackArchive',{key});await blobs.delete(key);};
 try{
  progress('replay_outbox');await flushArchive(state.pendingArchiveKey);
  progress('retired_cleanup');const retiredKeys=[];
  let cleaned=0;for(const entry of state.retiredKeys??[]){
   if(cleaned>=20||entry.after>now||[state.storeKey,state.lookupsKey,state.feedKey,state.previewKey].includes(entry.key)){retiredKeys.push(entry);continue;}
   try{await blobs.delete(entry.key);cleaned++;}catch{retiredKeys.push(entry);}
  }
  progress('read_state');
  const store=reviveStore(await read(state.storeKey,state.storeUrl)),lookups=await read(state.lookupsKey,state.lookupsUrl)??{};
  const migrationBackupKey=!state.storeKey?await put('backup',store):undefined;
  store.modelArtifacts=await rpc.query('models:serving',{});
  const previousGames=structuredClone(store.games);
  progress('public_sources');const publicChanged=await refreshPublicSports(store,now,publicFetcher);
  progress('provider_refresh');const result=await runTick({store,lookups,ledgers:state.ledgers,lastRun:state.lastRun,now,fetcher,keys:{apiSports:!!keys.apiSports,oddsApi:!!keys.oddsApi,oddspapi:!!keys.oddspapi},sleep,reserve:async ledgers=>{reserved=ledgers;await rpc.mutation('feed:reserve',{ledgers});}});
  reserved=result.ledgers;
  progress('research_training');refreshFootballResearch(store,now);
  const changes=updateRecord(store,now),batches=[];
  progress('archive_publications',changes.length);
  for(let start=0;start<changes.length;start+=20){
   const records=/** @type {any[]} */([]),publications=/** @type {any[]} */([]);
   for(let offset=start;offset<Math.min(changes.length,start+20);offset+=4)await Promise.all(changes.slice(offset,Math.min(start+20,offset+4)).map(async p=>{
    // Publish immutable evidence once per identity. The outbox makes metadata retries durable.
    for(const publication of [p,p.priorPublication].filter(Boolean)){
     const frozen={...publication};delete frozen.priorPublication;delete frozen.publicationHistory;
     const blobKey=await put(`archives/${p.fixtureId}`,frozen);
     if(publication===p){const {fixtureId,sport,family,match,league,kickoff,publishedAt,modelVersion,state:fixtureState}=p;
      records.push({fixtureId,sport,family,match,league,...(p.country?{country:p.country}:{}),...(p.tournament?{tournament:p.tournament}:{}),kickoff,publishedAt,modelVersion,state:fixtureState,observedAt:p.observedAt??publishedAt,blobKey,contributions:contributionsFor(p),fingerprint:hash(frozen),recent:recentRows(p),...(p.finishedAt?{finishedAt:p.finishedAt}:{}),...(p.settledMarkets?{settledMarkets:p.settledMarkets}:{}),...(p.periodScores?{periodScores:p.periodScores}:{}),...(p.score?{score:p.score}:{})});
     }
     publications.push({fixtureId:p.fixtureId,publishedAt:publication.publishedAt,modelVersion:publication.modelVersion,blobKey,...(publication.artifactVersion?{artifactVersion:publication.artifactVersion}:{})});
    }
   }));batches.push({records,publications});
  }
  // Preserve original evidence in existing archives; only the hot settlement copy is compacted.
  for(const [id,p]of Object.entries(store.projections))store.projections[id]=compactSnapshot(p);
  const usage=usageSummary(result.ledgers,now),feed=buildFeed(store,now,usage),{generatedAt,usage:_usage,...content}=feed,version=hash(content).slice(0,16);
  const preview=buildBoardPreview(feed,now),{generatedAt:_time,...previewContent}=preview,previewVersion=hash(previewContent).slice(0,16);
  progress('commit_state');const storeKey=await put('state',store),lookupsKey=result.lookupsChanged||!state.lookupsKey?await put('state',lookups):state.lookupsKey;
  const feedKey=version!==state.feedVersion||!state.feedKey?await put('feed',feed):state.feedKey;
  const previewKey=previewVersion!==state.previewVersion||!state.previewKey?await put('preview',preview):state.previewKey;
  const changedStates=Object.values(store.games).filter(g=>JSON.stringify(g.status)!==JSON.stringify(previousGames[g.uid]?.status)||g.kickoff!==previousGames[g.uid]?.kickoff).map(g=>({fixtureId:g.uid,kickoff:g.kickoff,status:g.status.state,...(g.status.settledMarkets?{settledMarkets:g.status.settledMarkets}:{}),...(g.status.periodScores?{periodScores:g.status.periodScores}:{}),family:SPORTS[/** @type {import("./catalog.js").SportKey} */(g.sport)].family,...(Number.isFinite(g.status.home)&&Number.isFinite(g.status.away)?{score:{home:g.status.home,away:g.status.away,...(g.status.regHome!==undefined?{regHome:g.status.regHome}:{}),...(g.status.regAway!==undefined?{regAway:g.status.regAway}:{})}}:{})}));
  const events=Object.entries(notificationCounts(previousGames,store.games,now)).filter(([,count])=>count>0).map(([event,count])=>({event,count,batchId:`${now}:${event}`}));
  const pendingArchiveKey=batches.length||changedStates.length||events.length?await put('outbox',{batches,states:changedStates,events}):undefined;
  for(const key of [state.storeKey,state.lookupsKey,state.feedKey,state.previewKey])if(key&&![storeKey,lookupsKey,feedKey,previewKey].includes(key)&&!retiredKeys.some(entry=>entry.key===key))retiredKeys.push({key,after:now+2*3600000});
  await rpc.mutation('feed:commitEdge',{retiredKeys,now,ledgers:result.ledgers,lastRun:result.lastRun,log:result.log,storeKey,lookupsKey,feedKey,version,generatedAt,previewKey,previewVersion,counts:{...Object.fromEntries(Object.entries(feed.inputs).map(([s,rows])=>[s,rows.length])),games:feed.games.length},usage,coverage:{fixtures:feed.games.length,projected:feed.projections.length,unavailable:feed.games.filter(g=>!g.priced).length,pending:Object.keys(store.record.pending).length,modelVersion:MODEL_VERSION},...(pendingArchiveKey?{pendingArchiveKey}:{}),...(migrationBackupKey?{migrationBackupKey}:{})});
  // Public preview is intentionally limited; premium data is never written to this key.
  await blobs.put('preview/current.gz',gzipJson(preview));
  progress('commit_outbox',batches.length);await flushArchive(pendingArchiveKey);
  // Replaced hot blobs have a two-hour grace period for in-flight readers and training jobs.
  await rpc.mutation('feed:completeEdge',{});
  progress('complete');return {ran:result.ran.length,archiveChanges:changes.length,feedUpdated:version!==state.feedVersion,storeBytes:gzipJson(store).length,feedBytes:gzipJson(feed).length,publicChanged};
 }catch(error){let message=error instanceof Error?error.message:String(error);for(const value of Object.values(keys))if(value)message=message.split(value).join('[redacted]');await rpc.mutation('feed:release',{now,error:message.slice(0,300),...(reserved?{ledgers:reserved}:{})});throw new Error(message);}
}
