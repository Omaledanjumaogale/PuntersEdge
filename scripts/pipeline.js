/**
 * PuntersEdge CLI — runs the full prediction pipeline over the sample feed and
 * prints each fixture's agent analysis. `npm run pipeline`
 */

import { FOOTBALL_INPUTS, BASKETBALL_INPUTS } from '../src/lib/data/fixtures.js';
import { buildFootballPrediction, buildBasketballPrediction } from '../src/lib/engine/prediction_pipeline.js';
import { compareBookmakerOdds, evaluateAccumulator } from '../src/lib/engine/bookmaker_engine.js';
import { PuntersEdgeAIAgentHub } from '../src/lib/engine/ai_agent_orchestrator.js';

const hub = new PuntersEdgeAIAgentHub();
const line = '─'.repeat(72);
const pct = (/** @type {number} */ p) => `${(p * 100).toFixed(1)}%`;

const predictions = [
  ...FOOTBALL_INPUTS.map((i) => buildFootballPrediction(i)),
  ...BASKETBALL_INPUTS.map((i) => buildBasketballPrediction(i))
];

console.log(`\nQUANTEDGE PIPELINE · ${predictions.length} fixtures\n${line}`);

for (const p of predictions) {
  const a = hub.analyze(p);
  console.log(`\n${p.sport === 'football' ? '⚽' : '🏀'}  ${p.matchTitle}  ·  ${p.league}`);
  if (p.sport === 'football') {
    const cmp = compareBookmakerOdds(Object.entries(p.odds).map(([bookmaker, o]) => ({ bookmaker, odds: { home: o.home, draw: o.draw, away: o.away } })));
    console.log(`   1X2 ${pct(p.probabilities.homeWin)} / ${pct(p.probabilities.draw)} / ${pct(p.probabilities.awayWin)}   arb overround ${cmp.bestMarketConsensus.arbOverround}`);
  } else {
    console.log(`   Projected ${p.projectedScore.home}–${p.projectedScore.away}  total ${p.projectedScore.total} vs line ${p.marketLines.total}`);
  }
  for (const g of a.agents) console.log(`   · ${g.agent.padEnd(20)} ${g.headline}`);
  const r = a.recommendation;
  console.log(`   ⇒ ${r.action} ${r.action === 'BET' ? `${r.selection} @ ${r.odds} (${r.bookmaker})  edge +${r.edgePercent}%  stake ${r.stakePercent}%  [${r.grade}]` : ''}`);
}

const legs = predictions
  .map((p) => p.bestValue)
  .filter((v) => v && v.edgePercent > 0)
  .slice(0, 3)
  .map((v) => ({ odds: v.bestOdds, modelProb: v.modelProb }));
const acc = evaluateAccumulator(legs);
console.log(`\n${line}\nTop-3 value treble: odds ${acc.combinedOdds}, win prob ${pct(acc.combinedProb)}, EV ${acc.evPercent}%\n`);
