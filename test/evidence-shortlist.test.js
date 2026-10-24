import test from 'node:test';import assert from 'node:assert/strict';
import {compactEvidence,buildEvidenceReport,evidenceShortlist,evidenceMarket,wilson,cohortKey} from '../src/lib/evidence-shortlist.js';
import {refreshEvidenceCatalog} from '../scripts/evidence-catalog.mjs';import {gzipJson,parseGzip} from '../src/lib/feeds/ingest-runtime.js';
const now=Date.now(),DAY=86400000;
const snap=(id,result='won',extra={})=>({fixtureId:id,sport:'football',family:'football',match:'Home '+id+' vs Away '+id,league:'Test League',country:'Nigeria',kickoff:now-2*DAY,publishedAt:now-3*DAY,finishedAt:now-DAY,modelVersion:'engine-v1',state:'finished',score:{home:3,away:0},input:{ratingsSource:'table'},selections:[{key:'o2.5',market:'Match total',selection:'Over 2.5',modelProb:.75,pricing:'quoted',odds:2,modelVersion:'baseline',result}],...extra});
const future=(id,extra={})=>compactEvidence(snap(id,'won',{...extra,kickoff:now+DAY,publishedAt:now-1000,state:'scheduled',finishedAt:undefined,score:undefined}));
const history=(n=40,wins=32)=>Array.from({length:n},(_,i)=>compactEvidence(snap('history-'+i,i<wins?'won':'lost')));
test('exact lines, periods, sides and aliases preserve settlement identity',()=>{
 assert.equal(evidenceMarket('over25','football').signature,evidenceMarket('forecast:full:total:over:2.5','football').signature);
 assert.notEqual(evidenceMarket('o2.5','football').signature,evidenceMarket('o1.5','football').signature);
 assert.notEqual(evidenceMarket('forecast:full:home:under:1.5','football').signature,evidenceMarket('forecast:full:away:under:1.5','football').signature);
 assert.notEqual(evidenceMarket('period:first_half:total:over:2.5','football').signature,evidenceMarket('o2.5','football').signature);
 assert.equal(evidenceMarket('unrecognized','football'),null);
});
test('Wilson meter is sample sensitive, drops with losses and handles empty/all-win samples',()=>{
 assert.deepEqual(wilson(0,0),{low:0,high:1});assert.ok(Math.abs(wilson(20,20).low-.83887484)<1e-6);
 assert.ok(wilson(80,100).low>wilson(8,10).low);assert.ok(wilson(15,20).low<wilson(20,20).low);assert.ok(wilson(2,2).low<.35);
});
test('comparable counts include PASS/unpriced outcomes but never fabricate price ROI',()=>{
 const hs=history();for(const f of hs)for(const r of f.rows){r.odds=0;r.pricing='unpriced';}
 const f=future('future'),report=buildEvidenceReport(hs,[f],now),result=evidenceShortlist(report,{},now);
 assert.equal(result.rows.length,1);const c=result.rows[0].cohort;assert.equal(c.binaryN,40);assert.equal(c.won,32);assert.equal(c.strikeRate,.8);assert.equal(c.quotedRoi,null);assert.equal(c.examples.length,5);assert.ok(c.interval.low>.64);
});
test('insufficient samples, other leagues/sources/models/bands and different exact lines do not masquerade as matching evidence',()=>{
 const f=future('future'),report=buildEvidenceReport(history(),[f],now);assert.equal(evidenceShortlist(report,{sameLeague:true},now).rows.length,1);
 for(const change of [g=>g.league='Another League',g=>g.version='another-engine',g=>g.rows[0].artifact='another-fit',g=>g.rows[0].source='market',g=>g.rows[0].modelProb=.85,g=>Object.assign(g.rows[0],evidenceMarket('o1.5','football'))]){const altered=structuredClone(f);change(altered);const r=buildEvidenceReport(history(),[altered],now);assert.equal(evidenceShortlist(r,{sameLeague:true},now).rows.length,0);}
 assert.equal(evidenceShortlist(buildEvidenceReport(history(2,2),[f],now),{},now).rows.length,0);
});
test('started fixtures stay on the shortlist until finished; 80 qualified fixtures are not truncated',()=>{
 const fs=Array.from({length:80},(_,i)=>future('upcoming-'+i)),r=buildEvidenceReport(history(),fs,now),before=JSON.stringify(r);
 assert.equal(evidenceShortlist(r,{},now).rows.length,80);assert.equal(JSON.stringify(r),before);
 const live=new Map([[fs[0].fixtureId,{status:{state:'live'}}],[fs[1].fixtureId,{status:{state:'finished'}}]]);assert.equal(evidenceShortlist(r,{},now,live).rows.length,79);
 assert.equal(evidenceShortlist(r,{},now+DAY).rows.length,80);
});
test('stale kickoffs leave the active shortlist while provider-confirmed live fixtures remain; history can reconcile past records',()=>{
 const current=future('current'),started=future('started'),stale=future('stale'),r=buildEvidenceReport(history(),[current,started,stale],now);started.kickoff=now-2*60*60*1000;stale.kickoff=now-5*60*60*1000;
 assert.deepEqual(evidenceShortlist(r,{},now).rows.map(x=>x.fixtureId).sort(),['current','started']);
 assert.deepEqual(evidenceShortlist(r,{},now,new Map([['stale',{status:{state:'live'}}]])).rows.map(x=>x.fixtureId).sort(),['current','stale','started']);
 assert.ok(evidenceShortlist(r,{includePastForHistory:true},now).rows.some(x=>x.fixtureId==='stale'));
});
test('provider copies and duplicate canonical aliases cannot inflate recurrence',()=>{
 const hs=history(),copy=structuredClone(hs[0]);copy.fixtureId='provider-copy';copy.rows.push({...copy.rows[0],key:'forecast:full:total:over:2.5'});
 const r=buildEvidenceReport([...hs,copy],[future('future')],now);assert.equal(evidenceShortlist(r,{},now).rows[0].cohort.binaryN,40);
 const s=snap('alias');s.selections.push({...s.selections[0],key:'forecast:full:total:over:2.5',pricing:'derived',odds:0});assert.equal(compactEvidence(s).rows.length,1);
});
test('published-after-kickoff snapshots never enter the catalog; pushes/partials never count as binary wins',()=>{
 assert.equal(compactEvidence(snap('late','won',{publishedAt:now})),null);const hs=history(22,20);hs[20].rows[0].result='push';hs[21].rows[0].result='half-won';const r=buildEvidenceReport(hs,[future('future')],now),c=evidenceShortlist(r,{},now).rows[0].cohort;assert.equal(c.binaryN,20);assert.equal(c.won,20);assert.equal(c.n,22);assert.equal(c.partial,1);assert.equal(c.push,1);
});
test('ranking uses evidence floor then observed rate/model %, without reordering source history',()=>{
 const h=history(),f1=future('next-low'),f2=future('next-high');f2.rows[0].modelProb=.79;const r=buildEvidenceReport(h,[f1,f2],now),rows=evidenceShortlist(r,{},now).rows;assert.equal(rows[0].fixtureId,'next-high');assert.equal(rows[0].rank,1);assert.equal(rows[1].rank,2);
});
test('runner stores bulk history in R2, publishes only metadata and reuses its warm catalog',async()=>{
 const blobsMap=new Map([['state/source.gz',gzipJson({games:{},projections:{h:snap('h'),next:snap('next','won',{kickoff:now+DAY,publishedAt:now-1000,state:'scheduled',score:undefined})}})]]);let meta=null,sources=0;
 const blobs={get:async key=>blobsMap.get(key)??null,put:async(key,value)=>blobsMap.set(key,value),delete:async key=>blobsMap.delete(key)};
 const rpc={query:async(name)=>name==='evidence:state'?{ingest:'state/source.gz',catalog:meta}:(sources++,{page:[{fixtureId:'h',fingerprint:'source-h',publishedAt:now-3*DAY,score:{home:3,away:0}}],isDone:true}),mutation:async(name,args)=>{assert.equal(name,'evidence:publish');assert.equal(args.coverage.historicalFixtures,1);assert.ok(!('groups' in args));meta=args;return true;}};
 const first=await refreshEvidenceCatalog({rpc,blobs,now});assert.equal(first.published,true);assert.equal(sources,1);assert.equal(parseGzip(blobsMap.get(meta.reportKey)).upcoming.length,1);
 await refreshEvidenceCatalog({rpc,blobs,now:now+60000});assert.equal(sources,1);
});
test('runner reconciles provider-finished games into the archive and history even if projection state lagged',async()=>{
 const projection=snap('provider-finished','won',{kickoff:now-DAY,publishedAt:now-2*DAY,state:'scheduled',finishedAt:undefined,score:undefined}),prior=Object.fromEntries(history().map(f=>[f.fixtureId,snap(f.fixtureId,'won')])),blobsMap=new Map([['state/source.gz',gzipJson({games:{'provider-finished':{status:{state:'finished',home:3,away:0}}},projections:{...prior,'provider-finished':projection}})]]);let meta=null;
 const blobs={get:async key=>blobsMap.get(key)??null,put:async(key,value)=>blobsMap.set(key,value),delete:async key=>blobsMap.delete(key)},rpc={query:async name=>name==='evidence:state'?{ingest:'state/source.gz',catalog:meta}:{page:[],isDone:true},mutation:async(_name,args)=>{meta=args;return true;}};
 await refreshEvidenceCatalog({rpc,blobs,now});const catalog=parseGzip(blobsMap.get(meta.stateKey)),report=parseGzip(blobsMap.get(meta.reportKey));
 assert.equal(report.upcoming.length,0);assert.ok(catalog.fixtures['provider-finished'],JSON.stringify(Object.keys(catalog.fixtures)));assert.equal(catalog.fixtures['provider-finished'].state,'finished');assert.deepEqual(catalog.fixtures['provider-finished'].score,{home:3,away:0});assert.ok(Object.values(catalog.historyIndex).some(day=>day.completed>0));
});
test('catalog drops past scheduled rows after the grace period but preserves confirmed live play',async()=>{
 const pastScheduled=snap('stale-scheduled','won',{kickoff:now-6*60*60*1000,publishedAt:now-7*60*60*1000,state:'scheduled',finishedAt:undefined,score:undefined}),pastLive=snap('confirmed-live','won',{kickoff:now-6*60*60*1000,publishedAt:now-7*60*60*1000,state:'scheduled',finishedAt:undefined,score:undefined}),blobsMap=new Map([['state/source.gz',gzipJson({games:{'stale-scheduled':{status:{state:'scheduled'}},'confirmed-live':{status:{state:'live'}}},projections:{'stale-scheduled':pastScheduled,'confirmed-live':pastLive}})]]);let meta=null;
 const blobs={get:async key=>blobsMap.get(key)??null,put:async(key,value)=>blobsMap.set(key,value),delete:async key=>blobsMap.delete(key)},rpc={query:async name=>name==='evidence:state'?{ingest:'state/source.gz',catalog:meta}:{page:[],isDone:true},mutation:async(_name,args)=>{meta=args;return true;}};
 await refreshEvidenceCatalog({rpc,blobs,now});const report=parseGzip(blobsMap.get(meta.reportKey));assert.deepEqual(report.upcoming.map(f=>f.fixtureId),['confirmed-live']);
});

