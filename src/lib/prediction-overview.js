/** Highest available model selection in each displayed market, preserving identity and prices.
 * @param {any[]} groups */
export function predictionOverview(groups){return groups.flatMap(g=>{const rows=(g.selections??[]).filter((/** @type {any} */s)=>Number.isFinite(s.modelProb)&&s.modelProb>=0&&s.modelProb<=1);if(!rows.length)return [];const best=[...rows].sort((a,b)=>b.modelProb-a.modelProb||String(a.id).localeCompare(String(b.id)))[0];return [{key:g.key,title:g.title,emoji:g.emoji??'📊',selection:best,count:rows.length}];});}
