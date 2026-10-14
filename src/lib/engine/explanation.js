/** Evidence-only prose. No language model can add facts or probability boosts. */
/** @param {any} fixture @param {string} generatedAt */
export function explainFacts(fixture,generatedAt) {
 const evidence=fixture.analysisEvidence;
 const source=fixture.ratingsSource??'No independent model inputs supplied';
 const quotes=Object.keys(fixture.odds??{}).length;
 return `${fixture.homeTeam??fixture.home??'Home'} vs ${fixture.awayTeam??fixture.away??'Away'} (${fixture.league??'competition unknown'}). Feed timestamp: ${generatedAt}. Strength basis: ${source}. ${quotes} bookmaker price sets supplied. ${evidence?.approved?'A validated segment is recorded.':'No approved calibrated model is recorded; estimates are for evaluation and do not establish a betting advantage.'} Verified injuries, lineups, weather and historical price movement are unavailable unless separately supplied. No probability, stake or winning claim is inferred from missing information.`;
}