test('double chance 1X/X2/12 and either team Over 1.5 have explicit exact-outcome filters',()=>{
 const selections=[['dc1x','Home or draw',.85],['dcx2','Away or draw',.25],['dc12','Home or away',.9],['h15','Home Over 1.5',.75],['a15','Away Over 1.5',.15]].map(([key,selection,modelProb])=>({key,selection,modelProb,modelVersion:'baseline',pricing:'derived',result:'won'}));
 const hs=Array.from({length:40},(_,i)=>compactEvidence(snap('dc-'+i,'won',{selections}))),f=future('dc-next',{selections}),r=buildEvidenceReport(hs,[f],now),rules={minModel:0,minSamples:20,minStrike:0,minFloor:0};
 assert.equal(evidenceShortlist(r,{...rules,kind:'double-chance'},now).rows.length,2);
 assert.equal(evidenceShortlist(r,{...rules,kind:'dcx2'},now).rows.length,0);for(const key of ['dc1x','dc12'])assert.equal(evidenceShortlist(r,{...rules,kind:key},now).rows[0].side,key);
 assert.deepEqual(evidenceShortlist(r,{...rules,kind:'team-15'},now).rows.map(s=>s.kind).sort(),['team-home']);
 assert.equal(evidenceShortlist(r,{...rules,kind:'first-score'},now).rows.length,0);
});
test('quarter-line outcomes are not given a binary confidence meter',()=>{
 const selections=[{key:'forecast:full:handicap:home:1.75',selection:'Home +1.75',modelProb:.9,modelVersion:'baseline',pricing:'derived',result:'won'}];const hs=Array.from({length:40},(_,i)=>compactEvidence(snap('quarter-'+i,'won',{selections}))),r=buildEvidenceReport(hs,[future('quarter-next',{selections})],now),result=evidenceShortlist(r,{},now);assert.equal(result.rows.length,0);assert.equal(result.rejected.partialSettlement,1);
});

