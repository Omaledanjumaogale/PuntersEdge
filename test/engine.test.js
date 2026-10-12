import { test } from 'node:test';
import assert from 'node:assert/strict';
import { removeVigMultiplicative, removeVigPower, removeVigShin, calculateOverround, fairShin } from '../src/lib/engine/vig_removal.js';
import { generateScoreMatrix, solveGoalParametersFromMarket, fitGoalParametersFromProbabilities, clampRho } from '../src/lib/engine/football_model.js';
import { projectBasketballGame, projectScores, probabilityHomeCovers, simulateGame, LEAGUE_PROFILES } from '../src/lib/engine/basketball_model.js';
import { adjustParametersForLineups, teamDegradation } from '../src/lib/engine/lineup_impact.js';
import { calculateExpectedValue, calculateKellyStake, analyzeOddsMovement, gradeSelection, calculateClosingLineValue } from '../src/lib/engine/decision_screener.js';
import { deriveDoubleChance, deriveDrawNoBet, compareBookmakerOdds, calculateAccumulatorEconomics, evaluateAccumulator, arbitrageStakes } from '../src/lib/engine/bookmaker_engine.js';
import { buildFootballPrediction, buildBasketballPrediction } from '../src/lib/engine/prediction_pipeline.js';
import { mulberry32, normalCdf, poissonPmf } from '../src/lib/engine/math.js';
import { UnifiedSportsFetcher } from '../src/lib/engine/data_fetcher.js';
import { QuantEdgeAIAgentHub } from '../src/lib/engine/ai_agent_orchestrator.js';
import { FOOTBALL_INPUTS, BASKETBALL_INPUTS } from '../src/lib/data/fixtures.js';

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// ── math ────────────────────────────────────────────────────────────────
test('math: seeded RNG is reproducible and uniform-ish', () => {
  const a = mulberry32(7), b = mulberry32(7);
  const xs = Array.from({ length: 5000 }, () => a());
  assert.deepEqual(xs.slice(0, 5), Array.from({ length: 5 }, () => b()));
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  assert.ok(Math.abs(mean - 0.5) < 0.02);
});

test('math: normal CDF and Poisson PMF are accurate', () => {
  assert.ok(close(normalCdf(0), 0.5, 1e-7));
  assert.ok(close(normalCdf(1.96), 0.975, 1e-3));
  const total = Array.from({ length: 60 }, (_, k) => poissonPmf(k, 2.7)).reduce((a, b) => a + b, 0);
  assert.ok(close(total, 1, 1e-9));
  assert.ok(Number.isFinite(poissonPmf(170, 3)), 'no factorial overflow');
});

// ── vig removal ─────────────────────────────────────────────────────────
test('vig: every method returns probabilities summing to 1', () => {
  const odds = { home: 2.0, draw: 3.4, away: 3.8 };
  for (const fn of [removeVigMultiplicative, removeVigPower, removeVigShin]) {
    const r = fn(odds);
    assert.ok(r.overround > 1);
    assert.ok(close(r.home + (r.draw ?? 0) + r.away, 1, 1e-6), fn.name);
  }
});

test('vig: Shin shifts probability from longshot to favourite vs proportional', () => {
  const odds = [1.25, 6.0, 12.0];
  const shin = fairShin(odds);
  const prop = odds.map((o) => 1 / o / calculateOverround(odds));
  assert.ok(shin[0] > prop[0], 'favourite gets more');
  assert.ok(shin[2] < prop[2], 'longshot gets less');
});

// ── football ────────────────────────────────────────────────────────────
test('football: matrix is normalised and markets are consistent', () => {
  const res = generateScoreMatrix(1.6, 1.1);
  const sum = res.matrix.flat().reduce((a, b) => a + b, 0);
  assert.ok(close(sum, 1, 1e-12));
  const { home, draw, away } = res.probabilities.oneXTwo;
  assert.ok(close(home + draw + away, 1, 1e-12));
  for (const line of [0.5, 1.5, 2.5, 3.5]) {
    const ou = res.probabilities.overUnder[line];
    assert.ok(close(ou.over + ou.under, 1, 1e-12));
  }
  assert.ok(close(res.probabilities.btts.yes + res.probabilities.btts.no, 1, 1e-12));
  // AH 0 = DNB: win / (win + lose) equals home / (home + away)
  const ah0 = res.probabilities.asianHandicap[0];
  assert.ok(close(ah0.win / (ah0.win + ah0.lose), home / (home + away), 1e-9));
  assert.ok(close(res.expectedTotalGoals, 2.7, 1e-12));
});

