import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceBoard} from '../src/lib/evidence-board.js';
import {cohortKey,evidenceMarket} from '../src/lib/evidence-shortlist.js';
test('board ranks fixtures and market leaders while preserving exact cohort evidence',()=>{
 const now=1800000000000;
 const option=(key,modelProb)=>({...evidenceMarket(key,'football'),key,modelProb,artifact:'v',source:'test'});
 const fixture=(fixtureId,offset,rows)=>({fixtureId,sport:'football',version:'v',publishedAt:now-1000,kickoff:now+offset,state:'scheduled',rows});
 const a=fixture('early',1000,[option('home',.6)]), b=fixture('late',2000,[option('home',.75),option('away',.2),option('over25',.9)]);
 const cohort={binaryN:20,strikeRate:.8,interval:{low:.58}};
 const report={generatedAt:now,upcoming:[a,b,fixture('expired',-7200000,[option('home',.99)])],groups:{[cohortKey(b,b.rows[2])]:cohort}};
 const rows=evidenceBoard(report,new Map(),now);
 assert.deepEqual(rows.map(f=>f.fixtureId),['late','early']);
 assert.deepEqual(rows[0].options.map(o=>o.modelProb),[.9,.75]);
 assert.equal(rows[0].options[0].cohort,cohort);
 assert.equal(rows[0].options[1].cohort,null);
 assert.deepEqual(evidenceBoard(report,new Map(),now,'kickoff').map(f=>f.fixtureId),['early','late']);
 assert.deepEqual(evidenceBoard(report,new Map([['late',{status:{state:'finished'}}]]),now).map(f=>f.fixtureId),['early']);
});