test('football scoring, first-half lines and basketball team totals filter exact outcomes',()=>{
 const keys=['h05','a05','bttsYes','bttsNo','period:first_half:total:under:1.5','period:first_half:total:under:2.5','forecast:full:home:over:90.5','forecast:full:away:under:95.5','o2.5','u2.5'];
 const selections=keys.map(key=>({key,selection:key,modelProb:.75,modelVersion:'baseline',pricing:'derived',result:'won'}));
 const rules={minModel:0,minSamples:20,minStrike:0,minFloor:0};
 for(const sport of ['football','basketball']){const hs=Array.from({length:40},(_,i)=>compactEvidence(snap(`${sport}-${i}`,'won',{sport,selections}))),r=buildEvidenceReport(hs,[future(`${sport}-next`,{sport,selections})],now);
 if(sport==='football'){const scoped=evidenceShortlist(r,{...rules,scope:'first_half'},now).rows;assert.equal(scoped.length,2);assert.ok(scoped.every(row=>row.scope==='first_half'));for(const kind of ['team-05','bttsYes','bttsNo','first-half-u15','first-half-u25','match-over','match-under']){const rows=evidenceShortlist(r,{...rules,kind},now).rows;assert.equal(rows.length,kind==='team-05'?2:kind==='match-under'?3:1);}}
 else {const rows=evidenceShortlist(r,{...rules,kind:'basketball-team'},now).rows;assert.ok(rows.some(r=>r.kind==='team-home'&&r.side==='over'));assert.ok(rows.some(r=>r.kind==='team-away'&&r.side==='under'));assert.equal(evidenceShortlist(r,{...rules,kind:'team-05'},now).rows.length,0);}}
});