test('football: ρ is clamped so τ never goes negative', () => {
  const r = clampRho(-5, 1.5, 1.2);
  assert.ok(1 - 1.5 * 1.2 * r >= 0 && 1 + 1.5 * r >= 0 && 1 + 1.2 * r >= 0);
});

test('football: market parameter inversion and probability fitting', () => {
  const p = solveGoalParametersFromMarket(2.8, 0.6);
  assert.ok(close(p.lambdaHome, 1.7) && close(p.muAway, 1.1));
  const truth = generateScoreMatrix(1.75, 1.05, -0.05, 8).probabilities;
  const fit = fitGoalParametersFromProbabilities({ home: truth.oneXTwo.home, away: truth.oneXTwo.away, over2_5: truth.overUnder[2.5].over });
  assert.ok(Math.abs(fit.lambdaHome - 1.75) < 0.05, `λ ${fit.lambdaHome}`);
  assert.ok(Math.abs(fit.muAway - 1.05) < 0.05, `μ ${fit.muAway}`);
});

// ── lineups ─────────────────────────────────────────────────────────────
test('lineups: missing defender raises opponent goals; impacts compound', () => {
  const res = adjustParametersForLineups({ lambdaHome: 2, muAway: 1 }, [{ name: 'D', position: 'DEF', impactRating: 0.1 }], []);
  assert.ok(res.adjusted.muAway > 1);
  const many = Array.from({ length: 30 }, () => ({ name: 'x', position: /** @type {const} */ ('FWD'), impactRating: 0.2 }));
  assert.ok(teamDegradation(many).attack < 1, 'never removes more than 100%');
});

// ── basketball ──────────────────────────────────────────────────────────
test('basketball: projection is deterministic and within NBA bounds', () => {
  const home = { pace: 100, offRtg: 115, defRtg: 110 };
  const away = { pace: 100, offRtg: 112, defRtg: 112 };
  const a = projectBasketballGame(home, away, { pace: 100, offRtg: 114 });
  const b = projectBasketballGame(home, away, { pace: 100, offRtg: 114 });
  assert.deepEqual(a.winProbabilities, b.winProbabilities);
  assert.deepEqual(a.simulation.histogram, b.simulation.histogram);
  assert.ok(a.projectedScore.total > 200 && a.projectedScore.total < 250);
  assert.ok(a.winProbabilities.home > 0.5);
});

test('basketball: Monte Carlo agrees with analytic win probability', () => {
  const proj = projectScores({ pace: 99, offRtg: 118, defRtg: 111 }, { pace: 98, offRtg: 113, defRtg: 113 }, LEAGUE_PROFILES.NBA);
  const analytic = probabilityHomeCovers(proj, 0);
  const mc = simulateGame(proj, { simulations: 40000, seed: 1 });
  assert.ok(Math.abs(mc.homeWinRate - analytic) < 0.01, `${mc.homeWinRate} vs ${analytic}`);
  const hist = mc.histogram.reduce((a, b) => a + b.share, 0);
  assert.ok(close(hist, 1, 1e-9));
});

// ── decision layer ──────────────────────────────────────────────────────
test('decision: EV, Kelly, grading and CLV', () => {
  const ev = calculateExpectedValue(0.55, 2.0);
  assert.equal(ev.isPositiveEV, true);
  assert.ok(close(ev.edgePercent, 10, 1e-9));
  const k = calculateKellyStake(0.55, 2.0, 0.25);
  assert.ok(k.recommendedStakePct > 0 && k.recommendedStakePct <= 3.5);
  assert.equal(calculateKellyStake(0.4, 2.0).action, 'PASS');
  assert.equal(gradeSelection(7), 'A+');
  assert.equal(gradeSelection(7, 25), 'C', 'large model–market gaps are discounted');
  assert.equal(gradeSelection(-1), 'PASS');
  assert.ok(calculateClosingLineValue(2.1, 2.0) > 0);
  assert.equal(analyzeOddsMovement(2.1, 1.85, 30).smartMoneyIndication, true);
});

