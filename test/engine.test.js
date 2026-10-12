import { test } from 'node:test';
import assert from 'node:assert';
import { removeVigMultiplicative, removeVigPower, calculateOverround } from '../src/lib/engine/vig_removal.js';
import { generateScoreMatrix, solveGoalParametersFromMarket } from '../src/lib/engine/football_model.js';
import { projectBasketballGame } from '../src/lib/engine/basketball_model.js';
import { adjustParametersForLineups } from '../src/lib/engine/lineup_impact.js';
import { calculateExpectedValue, calculateKellyStake, analyzeOddsMovement } from '../src/lib/engine/decision_screener.js';
import { deriveDoubleChance, deriveDrawNoBet, compareBookmakerOdds, calculateAccumulatorEconomics } from '../src/lib/engine/bookmaker_engine.js';
import { UnifiedSportsFetcher } from '../src/lib/engine/data_fetcher.js';
import { QuantEdgeAIAgentHub } from '../src/lib/engine/ai_agent_orchestrator.js';

test('Vig Removal - calculates overround and fair probabilities properly', () => {
  const odds = { home: 2.00, draw: 3.40, away: 3.80 };
  const fair = removeVigMultiplicative(odds);

  assert.ok(fair.overround > 1.0, 'Overround should exceed 1.0 due to bookie margin');
  assert.ok(fair.home + fair.draw + fair.away > 0.999 && fair.home + fair.draw + fair.away < 1.001, 'Fair probabilities must sum to 1.0');
});

test('Football Modeling - Dixon Coles matrix sums to 1.0 and generates probabilities', () => {
  const res = generateScoreMatrix(1.6, 1.1);

  assert.ok(res.expectedTotalGoals === 2.7, 'Expected goals sum must equal lambda + mu');
  const sum1X2 = res.probabilities.oneXTwo.home + res.probabilities.oneXTwo.draw + res.probabilities.oneXTwo.away;
  assert.ok(Math.abs(sum1X2 - 1.0) < 0.05, '1X2 probabilities should sum to approximately 1.0');

  assert.ok(res.probabilities.overUnder[2.5].over > 0, 'Over 2.5 probability should be positive');
  assert.ok(res.probabilities.overUnder[2.5].under > 0, 'Under 2.5 probability should be positive');
});

test('Lineup Impact - degrades attack and increases opponent goals when key defenders miss', () => {
  const baseline = { lambdaHome: 2.0, muAway: 1.0 };
  const absences = [{ name: 'Key Defender', position: 'DEF', impactRating: 0.10, minutesWeight: 1.0 }];

  const res = adjustParametersForLineups(baseline, absences, []);
  assert.ok(res.adjusted.muAway > baseline.muAway, 'Opponent expected goals should increase when home defender is missing');
});

test('Basketball Modeling - computes tempo-free pace and total points within physical boundaries', () => {
  const home = { pace: 100, offRtg: 115, defRtg: 110 };
  const away = { pace: 100, offRtg: 112, defRtg: 112 };

  const sim = projectBasketballGame(home, away, { pace: 100, offRtg: 114 }, { simulations: 5000 });
  assert.ok(sim.projectedScore.total > 200 && sim.projectedScore.total < 250, 'Total projected points should be within standard NBA bounds');
  assert.ok(sim.winProbabilities.home > 0.5, 'Home team with higher net rating and HCA should have >50% win probability');
});

test('Decision Screener - Kelly criterion and EV logic', () => {
  const evPositive = calculateExpectedValue(0.55, 2.00);
  assert.strictEqual(evPositive.isPositiveEV, true);
  assert.ok(evPositive.edgePercent > 9.9, 'Edge should be 10%');

  const stake = calculateKellyStake(0.55, 2.00, 0.25);
  assert.ok(stake.recommendedStakePct > 0, 'Should recommend a positive stake');

  const rlm = analyzeOddsMovement(2.10, 1.85, 30);
  assert.strictEqual(rlm.smartMoneyIndication, true, 'Sharp volume should be detected when low public action coincides with shortened odds');
});

test('Bookmaker Engine - Double Chance and Draw No Bet derivations', () => {
  const trueProb = { home: 0.50, draw: 0.30, away: 0.20 };
  const dc = deriveDoubleChance(trueProb);

  assert.strictEqual(dc['1X'].prob, 0.80);
  assert.strictEqual(dc['12'].prob, 0.70);
  assert.strictEqual(dc['X2'].prob, 0.50);

  const dnb = deriveDrawNoBet(trueProb);
  assert.ok(Math.abs(dnb.homeDNB.prob - (0.50 / 0.70)) < 1e-4);
});

test('Bookmaker Engine - Compares SportyBet, 1xBet, 22Bet and checks arbitrage', () => {
  const books = [
    { bookmaker: 'SportyBet', odds: { home: 1.80, draw: 3.60, away: 4.50 } },
    { bookmaker: '1xBet', odds: { home: 1.85, draw: 3.50, away: 4.40 } },
    { bookmaker: '22Bet', odds: { home: 1.82, draw: 3.55, away: 4.60 } }
  ];

  const comparison = compareBookmakerOdds(books);
  assert.strictEqual(comparison.bestMarketConsensus.bestHome.odds, 1.85);
  assert.strictEqual(comparison.bestMarketConsensus.bestAway.odds, 4.60);
  assert.strictEqual(comparison.bookmakers.length, 3);
});

test('Accumulator Economics - correctly compounds risk for multiple legs', () => {
  const acca = calculateAccumulatorEconomics([1.50, 2.00, 1.80, 2.20]);
  assert.strictEqual(acca.legCount, 4);
  assert.ok(acca.compoundMarginRiskPct > 15, 'Compound bookmaker margin should exceed 15% on 4 legs');
});

test('AI Agent Hub - synthesizes match prediction and market options', async () => {
  const fetcher = new UnifiedSportsFetcher();
  const match = await fetcher.getLiveFeedSnapshot('football');
  const aiHub = new QuantEdgeAIAgentHub();

  const report = await aiHub.synthesizeMatchPrediction(match);
  assert.ok(report.matchOverview.fixture.includes('Arsenal'));
  assert.ok(report.primaryRecommendation.quotedOdds > 1.0);
  assert.ok(report.comprehensiveMarketProbabilities.oneXTwo.home);
  assert.ok(report.comprehensiveMarketProbabilities.doubleChance['1X']);
});
