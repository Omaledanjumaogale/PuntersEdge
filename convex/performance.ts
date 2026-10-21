import {internalMutation,internalQuery,query} from './_generated/server';
import {v} from 'convex/values';
import {requireAdmin} from './access';
import {emptyCounters,addCounters,statsOf,MODEL_VERSION} from '../src/lib/feeds/performance.js';
const score=v.object({home:v.number(),away:v.number(),regHome:v.optional(v.number()),regAway:v.optional(v.number())});
const location={storageId:v.optional(v.id('_storage')),blobKey:v.optional(v.string())};
const publicationArgs={fixtureId:v.string(),publishedAt:v.number(),modelVersion:v.string(),artifactVersion:v.optional(v.string()),...location};
const recordArgs={observedAt:v.optional(v.number()),fixtureId:v.string(),sport:v.string(),family:v.string(),match:v.string(),league:v.string(),country:v.optional(v.string()),tournament:v.optional(v.string()),kickoff:v.number(),publishedAt:v.number(),modelVersion:v.string(),state:v.string(),finishedAt:v.optional(v.number()),periodScores:v.optional(v.record(v.string(),v.object({home:v.number(),away:v.number()}))),score:v.optional(score),...location,fingerprint:v.string(),contributions:v.any(),recent:v.array(v.any())};
function checkLocation(args:any){if(!args.storageId&&!/^archives\/[A-Za-z0-9_./-]+\.gz$/.test(args.blobKey??''))throw new Error('Private archive location required');}
async function publish(ctx:any,args:any){
 checkLocation(args);const old=await ctx.db.query('forecast_publications').withIndex('by_fixture_publication',(q:any)=>q.eq('fixtureId',args.fixtureId).eq('publishedAt',args.publishedAt)).unique();
 if(old){if(args.storageId&&args.storageId!==old.storageId)await ctx.storage.delete(args.storageId);return;}await ctx.db.insert('forecast_publications',args);
}
export const publication=internalMutation({args:publicationArgs,handler:publish});
const archiveUrl=async(ctx:any,row:any)=>row.blobKey?`/api/archive?key=${encodeURIComponent(row.blobKey)}`:row.storageId?ctx.storage.getUrl(row.storageId):null;
export const publications=query({args:{fixtureId:v.string()},handler:async(ctx,args)=>{
 await requireAdmin(ctx);const rows=await ctx.db.query('forecast_publications').withIndex('by_fixture_publication',q=>q.eq('fixtureId',args.fixtureId)).order('desc').take(200);return Promise.all(rows.map(async row=>({...row,url:await archiveUrl(ctx,row)})));
}});
/** Batch reads/writes each aggregate once; pre-match refreshes don't rewrite settled metrics. */
async function recordOne(ctx:any,args:any,metrics:Map<string,any>){
 checkLocation(args);const old=await ctx.db.query('projection_snapshots').withIndex('by_fixture',(q:any)=>q.eq('fixtureId',args.fixtureId)).unique();
 if(old&&((args.observedAt??args.publishedAt)<=(old.observedAt??old.publishedAt)&&old.fingerprint!==args.fingerprint||old.fingerprint===args.fingerprint)){
  if(args.storageId&&args.storageId!==old.storageId)await ctx.storage.delete(args.storageId);return;
 }
 if(old){await ctx.db.replace(old._id,args);if(old.storageId&&old.storageId!==args.storageId)await ctx.storage.delete(old.storageId);}else await ctx.db.insert('projection_snapshots',args);
 if(old&&JSON.stringify(old.contributions)===JSON.stringify(args.contributions))return;
 for(const sport of [args.sport,'all']){
  if(!metrics.has(sport)){const row=await ctx.db.query('performance_metrics').withIndex('by_sport',(q:any)=>q.eq('sport',sport)).unique();metrics.set(sport,{row,values:{sport,groups:row?.groups??{},fixtures:row?.fixtures??0,settledFixtures:row?.settledFixtures??0,verdicts:row?.verdicts??0,updatedAt:Date.now()}});}
  const {values}=metrics.get(sport),groups=values.groups;
  for(const [key,c]of Object.entries(old?.contributions??{}))addCounters(groups[key]??=emptyCounters(),c,-1);
  for(const [key,c]of Object.entries(args.contributions))addCounters(groups[key]??=emptyCounters(),c);
  const cutoff=new Date(Date.now()-365*86400000).toISOString().slice(0,10);for(const key of Object.keys(groups))if(key.startsWith('days:')&&key.slice(5)<cutoff)delete groups[key];
  values.fixtures+=old?0:1;values.settledFixtures+=Number(Object.keys(args.contributions).length>0)-Number(Object.keys(old?.contributions??{}).length>0);values.verdicts+=Number(!!args.contributions.verdict)-Number(!!old?.contributions?.verdict);
 }
}
async function flushMetrics(ctx:any,metrics:Map<string,any>){for(const {row,values}of metrics.values())if(row)await ctx.db.patch(row._id,values);else await ctx.db.insert('performance_metrics',values);}
export const record=internalMutation({args:recordArgs,handler:async(ctx,args)=>{const metrics=new Map();await recordOne(ctx,args,metrics);await flushMetrics(ctx,metrics);}});
export const archiveBatch=internalMutation({args:{publications:v.array(v.object(publicationArgs)),records:v.array(v.object(recordArgs))},handler:async(ctx,args)=>{
 if(args.records.length>20||args.publications.length>40)throw new Error('Archive batch too large');const metrics=new Map();for(const row of args.publications)await publish(ctx,row);for(const row of args.records)await recordOne(ctx,row,metrics);await flushMetrics(ctx,metrics);
}});
export const fixtureStates=internalQuery({args:{ids:v.array(v.string())},handler:async(ctx,args)=>{
 if(args.ids.length>100)throw new Error('At most 100 fixtures per lookup.');const result=[];const tennis=args.ids.some(id=>id.startsWith('tennis-oddsapi-'))?(await ctx.db.query('feed_state').withIndex('by_key',q=>q.eq('key','tennis-schedule')).unique())?.data:null;for(const fixtureId of args.ids){if(fixtureId.startsWith('tennis-oddsapi-')){const f=tennis?.at<=Date.now()&&Date.now()-tennis.at<=86400000?tennis.fixtures?.find((row:any)=>row.id===fixtureId):null;if(f)result.push({fixtureId,kickoff:f.kickoff,status:'scheduled',family:'tennis',league:f.league,tournament:f.tournament,...(f.country?{country:f.country}:{})});continue;}const p=await ctx.db.query('projection_snapshots').withIndex('by_fixture',q=>q.eq('fixtureId',fixtureId)).unique();if(p)result.push({fixtureId,kickoff:p.kickoff,status:p.state,family:p.family,league:p.league,...(p.country?{country:p.country}:{}),...(p.tournament?{tournament:p.tournament}:{}),...(p.periodScores?{periodScores:p.periodScores}:{}),...(p.score?{score:p.score}:{})});}return result;
}});
export const archive=query({args:{fixtureId:v.string()},handler:async(ctx,args)=>{await requireAdmin(ctx);const p=await ctx.db.query('projection_snapshots').withIndex('by_fixture',q=>q.eq('fixtureId',args.fixtureId)).unique();return p?{url:await archiveUrl(ctx,p),modelVersion:p.modelVersion,publishedAt:p.publishedAt}:null;}});
export const dashboard = query({args:{sport:v.optional(v.string())},handler:async(ctx,args)=>{
 await requireAdmin(ctx);
 const sport=args.sport??'all';
 if(!['all','football','basketball','nba','hockey','baseball'].includes(sport))throw new Error('Unknown sport.');
 const row=await ctx.db.query('performance_metrics').withIndex('by_sport',q=>q.eq('sport',sport)).unique();
 const sportRows=await ctx.db.query('performance_metrics').take(6);
 const feed=await ctx.db.query('feed_state').withIndex('by_key',q=>q.eq('key','feed')).unique();
 const coverage=feed?.data?.coverage??{fixtures:0,projected:0,unavailable:0,pending:0,modelVersion:MODEL_VERSION};
 const recentRows=sport==='all'?await ctx.db.query('projection_snapshots').withIndex('by_state_kickoff',q=>q.eq('state','finished')).order('desc').take(15):await ctx.db.query('projection_snapshots').withIndex('by_sport_state',q=>q.eq('sport',sport).eq('state','finished')).order('desc').take(15);
 const breakdown=(name:string)=>Object.fromEntries(Object.entries(row?.groups??{}).filter(([key])=>key.startsWith(name+':')).map(([key,c])=>[key.slice(name.length+1),statsOf(c)]));
 const recent=recentRows.filter(p=>p.score).flatMap(p=>p.recent.map(s=>({...s,fixtureId:p.fixtureId,sport:p.sport,match:p.match,league:p.league,kickoff:p.kickoff,score:p.score,modelVersion:p.modelVersion,publishedAt:p.publishedAt}))).slice(0,100);
 return {publishedFixtures:row?.fixtures??0,settledFixtures:row?.settledFixtures??0,directions:breakdown('directions'),scopes:breakdown('scopes'),summary:{...statsOf(row?.groups?.summary),fixtures:row?.fixtures??0,verdicts:row?.verdicts??0,settledFixtures:row?.settledFixtures??0},verdict:statsOf(row?.groups?.verdict),sports:Object.fromEntries(sportRows.filter(p=>p.sport!=='all').map(p=>[p.sport,statsOf(p.groups.summary)])),versions:breakdown('versions'),artifacts:breakdown('artifacts'),grades:breakdown('grades'),markets:breakdown('markets'),bands:breakdown('bands'),days:breakdown('days'),coverage,recent};
}});