// ── bookmakers ──────────────────────────────────────────────────────────
test('bookmakers: derived markets, best prices, arbitrage and accumulators', () => {
  const dc = deriveDoubleChance({ home: 0.5, draw: 0.3, away: 0.2 });
  assert.ok(close(dc['1X'].prob, 0.8) && close(dc['12'].prob, 0.7) && close(dc.X2.prob, 0.5));
  assert.ok(close(deriveDrawNoBet({ home: 0.5, draw: 0.3, away: 0.2 }).homeDNB.prob, 0.5 / 0.7));

  const cmp = compareBookmakerOdds([
    { bookmaker: 'SportyBet', odds: { home: 1.8, draw: 3.6, away: 4.5 } },
    { bookmaker: '1xBet', odds: { home: 1.85, draw: 3.5, away: 4.4 } },
    { bookmaker: '22Bet', odds: { home: 1.82, draw: 3.55, away: 4.6 } }
  ]);
  assert.equal(cmp.bestMarketConsensus.bestHome.odds, 1.85);
  assert.equal(cmp.bestMarketConsensus.bestAway.odds, 4.6);
  assert.ok(close(cmp.consensus.home + cmp.consensus.draw + cmp.consensus.away, 1, 1e-9));

  const arb = arbitrageStakes([2.1, 3.9, 4.2], 100);
  assert.ok(arb.stakes.reduce((a, b) => a + b, 0) <= 100.01);

  assert.ok(calculateAccumulatorEconomics([1.5, 2, 1.8, 2.2]).compoundMarginRiskPct > 15);
  const acc = evaluateAccumulator([{ odds: 2, modelProb: 0.55 }, { odds: 1.9, modelProb: 0.56 }]);
  assert.ok(close(acc.combinedProb, 0.308) && acc.evPercent > 0);
});

// ── pipeline ────────────────────────────────────────────────────────────
test('pipeline: every sample fixture produces a coherent prediction', () => {
  for (const input of FOOTBALL_INPUTS) {
    const p = buildFootballPrediction(input, { now: 0 });
    const s = p.probabilities.homeWin + p.probabilities.draw + p.probabilities.awayWin;
    assert.ok(close(s, 1, 1e-9), p.matchTitle);
    assert.ok(p.valueBets.length > 0);
    for (let i = 1; i < p.valueBets.length; i++) assert.ok(p.valueBets[i - 1].edgePercent >= p.valueBets[i].edgePercent);
    for (const v of p.valueBets) {
      assert.ok(close(v.edgePercent, Math.round((v.modelProb * v.bestOdds - 1) * 10000) / 100, 1e-9));
      if (v.edgePercent <= 0) assert.equal(v.grade, 'PASS');
    }
  }
  for (const input of BASKETBALL_INPUTS) {
    const p = buildBasketballPrediction(input, { now: 0 });
    assert.ok(close(p.probabilities.homeWin + p.probabilities.awayWin, 1, 1e-9), p.matchTitle);
    assert.ok(p.projectedScore.total > 120 && p.projectedScore.total < 260);
  }
});

test('pipeline: model weight 0 reproduces the market exactly (no edge from blending)', () => {
  const p = buildFootballPrediction(FOOTBALL_INPUTS[0], { modelWeight: 0 });
  assert.ok(close(p.probabilities.homeWin, p.marketProbabilities.homeWin, 1e-12));
});

// ── agents ──────────────────────────────────────────────────────────────
test('agents: hub analyses a prediction and never invents an edge', () => {
  const hub = new QuantEdgeAIAgentHub();
  for (const input of FOOTBALL_INPUTS) {
    const p = buildFootballPrediction(input);
    const a = hub.analyze(p);
    assert.equal(a.agents.length, 4);
    if (a.recommendation.action === 'BET') assert.ok(a.recommendation.edgePercent > 0);
    else assert.equal(a.recommendation.stakePercent, 0);
  }
});

test('agents: legacy feed entity path still works', async () => {
  const match = await new UnifiedSportsFetcher().getLiveFeedSnapshot('football');
  const report = await new QuantEdgeAIAgentHub().synthesizeMatchPrediction(match);
  assert.ok(report.matchOverview.fixture.includes('Arsenal'));
  assert.ok(report.comprehensiveMarketProbabilities.doubleChance['1X']);
  assert.ok(['BET', 'PASS'].includes(report.primaryRecommendation.action));
});
