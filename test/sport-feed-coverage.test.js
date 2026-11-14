import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFeed} from '../src/lib/feeds/build.js';
import {emptyStore} from '../src/lib/feeds/store.js';
test('sport feed retains unprojected schedule, live and finals for 24 hours from observation',()=>{
 const now=Date.now(),s=emptyStore();
 for(const [uid,state,kickoff,updated] of [['next','scheduled',now+100000,now],['live','live',now-100000,now],['final','finished',now-3*86400000,now-23*3600000],['old','finished',now-3*86400000,now-25*3600000]])s.games[uid]={uid,sport:'football',league:'Test',home:'A',away:'B',kickoff,updated,ext:{},odds:{},status:{state,...(state==='finished'?{home:2,away:0}:{})}};
 const f=buildFeed(s,now,null);
 assert.deepEqual(f.games.map(g=>g.id),['final','live','next']);
 assert.equal(f.games[0].status.home,2);
 assert.equal(f.projections.length,0);
});
