/** Evidence-only prose. No language model can add facts or probability boosts. */
/** @param {any} fixture @param {string} generatedAt */
export function explainFacts(fixture,generatedAt,/** @type {any} */ prediction=undefined) {
 const evidence=fixture.analysisEvidence;
 const source=fixture.ratingsSource??'No independent model inputs supplied';
 const quotes=Object.keys(fixture.odds??{}).length;
 const choices=prediction?.markets?.flatMap((/** @type {any} */g)=>g.selections).filter((/** @type {any} */s)=>s.opportunity?.green).sort((/** @type {any} */a,/** @type {any} */b)=>a.opportunity.rank-b.opportunity.rank).slice(0,3)??[];
 const comparison=choices.length?`Market comparison: ${choices.map((/** @type {any} */s)=>`${s.selection} — projection ${s.projectionGrade}, estimated outright probability ${(100*s.modelProb*(1-(s.pushProb??0))).toFixed(1)}%, ${s.pricing==='quoted'?`observed price ${s.bestOdds.toFixed(2)} at ${s.bookmaker}`:`estimated fair price ${s.fairOdds.toFixed(2)}; bookmaker quote unavailable`}`).join('; ')}. These are ranked by supported estimated value, otherwise outcome likelihood. Related choices are correlated. `:'No pre-match projection lean is available for this fixture. ';
 return `${fixture.homeTeam??fixture.home??'Home'} vs ${fixture.awayTeam??fixture.away??'Away'} (${fixture.league??'competition unknown'}). Feed timestamp: ${generatedAt}. Strength basis: ${source}. ${quotes} bookmaker price sets supplied. ${comparison}${evidence?.approved?'A validated segment is recorded.':'Market validation is pending; projections do not establish a profitable betting advantage and no automatic stake is recommended.'} Verified injuries, lineups, weather and historical price movement are unavailable unless separately supplied.`;
}