test('two consecutive goals requires a complete, score-reconciled regulation sequence, independently for each side',async()=>{
 const {settleTwoConsecutive}=await import('../src/lib/engine/goal_sequence.js');
 const seq=sides=>({complete:true,scope:'regulation',sides});
 assert.equal(settleTwoConsecutive(seq(['home','away','home']),{home:2,away:1},'home'),'lost');
 assert.equal(settleTwoConsecutive(seq(['away','home','home']),{home:2,away:1},'home'),'won');
 assert.equal(settleTwoConsecutive(seq(['home','home','away','away']),{home:2,away:2},'away'),'won');
 assert.equal(settleTwoConsecutive(seq(['home','home','away','away']),{home:2,away:2},'home'),'won');
 assert.equal(settleTwoConsecutive(null,{home:3,away:0},'home'),null);
 assert.equal(settleTwoConsecutive(seq(['home','home']),{home:3,away:0},'home'),null);
 assert.equal(settleTwoConsecutive(seq([]),{home:0,away:0},'away'),'lost');
 const key='sequence:regulation:two-consecutive:home',s=snap('sequence','won',{selections:[{key,selection:'Home two consecutive',modelProb:.75,result:'won'}]});
 assert.equal(compactEvidence(s).rows.length,0);
 s.goalSequence=seq(['home','home','home']);assert.equal(compactEvidence(s).rows.length,1);
 assert.notEqual(evidenceMarket(key,'football').signature,evidenceMarket('h15','football').signature);
 assert.equal(evidenceMarket(key,'basketball'),null);
});

