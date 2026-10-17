import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareTennisPublication} from '../scripts/tennis-publication.mjs';
test('tennis publications cannot backdate matches that started during training or upload',()=>{
 const now=2000000,source={at:now-600000,fixtures:[{id:'started',kickoff:now-1},{id:'soon',kickoff:now+60000},{id:'future',kickoff:now+3600000}]};
 const result=prepareTennisPublication(source,now);
 assert.equal(result.at,now);assert.equal(result.sourceCollectedAt,source.at);
 assert.deepEqual(result.fixtures,[{id:'future',kickoff:now+3600000,publishedAt:now}]);
 assert.equal(source.fixtures.length,3);
 assert.throws(()=>prepareTennisPublication({...source,at:now+1},now),/future dated/);
 assert.throws(()=>prepareTennisPublication({...source,at:now-86400001},now),/stale/);
});
