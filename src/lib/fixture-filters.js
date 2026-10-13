/** Fixture dates use the application's Lagos calendar, independent of device timezone. */
/** @param {string} kickoff */
export function fixtureDay(kickoff) {
 const time = Date.parse(kickoff);
 return Number.isFinite(time) ? new Date(time + 3_600_000).toISOString().slice(0, 10) : '';
}
/** @param {{kickoff:string; league:string; sport:string; match?:string; home?:string; away?:string; state?:string; status?:{state:string}; fixtureId?:string; id?:string; priced?:boolean}} fixture
 * @param {{search:string; sport:string; competition:string; status:string; from:string; to:string; coverage:string; projectedIds:Set<string>}} filters */
export function matchesFixture(fixture, filters) {
 const query = filters.search.trim().toLocaleLowerCase();
 const title = fixture.match ?? `${fixture.home ?? ''} ${fixture.away ?? ''}`;
 const day = fixtureDay(fixture.kickoff);
 return (!query || `${title} ${fixture.league} ${fixture.sport}`.toLocaleLowerCase().includes(query))
  && (filters.sport === 'all' || fixture.sport === filters.sport)
  && (filters.competition === 'all' || fixture.league === filters.competition)
  && (filters.status === 'all' || (fixture.state ?? fixture.status?.state) === filters.status)
  && (!filters.from || day >= filters.from)
  && (!filters.to || day <= filters.to)
  && (filters.coverage === 'all' || (filters.coverage === 'projected' ? filters.projectedIds.has(fixture.fixtureId ?? fixture.id ?? '') : !!fixture.priced));
}
