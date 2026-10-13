import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDay, matchesFixture } from '../src/lib/fixture-filters.js';
const fixture={id:'game-1',sport:'football',home:'Torino',away:'Udinese',league:'Serie A',kickoff:'2026-10-12T23:30:00Z',status:{state:'live'},priced:true};
const base={search:'',sport:'all',competition:'all',status:'all',from:'',to:'',coverage:'all',projectedIds:new Set(['game-1'])};
test('date range uses Lagos midnight instead of UTC or browser local dates',()=>{assert.equal(fixtureDay(fixture.kickoff),'2026-10-13');assert.equal(matchesFixture(fixture,{...base,from:'2026-10-13',to:'2026-10-13'}),true);assert.equal(matchesFixture(fixture,{...base,to:'2026-10-12'}),false);});
test('combined search, sport, competition, status and coverage filter provider fixtures',()=>{assert.equal(matchesFixture(fixture,{...base,search:' UDINESE ',sport:'football',competition:'Serie A',status:'live',coverage:'projected'}),true);for(const filters of [{sport:'nba'},{status:'finished'},{competition:'La Liga'},{search:'Arsenal'},{coverage:'projected',projectedIds:new Set()}])assert.equal(matchesFixture(fixture,{...base,...filters}),false);assert.equal(matchesFixture({...fixture,priced:false},{...base,coverage:'priced'}),false);});
