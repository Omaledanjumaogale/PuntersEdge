import {it,expect} from 'vitest';
import {convexTest} from 'convex-test';
import {anyApi} from 'convex/server';
import schema from '../../convex/schema';
import {contributionsFor} from '../../src/lib/feeds/performance.js';
const modules=import.meta.glob('../../convex/**/*.ts');
it('keeps original publication blobs immutable and rejects anonymous archive reads',async()=>{
 const t=convexTest(schema,modules),storageId=await t.run(ctx=>ctx.storage.store(new Blob(['first'])));
 const args={fixtureId:'published',publishedAt:1000,modelVersion:'v3',artifactVersion:'fitted-1',storageId};
 await t.mutation(anyApi.performance.publication,args);
 const replacement=await t.run(ctx=>ctx.storage.store(new Blob(['different'])));await t.mutation(anyApi.performance.publication,{...args,storageId:replacement});
 const rows=await t.run(ctx=>ctx.db.query('forecast_publications').collect());expect(rows).toHaveLength(1);expect(rows[0].storageId).toBe(storageId);
 await expect(t.query(anyApi.performance.publications,{fixtureId:'published'})).rejects.toThrow('Administrator');
});
it('keeps durable performance idempotent and replaces corrected results without double counting',async()=>{
 const t=convexTest(schema,modules);
 const base={fixtureId:'fixture-1',sport:'football',family:'football',match:'Home vs Away',league:'League',kickoff:Date.now(),publishedAt:Date.now()-60000,modelVersion:'test-version',state:'finished',score:{home:1,away:0}};
 const rows=[{market:'Result',grade:'A',modelProb:.7,marketProb:.6,result:'won',profit:1,pricing:'quoted',verdict:true}];
 const store=()=>t.run(ctx=>ctx.storage.store(new Blob(['fixture'])));
 const first={...base,storageId:await store(),fingerprint:'original',contributions:contributionsFor({kickoff:base.kickoff,selections:rows}),recent:rows};
 await t.mutation(anyApi.performance.record,first);
 await t.mutation(anyApi.performance.record,{...first,storageId:await store()});
 let metric=await t.run(ctx=>ctx.db.query('performance_metrics').withIndex('by_sport',q=>q.eq('sport','football')).unique());
 expect(metric?.fixtures).toBe(1);expect(metric?.settledFixtures).toBe(1);expect(metric?.groups.summary.n).toBe(1);expect(metric?.groups.summary.won).toBe(1);
 const corrected=rows.map(row=>({...row,result:'lost',profit:-1}));
 await t.mutation(anyApi.performance.record,{...first,observedAt:base.publishedAt+1000,score:{home:0,away:1},storageId:await store(),fingerprint:'corrected',contributions:contributionsFor({kickoff:base.kickoff,selections:corrected}),recent:corrected});
 metric=await t.run(ctx=>ctx.db.query('performance_metrics').withIndex('by_sport',q=>q.eq('sport','football')).unique());
 expect(metric?.groups.summary.n).toBe(1);expect(metric?.groups.summary.won).toBe(0);expect(metric?.groups.summary.lost).toBe(1);expect(metric?.groups.summary.profit).toBe(-1);
 await t.mutation(anyApi.performance.record,{...first,storageId:await store()});
 expect(await t.query(anyApi.performance.fixtureStates,{ids:['fixture-1']})).toMatchObject([{score:{home:0,away:1}}]);
});

it('batches R2 archive metadata and leaves aggregate documents untouched on pre-match refresh',async()=>{
 const t=convexTest(schema,modules),base={fixtureId:'r2-1',sport:'football',family:'football',match:'A vs B',league:'League',kickoff:2000,publishedAt:1000,modelVersion:'v3',state:'scheduled',blobKey:'archives/r2-1/abc.gz',fingerprint:'first',contributions:{},recent:[]};
 await t.mutation(anyApi.performance.archiveBatch,{publications:[{fixtureId:base.fixtureId,publishedAt:base.publishedAt,modelVersion:base.modelVersion,blobKey:base.blobKey}],records:[base,{...base,fixtureId:'r2-2',blobKey:'archives/r2-2/abc.gz'}]});
 const before=await t.run(ctx=>ctx.db.query('performance_metrics').collect());expect(before).toHaveLength(2);expect(before.every(row=>row.fixtures===2)).toBe(true);
 await t.mutation(anyApi.performance.archiveBatch,{publications:[],records:[{...base,publishedAt:1500,observedAt:1500,fingerprint:'new-publication',blobKey:'archives/r2-1/def.gz'}]});
 expect(await t.run(ctx=>ctx.db.query('performance_metrics').collect())).toEqual(before);
 await expect(t.query(anyApi.performance.archive,{fixtureId:'r2-1'})).rejects.toThrow('Administrator');
 const rows=await t.run(ctx=>ctx.db.query('projection_snapshots').collect());expect(rows.every(row=>!row.storageId&&row.blobKey)).toBe(true);
});
it('quota reservations do not rewrite the large ingest document or subscriber feed',async()=>{
 const t=convexTest(schema,modules);await t.run(async ctx=>{await ctx.db.insert('feed_state',{key:'ingest',data:{lastRun:{job:10},ledgers:{legacy:true}}});await ctx.db.insert('feed_state',{key:'feed',data:{version:'unchanged'}});});
 const before=await t.run(ctx=>ctx.db.query('feed_state').collect());await t.mutation(anyApi.feed.reserve,{ledgers:{provider:{used:5}}});
 const after=await t.run(ctx=>ctx.db.query('feed_state').collect());expect(after.filter(r=>r.key!=='quota')).toEqual(before);expect(after.find(r=>r.key==='quota')?.data.ledgers.provider.used).toBe(5);
});

it('rejects a stale dimension reindex rather than overwrite a newer result',async()=>{
 const t=convexTest(schema,modules);const row={fixtureId:'reindex-race',sport:'football',family:'football',match:'Home v Away',league:'Test',kickoff:1,publishedAt:1,observedAt:3,modelVersion:'test',state:'finished',score:{home:1,away:2},blobKey:'archives/test.gz',fingerprint:'newer',contributions:{},recent:[]};await t.mutation(anyApi.performance.record,row);
 expect(await t.mutation(anyApi.performance.reindex,{fixtureId:row.fixtureId,expectedFingerprint:'older',contributions:{}})).toBe(false);
 expect((await t.query(anyApi.performance.fixtureStates,{ids:[row.fixtureId]}))[0].score).toEqual({home:1,away:2});
});
