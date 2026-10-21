import {it,expect} from 'vitest';import {convexTest} from 'convex-test';import {anyApi} from 'convex/server';import schema from '../../convex/schema';import {contributionsFor} from '../../src/lib/feeds/performance.js';
const modules=import.meta.glob('../../convex/**/*.ts');
it('batches dimension writes, skips stale evidence, and never doubles fixture counts on replay',async()=>{
 const t=convexTest(schema,modules),contributions=contributionsFor({kickoff:1,selections:[{key:'u2.5',selection:'Under 2.5',market:'Match total',result:'won',modelProb:.7,marketProb:.6,grade:'PASS',pricing:'derived'}]});
 for(const id of ['a','b'])await t.mutation(anyApi.performance.record,{fixtureId:id,sport:'football',family:'football',match:'Home v Away',league:'Test',kickoff:1,publishedAt:1,observedAt:2,modelVersion:'test',state:'finished',score:{home:1,away:0},blobKey:'archives/test.gz',fingerprint:'original',contributions:{},recent:[]});
 const rows=[{fixtureId:'a',expectedFingerprint:'original',contributions},{fixtureId:'b',expectedFingerprint:'stale',contributions}];expect(await t.mutation(anyApi.performance.reindexBatch,{rows})).toBe(1);expect(await t.mutation(anyApi.performance.reindexBatch,{rows})).toBe(0);
 const metric=await t.run(ctx=>ctx.db.query('performance_metrics').withIndex('by_sport',q=>q.eq('sport','all')).unique());expect(metric?.fixtures).toBe(2);expect(metric?.settledFixtures).toBe(1);expect(metric?.groups.summary.n).toBe(1);expect((await t.query(anyApi.performance.fixtureStates,{ids:['b']}))[0].score).toEqual({home:1,away:0});
});
