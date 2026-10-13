import { settle, profitFor } from '../engine/settlement.js';

export const MODEL_VERSION = '2026.10.probability-verdict.2';
export const REVIEW_MS = 12 * 3600000;

/** Freeze only analysis that can actually be published before kickoff. @param {any} game @param {any} input @param {any} prediction @param {number} now */
export function snapshotOf(game, input, prediction, now) {
 const selections = (prediction.markets ?? []).flatMap((/** @type {any} */ market) => market.selections).map((/** @type {any} */ s) => ({
  key: s.id.slice(game.uid.length + 1), market: s.market, selection: s.selection, bookmaker: s.bookmaker,
  odds: s.bestOdds, modelProb: s.modelProb, marketProb: s.marketProb, edge: s.edgePercent, grade: s.grade, pricing: s.pricing ?? 'derived', verdict: s.id === prediction.bestValue?.id && prediction.bestValue?.eligible === true && s.grade !== 'PASS'
 }));
 return {fixtureId:game.uid,sport:game.sport,family:prediction.family,match:`${game.home} vs ${game.away}`,league:game.league,kickoff:game.kickoff,publishedAt:now,modelVersion:MODEL_VERSION,state:'scheduled',input:structuredClone(input),forecast:{probabilities:prediction.probabilities,modelProbabilities:prediction.modelProbabilities,marketProbabilities:prediction.marketProbabilities,projectedScore:prediction.projectedScore,expectedGoals:prediction.expectedGoals,topScorelines:prediction.topScorelines,marketLines:prediction.marketLines},selections};
}

/** @param {any} snapshot @param {any} game @param {number} now */
export function settleSnapshot(snapshot, game, now) {
 const state = game.status.state;
 snapshot.state = state;
 if(state !== 'finished' || !Number.isFinite(game.status.home) || !Number.isFinite(game.status.away)) return;
 snapshot.finishedAt ??= now;
 snapshot.score = {home:game.status.home,away:game.status.away,...(game.status.regHome !== undefined ? {regHome:game.status.regHome} : {}),...(game.status.regAway !== undefined ? {regAway:game.status.regAway} : {})};
 for(const s of snapshot.selections) {
  s.result = settle(snapshot.family,s.key,snapshot.score) ?? 'ungraded';
  s.profit = s.result === 'ungraded' ? null : profitFor(s.result,s.odds);
 }
}

export function emptyCounters() { return {n:0,won:0,lost:0,push:0,half:0,binary:0,modelTotal:0,marketTotal:0,brierTotal:0,marketBrierTotal:0,quotedN:0,profit:0}; }
/** @param {any} row */
export function countersFor(row) {
 const c=emptyCounters(); if(!['won','lost','push','half-won','half-lost'].includes(row.result))return c;
 c.n=1;c.won=row.result==='won'?1:0;c.lost=row.result==='lost'?1:0;c.push=row.result==='push'?1:0;c.half=row.result.startsWith('half-')?1:0;
 if(c.won+c.lost){c.binary=1;c.modelTotal=row.modelProb;c.marketTotal=row.marketProb;c.brierTotal=(row.modelProb-c.won)**2;c.marketBrierTotal=(row.marketProb-c.won)**2;}
 if(row.pricing==='quoted'){c.quotedN=1;c.profit=row.profit??0;}
 return c;
}
/** @param {any} target @param {any} source @param {number} [sign] */
export function addCounters(target, source, sign=1) {for(const key of Object.keys(emptyCounters()))target[key]=(target[key]??0)+sign*(source[key]??0);return target;}
/** @param {any} snapshot */
export function contributionsFor(snapshot) {
 /** @type {Record<string, any>} */ const groups={};
 for(const row of snapshot.selections){
  const c=countersFor(row);if(!c.n)continue;
  const lower=Math.min(90,Math.floor(row.modelProb*10)*10);
  const keys=['summary',`versions:${encodeURIComponent(snapshot.modelVersion??'unversioned')}`,`grades:${row.grade}`,`markets:${encodeURIComponent(row.market)}`,`bands:${lower}-${lower+10}%`,`days:${new Date((snapshot.finishedAt??snapshot.kickoff)+3600000).toISOString().slice(0,10)}`,`pricing:${row.pricing}`];
  if(row.verdict)keys.push('verdict');
  for(const key of keys)addCounters(groups[key]??=emptyCounters(),c);
 }
 return groups;
}
/** @param {any} c */
export function statsOf(c=emptyCounters()) {
 const n=c.binary,rate=n?c.won/n:0,z=1.96,den=1+z*z/(n||1),center=n?(rate+z*z/(2*n))/den:null,spread=n?z*Math.sqrt(rate*(1-rate)/n+z*z/(4*n*n))/den:0;
 return {n:c.n,won:c.won,lost:c.lost,push:c.push,half:c.half,strikeRate:n?rate*100:null,roi:c.quotedN?100*c.profit/c.quotedN:null,brier:n?c.brierTotal/n:null,marketBrier:n?c.marketBrierTotal/n:null,modelMean:n?100*c.modelTotal/n:null,marketMean:n?100*c.marketTotal/n:null,quotedN:c.quotedN,binary:n,confidenceLow:center===null?null:100*(center-spread),confidenceHigh:center===null?null:100*(center+spread)};
}