/** Deployment-admin maintenance; no customer or public access. */
export const reindexPage=internalQuery({args:{cursor:v.optional(v.string())},handler:async(ctx,args)=>{
 const page=await ctx.db.query('projection_snapshots').paginate({numItems:50,cursor:args.cursor??null});
 const rows=page.page.filter(p=>p.contributions?.summary?.n>0&&!Object.keys(p.contributions??{}).some(k=>k.startsWith('directions:')));
 return {...page,page:await Promise.all(rows.map(async row=>({...row,...(row.storageId&&!row.blobKey?{legacyUrl:await ctx.storage.getUrl(row.storageId)}:{})})))};
}});

/** Apply a derived-dimension migration only if the source snapshot has not changed. */
export const reindex=internalMutation({args:{fixtureId:v.string(),expectedFingerprint:v.string(),contributions:v.any()},handler:async(ctx,args)=>{
 const old=await ctx.db.query('projection_snapshots').withIndex('by_fixture',q=>q.eq('fixtureId',args.fixtureId)).unique();
 if(!old||old.fingerprint!==args.expectedFingerprint)return false;
 const {_id,_creationTime,...record}=old,metrics=new Map();
 await recordOne(ctx,{...record,contributions:args.contributions,observedAt:Math.max(Date.now(),(old.observedAt??old.publishedAt)+1),fingerprint:old.fingerprint+':directions-v2'},metrics);
 await flushMetrics(ctx,metrics);return true;
}});

/** Migration batches amortize aggregate reads/writes across up to twenty fixtures. */
export const reindexBatch=internalMutation({args:{rows:v.array(v.object({fixtureId:v.string(),expectedFingerprint:v.string(),contributions:v.any()}))},handler:async(ctx,args)=>{
 if(args.rows.length>20)throw new Error('Reindex batch too large');const metrics=new Map();let updated=0;
 for(const input of args.rows){const old=await ctx.db.query('projection_snapshots').withIndex('by_fixture',q=>q.eq('fixtureId',input.fixtureId)).unique();if(!old||old.fingerprint!==input.expectedFingerprint)continue;const {_id,_creationTime,...record}=old;await recordOne(ctx,{...record,contributions:input.contributions,observedAt:Math.max(Date.now(),(old.observedAt??old.publishedAt)+1),fingerprint:old.fingerprint+':directions-v2'},metrics);updated++;}
 await flushMetrics(ctx,metrics);return updated;
}});
