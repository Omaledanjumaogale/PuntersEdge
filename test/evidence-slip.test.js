import test from 'node:test';import assert from 'node:assert/strict';import {evidenceSlipPick} from '../src/lib/evidence-slip.js';
test('evidence slip keeps original model and recurrence, allows unpriced picks, blocks started fixtures and stale quote reuse',()=>{
 const now=Date.now(),row={fixtureId:'f',key:'o2.5',id:'f:o2.5',sport:'football',matchTitle:'Home vs Away',selection:'Over 2.5',modelProb:.75,kickoff:now+60000,publishedAt:now-10000,pricing:'quoted',odds:2,cohort:{won:32,binaryN:40,strikeRate:.8,interval:{low:.65}}},game={kickoff:new Date(row.kickoff).toISOString(),status:{state:'scheduled'}};
 const pick=evidenceSlipPick(row,game,{pricing:'quoted',bestOdds:1.8},[],now);assert.equal(pick.bestOdds,0);assert.equal(pick.modelProb,.75);assert.match(pick.evidence.basis,/32\/40/);assert.equal(pick.evidence.verdict,false);assert.equal(evidenceSlipPick(row,{...game,status:{state:'live'}},null,[],now),null);assert.equal(evidenceSlipPick(row,game,null,[],row.kickoff+1),null);
 const quoted=evidenceSlipPick(row,game,{pricing:'quoted',bestOdds:2,marketProb:.5,bookmaker:'Book'},[],now);assert.equal(quoted.bestOdds,2);assert.equal(quoted.bookmaker,'Book');
});