test('basketball and NBA filters explicitly include winners, spread, match totals and both team-total directions',()=>{
 const selections=['homeMl','awayMl','sph-3.5','spa3.5','o210.5','u210.5','forecast:full:home:over:100.5','forecast:full:away:under:105.5'].map(key=>({key,selection:key,modelProb:.75,pricing:'derived',result:'won'}));
 for(const sport of ['nba','basketball']){const hs=Array.from({length:40},(_,i)=>compactEvidence(snap(sport+i,'won',{sport,selections}))),r=buildEvidenceReport(hs,[future(sport+'-next',{sport,selections})],now);for(const [kind,n] of [['basketball-winner',2],['basketball-spread',2],['basketball-total',2],['basketball-team-over',1],['basketball-team-under',1]])assert.equal(evidenceShortlist(r,{kind},now).rows.length,n);}
});

test('shortlist history freezes pre-match qualification, later settles exact markets, and never backfills unseen past picks',async()=>{
 const {updateEvidenceHistory}=await import('../scripts/evidence-history.mjs'),{parseGzip}=await import('../src/lib/feeds/ingest-runtime.js');const map=new Map(),blobs={get:async k=>map.get(k),put:async(k,v)=>map.set(k,v)},catalog={fixtures:{}},f=future('remembered'),report=buildEvidenceReport(history(),[f],now),store={games:{},projections:{}};
 await updateEvidenceHistory({catalog,report,store,blobs,now});const key=[...map.keys()][0];let row=Object.values(parseGzip(map.get(key)).rows)[0];assert.equal(row.result,'pending');assert.equal(row.modelProb,.75);assert.equal(row.cohort.binaryN,40);
 store.games[f.fixtureId]={status:{state:'finished',home:3,away:0}};await updateEvidenceHistory({catalog,report,store,blobs,now:now+2*DAY});row=Object.values(parseGzip(map.get(key)).rows)[0];assert.equal(row.result,'won');assert.deepEqual(row.score,{home:3,away:0});assert.equal(row.cohort.binaryN,40);assert.equal(row.modelProb,.75);
 const empty={fixtures:{}};await updateEvidenceHistory({catalog:empty,report,store,blobs,now:now+2*DAY});assert.equal(Object.keys(empty.historyIndex).length,0);
 store.games[f.fixtureId].status.home=1;await updateEvidenceHistory({catalog,report,store,blobs,now:now+3*DAY});row=Object.values(parseGzip(map.get(key)).rows)[0];assert.equal(row.result,'lost');assert.equal(row.modelProb,.75);
});
test('unseen past snapshots are not retroactively invented, while catalogued finished results are recovered',async()=>{
 const {updateEvidenceHistory}=await import('../scripts/evidence-history.mjs'),map=new Map(),blobs={get:async k=>map.get(k),put:async(k,v)=>map.set(k,v)},stale=future('stale-history');stale.kickoff=now-5*DAY;const report=buildEvidenceReport(history(),[stale],now),catalog={fixtures:{}},store={games:{},projections:{}};
 await updateEvidenceHistory({catalog,report,store,blobs,now});assert.equal(map.size,0);
 const tracked=future('tracked-stale'),trackedReport=buildEvidenceReport(history(),[tracked],now),trackedMap=new Map(),trackedBlobs={get:async k=>trackedMap.get(k),put:async(k,v)=>trackedMap.set(k,v)},trackedCatalog={fixtures:{}};
 await updateEvidenceHistory({catalog:trackedCatalog,report:trackedReport,store,blobs:trackedBlobs,now});await updateEvidenceHistory({catalog:trackedCatalog,report:trackedReport,store,blobs:trackedBlobs,now:tracked.kickoff+5*60*60*1000});let rows=Object.values(parseGzip(trackedMap.get([...trackedMap.keys()][0])).rows);assert.equal(rows.length,1);assert.equal(rows[0].state,'unresolved');assert.equal(rows[0].result,'ungraded');
 const completed=compactEvidence(snap('finished-unseen','won')),finishedCatalog={fixtures:{[completed.fixtureId]:completed}},finishedMap=new Map(),finishedBlobs={get:async k=>finishedMap.get(k),put:async(k,v)=>finishedMap.set(k,v)};
 await updateEvidenceHistory({catalog:finishedCatalog,report:buildEvidenceReport(history(),[],now),store,blobs:finishedBlobs,now});rows=Object.values(parseGzip(finishedMap.get([...finishedMap.keys()][0])).rows);assert.equal(rows.length,1);assert.equal(rows[0].state,'finished');assert.equal(rows[0].result,'won');assert.deepEqual(rows[0].score,{home:3,away:0});
});
