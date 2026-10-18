import { settle, profitFor } from '../engine/settlement.js';
import {settlePeriod} from '../engine/period_settlement.js';

export const MODEL_VERSION = '2026.10.evidence-gated.3';
export const REVIEW_MS = 12 * 3600000;

/** Freeze only analysis that can actually be published before kickoff. @param {any} game @param {any} input @param {any} prediction @param {number} now */
export function snapshotOf(game, input, prediction, now) {
 const selections = (prediction.markets ?? []).flatMap((/** @type {any} */ market) => market.selections).map((/** @type {any} */ s) => ({
  key: s.id.slice(game.uid.length + 1), market: s.market, selection: s.selection, bookmaker: s.bookmaker,
  opportunity:s.opportunity??null,scope:s.scope??'full',modelVersion:s.modelVersion??input.analysisEvidence?.modelVersion??MODEL_VERSION,settlementProbabilities:s.settlementProbabilities??null,
  odds: s.bestOdds, modelProb: s.modelProb, marketProb: s.marketProb, pushProb:s.pushProb??0,winProb:s.settlementProbabilities?.win??s.modelProb*(1-(s.pushProb??0)),lossProb:s.settlementProbabilities?.lose??(1-s.modelProb)*(1-(s.pushProb??0)),quoteObservedAt:s.quoteObservedAt??null,eligibilityReasons:s.eligibilityReasons??[],edge: s.edgePercent, grade: s.grade, pricing: s.pricing ?? 'derived', verdict: s.id === prediction.bestValue?.id && prediction.bestValue?.eligible === true && s.grade !== 'PASS'
 }));
 return {fixtureId:game.uid,sport:game.sport,family:prediction.family,match:`${game.home} vs ${game.away}`,league:game.league,...(game.country?{country:game.country}:{}),...(game.tournament?{tournament:game.tournament}:{}),kickoff:game.kickoff,publishedAt:now,modelVersion:MODEL_VERSION,artifactVersion:input.analysisEvidence?.modelVersion??null,state:'scheduled',input:structuredClone(input),forecast:{probabilities:prediction.probabilities,modelProbabilities:prediction.modelProbabilities,marketProbabilities:prediction.marketProbabilities,projectedScore:prediction.projectedScore,expectedGoals:prediction.expectedGoals,topScorelines:prediction.topScorelines,marketLines:prediction.marketLines},selections};
}

/** @param {any} snapshot @param {any} game @param {number} now */
export function settleSnapshot(snapshot, game, now) {
 const state = game.status.state;
 snapshot.state = state;
 if(state !== 'finished' || !Number.isFinite(game.status.home) || !Number.isFinite(game.status.away)) return;
 snapshot.finishedAt ??= now;
 snapshot.score = {home:game.status.home,away:game.status.away,...(game.status.regHome !== undefined ? {regHome:game.status.regHome} : {}),...(game.status.regAway !== undefined ? {regAway:game.status.regAway} : {})};
 snapshot.periodScores=structuredClone(game.status.periodScores??{});
 for(const s of snapshot.selections) {
  s.result = (s.key.startsWith('forecast:full:')?settlePeriod(s.key.replace('forecast:','period:'),{full:snapshot.family==='football'?{home:snapshot.score.regHome??snapshot.score.home,away:snapshot.score.regAway??snapshot.score.away}:snapshot.score}):s.key.startsWith('period:')?settlePeriod(s.key,snapshot.periodScores):settle(snapshot.family,s.key,snapshot.score)) ?? 'ungraded';
  s.profit = s.result === 'ungraded' ? null : profitFor(s.result,s.odds);
 }
}

export function emptyCounters() { return {n:0,won:0,lost:0,push:0,half:0,binary:0,modelTotal:0,marketTotal:0,brierTotal:0,marketBrierTotal:0,categoricalN:0,categoricalBrierTotal:0,quotedN:0,profit:0}; }
/** @param {any} row */
export function countersFor(row) {
 const c=emptyCounters(); if(!['won','lost','push','half-won','half-lost'].includes(row.result))return c;
 c.n=1;c.won=row.result==='won'?1:0;c.lost=row.result==='lost'?1:0;c.push=row.result==='push'?1:0;c.half=row.result.startsWith('half-')?1:0;
 if(row.settlementProbabilities){const states={won: 'win','half-won':'halfWin',push:'push','half-lost':'halfLose',lost:'lose'};c.categoricalN=1;c.categoricalBrierTotal=Object.entries(row.settlementProbabilities).filter(([key])=>key!=='fairOdds').reduce((sum,[key,p])=>sum+(Number(p)-Number(key===states[/** @type {keyof typeof states} */(row.result)]))**2,0);}
 if(!row.settlementProbabilities && c.won+c.lost){c.binary=1;c.modelTotal=row.modelProb;c.marketTotal=row.marketProb;c.brierTotal=(row.modelProb-c.won)**2;c.marketBrierTotal=(row.marketProb-c.won)**2;}
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
  if(row.modelVersion??snapshot.artifactVersion)keys.push(`artifacts:${encodeURIComponent(row.modelVersion??snapshot.artifactVersion)}`);
  keys.push(`scopes:${row.scope??'full'}`);
  for(const key of keys)addCounters(groups[key]??=emptyCounters(),c);
 }
 return groups;
}
/** @param {any} c */
export function statsOf(c=emptyCounters()) {
 const n=c.won+c.lost,rate=n?c.won/n:0,z=1.96,den=1+z*z/(n||1),center=n?(rate+z*z/(2*n))/den:null,spread=n?z*Math.sqrt(rate*(1-rate)/n+z*z/(4*n*n))/den:0;
 return {categoricalN:c.categoricalN??0,categoricalBrier:c.categoricalN?c.categoricalBrierTotal/c.categoricalN:null,n:c.n,won:c.won,lost:c.lost,push:c.push,half:c.half,strikeRate:n?rate*100:null,roi:c.quotedN?100*c.profit/c.quotedN:null,brier:c.binary?c.brierTotal/c.binary:null,marketBrier:c.binary?c.marketBrierTotal/c.binary:null,modelMean:c.binary?100*c.modelTotal/c.binary:null,marketMean:c.binary?100*c.marketTotal/c.binary:null,quotedN:c.quotedN,binary:c.binary,confidenceLow:center===null?null:100*(center-spread),confidenceHigh:center===null?null:100*(center+spread)};
}
