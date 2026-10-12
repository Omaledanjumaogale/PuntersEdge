/**
 * QuantEdge Enterprise Prediction Platform
 * Master Orchestrator: Multi-Bookmaker Ingestion, Quantitative Modeling & AI Agents
 */

import { UnifiedSportsFetcher } from './data_fetcher.js';
import { compareBookmakerOdds, calculateAccumulatorEconomics } from './bookmaker_engine.js';
import { QuantEdgeAIAgentHub } from './ai_agent_orchestrator.js';

async function runEnterprisePipeline() {
  console.log('========================================================================');
  console.log(' QUANTEDGE MULTI-BOOKMAKER & AI MULTI-AGENT SPORTS ENGINE (ENTERPRISE)  ');
  console.log('========================================================================\n');

  const fetcher = new UnifiedSportsFetcher();
  const aiHub = new QuantEdgeAIAgentHub();

  // 1. Ingestion: Fetch live fixture & multi-bookmaker market
  console.log('[STEP 1: INGESTING LIVE FEEDS FROM SPORTYBET, 1XBET, 22BET & 24LIVE]...');
  const matchEntity = await fetcher.getLiveFeedSnapshot('football');
  console.log(`- Fixture Ingested: ${matchEntity.homeTeam.name} vs ${matchEntity.awayTeam.name}`);
  console.log(`- Competition: ${matchEntity.tournament}`);
  console.log(`- Kickoff UTC: ${matchEntity.startTimeUtc}`);
  console.log(`- Confirmed Lineups: ${matchEntity.lineups.homeMissing.length} home absences detected from RedScores\n`);

  // 2. Multi-Bookmaker Discrepancy & Arbitrage Screener
  console.log('[STEP 2: CROSS-BOOKMAKER PRICING & DISCREPANCY AUDIT]...');
  const bookmakerComparison = compareBookmakerOdds([
    { bookmaker: 'SportyBet', odds: matchEntity.oddsMarket.sportyBet },
    { bookmaker: '1xBet', odds: matchEntity.oddsMarket.oneXBet },
    { bookmaker: '22Bet', odds: matchEntity.oddsMarket.twentyTwoBet }
  ]);

  console.log('Individual Bookmaker Margins:');
  bookmakerComparison.bookmakers.forEach(b => {
    console.log(`  • ${b.bookmaker.padEnd(12)}: 1X2 [${b.odds.home.toFixed(2)} / ${b.odds.draw.toFixed(2)} / ${b.odds.away.toFixed(2)}] (Margin: ${b.marginPercent}%)`);
  });

  const best = bookmakerComparison.bestMarketConsensus;
  console.log(`- Best Market Consensus: Home ${best.bestHome.odds} (${best.bestHome.bookmaker}) | Draw ${best.bestDraw.odds} (${best.bestDraw.bookmaker}) | Away ${best.bestAway.odds} (${best.bestAway.bookmaker})`);
  console.log(`- Arbitrage Overround: ${best.arbOverround} -> ${best.isArbitrage ? `ARBITRAGE FOUND (+${best.profitMarginPercent}% guaranteed)` : 'No cross-market arbitrage (Efficient Market)'}\n`);

  // 3. SportyBet Accumulator / FlexiBet Margin Decay Analysis
  console.log('[STEP 3: ACCUMULATOR ECONOMICS & COMPOUND RISK AUDIT]...');
  const sampleAcca = calculateAccumulatorEconomics([1.78, 1.45, 1.60, 1.90]);
  console.log(`- 4-Leg Accumulator: Combined Odds ${sampleAcca.combinedGrossOdds} | Compound Bookmaker Edge: ${sampleAcca.compoundMarginRiskPct}%`);
  console.log(`- Punter Assessment: ${sampleAcca.puntersWarning}\n`);

  // 4. In-App AI Multi-Agent Orchestration & Decision
  console.log('[STEP 4: RUNNING IN-APP AI MULTI-AGENT REASONING HUB]...');
  const aiResult = await aiHub.synthesizeMatchPrediction(matchEntity);

  console.log(`\n--- Agent 1 (Market Intelligence):`);
  console.log(`  Verdict: ${aiResult.aiAgentOrchestration.agent1_Market.verdict}`);
  console.log(`  Detail:  ${aiResult.aiAgentOrchestration.agent1_Market.analysisSummary}`);

  console.log(`\n--- Agent 2 (Squad & Tactical Context):`);
  console.log(`  Detail:  ${aiResult.aiAgentOrchestration.agent2_Squad.tacticalReport}`);

  console.log(`\n--- Agent 3 (Quantitative Modeling Core):`);
  console.log(`  Adjusted Goals: Home ${aiResult.aiAgentOrchestration.agent3_Math.adjustedGoals.lambdaHome} vs Away ${aiResult.aiAgentOrchestration.agent3_Math.adjustedGoals.muAway}`);
  console.log(`  Predicted Scoreline Rankings:`);
  aiResult.aiAgentOrchestration.agent3_Math.topPredictedScores.forEach((s, idx) => {
    console.log(`    ${idx + 1}. ${s.home} - ${s.away} (${(s.prob * 100).toFixed(1)}% prob)`);
  });

  console.log('\n--- Comprehensive Market Options Probabilities ---');
  console.log(`  • 1X2:               Home: ${aiResult.comprehensiveMarketProbabilities.oneXTwo.home} | Draw: ${aiResult.comprehensiveMarketProbabilities.oneXTwo.draw} | Away: ${aiResult.comprehensiveMarketProbabilities.oneXTwo.away}`);
  console.log(`  • Double Chance:     1X: ${aiResult.comprehensiveMarketProbabilities.doubleChance['1X']} | 12: ${aiResult.comprehensiveMarketProbabilities.doubleChance['12']} | X2: ${aiResult.comprehensiveMarketProbabilities.doubleChance['X2']}`);
  console.log(`  • Draw No Bet (DNB): Home: ${aiResult.comprehensiveMarketProbabilities.drawNoBet.home} | Away: ${aiResult.comprehensiveMarketProbabilities.drawNoBet.away}`);
  console.log(`  • Over/Under Goals:  Over 1.5: ${aiResult.comprehensiveMarketProbabilities.overUnderGoals.over1_5} | Over 2.5: ${aiResult.comprehensiveMarketProbabilities.overUnderGoals.over2_5} | Under 2.5: ${aiResult.comprehensiveMarketProbabilities.overUnderGoals.under2_5}`);
  console.log(`  • BTTS (Both Score): Yes: ${aiResult.comprehensiveMarketProbabilities.bothTeamsToScore.yes} | No: ${aiResult.comprehensiveMarketProbabilities.bothTeamsToScore.no}`);

  console.log('\n========================================================================');
  console.log('>>> [MASTER AI AGENT STRATEGIC RECOMMENDATION] <<<');
  console.log('========================================================================');
  console.log(`Target Market Option:   ${aiResult.primaryRecommendation.recommendedMarket}`);
  console.log(`Recommended Bookmaker:  ${aiResult.primaryRecommendation.targetBookmaker}`);
  console.log(`Quoted Market Odds:     ${aiResult.primaryRecommendation.quotedOdds}`);
  console.log(`Mathematical Edge:      ${aiResult.primaryRecommendation.mathematicalEdge}`);
  console.log(`Confidence Grade:       ${aiResult.primaryRecommendation.confidenceRating}`);
  console.log(`Fractional Kelly Stake: ${aiResult.primaryRecommendation.suggestedStakePct}`);
  console.log(`\nOperational Reasoning:\n"${aiResult.primaryRecommendation.plainEnglishRationale}"`);
  console.log('========================================================================\n');
}

runEnterprisePipeline().catch(console.error);
