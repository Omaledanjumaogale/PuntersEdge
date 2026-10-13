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
import { PuntersEdgeAIAgentHub } from '../src/lib/engine/ai_agent_orchestrator.js';
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
  const hub = new PuntersEdgeAIAgentHub();
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
  const report = await new PuntersEdgeAIAgentHub().synthesizeMatchPrediction(match);
  assert.ok(report.matchOverview.fixture.includes('Arsenal'));
  assert.ok(report.comprehensiveMarketProbabilities.doubleChance['1X']);
  assert.ok(['BET', 'PASS'].includes(report.primaryRecommendation.action));
});

// ── market book ─────────────────────────────────────────────────────────
test('market book: football ladders are consistent with headline markets', () => {
  for (const input of FOOTBALL_INPUTS) {
    const p = buildFootballPrediction(input, { modelWeight: 1 });
    const find = (key) => p.markets.flatMap((g) => g.selections).find((s) => s.id === `${input.fixtureId}:${key}`);
    assert.ok(p.markets.length >= 7, 'groups');
    // Handicap -0.5 is the same bet as the home win.
    assert.ok(close(find('ahh-0.5').modelProb, find('home').modelProb, 1e-9));
    // Double chance 1X = 1 - away.
    assert.ok(close(find('dc1x').modelProb, 1 - find('away').modelProb, 1e-9));
    // DNB carries the draw as push probability.
    assert.ok(close(find('dnbh').pushProb, p.modelProbabilities.draw, 1e-9));
    for (const s of p.markets.flatMap((g) => g.selections)) {
      assert.ok(s.bestOdds > 1 && Number.isFinite(s.bestOdds), s.selection);
      assert.ok(close(s.edgePercent, Math.round((1 - s.pushProb) * (s.modelProb * s.bestOdds - 1) * 10000) / 100, 1e-9), s.selection);
      if (s.edgePercent <= 0) assert.equal(s.grade, 'PASS');
    }
  }
});

test('market book: quoted prices are used as quoted', () => {
  const input = FOOTBALL_INPUTS[0];
  const p = buildFootballPrediction(input);
  const home = p.markets[0].selections[0];
  assert.equal(home.pricing, 'quoted');
  assert.equal(home.bestOdds, Math.max(...Object.values(input.odds).map((o) => o.home)));
});

test('market book: basketball ladders are monotonic and complementary', () => {
  for (const input of BASKETBALL_INPUTS) {
    const p = buildBasketballPrediction(input);
    const spread = p.markets.find((g) => g.key === 'spread').selections;
    const homeSide = spread.filter((_, i) => i % 2 === 0).map((s) => s.modelProb);
    for (let i = 1; i < homeSide.length; i++) assert.ok(homeSide[i] > homeSide[i - 1], 'easier lines are likelier');
    for (let i = 0; i < spread.length; i += 2) assert.ok(close(spread[i].modelProb + spread[i + 1].modelProb, 1, 1e-9));
    const totals = p.markets.find((g) => g.key === 'total').selections;
    const overs = totals.filter((_, i) => i % 2 === 0).map((s) => s.modelProb);
    for (let i = 1; i < overs.length; i++) assert.ok(overs[i] < overs[i - 1], 'higher totals are less likely');
  }
});

test('math: probit inverts the normal CDF', async () => {
  const { probit } = await import('../src/lib/engine/math.js');
  for (const p of [0.001, 0.05, 0.3, 0.5, 0.77, 0.999]) assert.ok(close(normalCdf(probit(p)), p, 1e-6), `p=${p}`); // erf approximation is good to ~1.5e-7
});

// ── hockey & baseball ───────────────────────────────────────────────────
import { scoreDistribution, fitMeans, SCORE_SPORTS, buildScoreSportPrediction } from '../src/lib/engine/score_sports.js';
import { footballRatings, scoreSportRatings, basketballRatings, marketRatings, tableFromResults } from '../src/lib/engine/ratings.js';
import { settle, profitFor } from '../src/lib/engine/settlement.js';
import { HOCKEY_INPUTS, BASEBALL_INPUTS, NBA_INPUTS } from '../src/lib/data/fixtures.js';

test('score sports: regulation grid sums to one; ties go to extra play', () => {
  for (const fam of /** @type {const} */ (['hockey', 'baseball'])) {
    const cfg = SCORE_SPORTS[fam];
    const d = scoreDistribution(fam === 'hockey' ? 3.1 : 4.6, fam === 'hockey' ? 2.8 : 4.2, cfg);
    const reg = d.regulation.home + d.regulation.draw + d.regulation.away;
    assert.ok(close(reg, 1, 1e-6), `${fam} grid sums to ${reg}`);
    assert.ok(close(d.moneyline.home + d.moneyline.away, 1, 1e-6));
    assert.ok(close(d.moneyline.home, d.regulation.home + d.regulation.draw * cfg.extraHomeWin, 1e-9));
    // Ladders are monotonic.
    for (let i = 1; i < cfg.totalLines.length; i++) assert.ok(d.over(cfg.totalLines[i]) < d.over(cfg.totalLines[i - 1]));
    assert.ok(d.cover(-1.5) < d.moneyline.home && d.moneyline.home < d.cover(1.5));
  }
});

test('score sports: baseball runs are over-dispersed relative to Poisson', () => {
  const nb = scoreDistribution(4.5, 4.5, SCORE_SPORTS.baseball);
  const po = scoreDistribution(4.5, 4.5, { ...SCORE_SPORTS.baseball, distribution: 'poisson' });
  // Fatter tails: more 12+ run games.
  assert.ok(nb.over(11.5) > po.over(11.5));
});

test('score sports: fitting means reproduces a book\'s prices', () => {
  const cfg = SCORE_SPORTS.hockey;
  const target = scoreDistribution(3.4, 2.7, cfg);
  const fit = fitMeans({ homeWin: target.moneyline.home, over: { line: 6.5, prob: target.over(6.5) } }, cfg, { home: 3, away: 3 });
  assert.ok(Math.abs(fit.home - 3.4) < 0.05 && Math.abs(fit.away - 2.7) < 0.05, JSON.stringify(fit));
});

test('score sports: quoted lines are priced as quoted, derived ones labelled', () => {
  for (const input of [...HOCKEY_INPUTS, ...BASEBALL_INPUTS]) {
    const fam = input.league === 'NHL' ? 'hockey' : 'baseball';
    const p = buildScoreSportPrediction(input, fam, { now: Date.parse('2026-10-12T00:00:00Z') });
    const ml = p.markets.find((g) => g.key === 'ml');
    assert.ok(ml && ml.selections.every((s) => s.pricing === 'quoted'));
    for (const s of ml.selections) {
      const quoted = Object.values(input.odds).map((o) => (s.selection.startsWith(input.homeTeam) ? o.homeMoneyline : o.awayMoneyline));
      assert.equal(s.bestOdds, Math.max(...quoted));
    }
    assert.ok(p.markets.find((g) => g.key === 'team')?.selections.every((s) => s.pricing === 'derived'));
    if (fam === 'hockey') assert.ok(p.markets.some((g) => g.key === 'reg'));
    assert.ok(new PuntersEdgeAIAgentHub().analyze(p).agents.length >= 3);
  }
});

test('nba: sample games run through the basketball engine as their own sport', () => {
  for (const input of NBA_INPUTS) {
    const p = buildBasketballPrediction(input, { sport: 'nba' });
    assert.equal(p.sport, 'nba');
    assert.ok(p.markets.flatMap((g) => g.selections).every((s) => s.sport === 'nba'));
  }
});

test('pipeline: partial and missing prices never produce NaN', () => {
  const fb = buildFootballPrediction({ ...FOOTBALL_INPUTS[0], odds: { A: { home: 2.1, draw: 3.4, away: 3.6 } } });
  assert.ok(Number.isFinite(fb.probabilities.over25));
  assert.ok(fb.markets.flatMap((g) => g.selections).every((s) => Number.isFinite(s.bestOdds) && Number.isFinite(s.edgePercent)));
  const none = buildFootballPrediction({ ...FOOTBALL_INPUTS[0], odds: {} });
  assert.equal(none.valueBets.length, 0);
  assert.ok(new PuntersEdgeAIAgentHub().analyze(none).agents.length > 0);
  const bb = buildBasketballPrediction({ ...BASKETBALL_INPUTS[0], odds: { A: { homeMoneyline: 1.7, awayMoneyline: 2.2 } } });
  assert.ok(Number.isFinite(bb.marketLines.total) && Number.isFinite(bb.marketLines.spread));
  assert.ok(bb.markets.flatMap((g) => g.selections).every((s) => Number.isFinite(s.bestOdds)));
});

// ── ratings ─────────────────────────────────────────────────────────────
test('ratings: stronger table teams get higher expected scores, shrunk early on', () => {
  const rows = [
    { teamId: 1, team: 'Top', played: 10, for: 25, against: 8, home: { played: 5, for: 15, against: 3 }, away: { played: 5, for: 10, against: 5 } },
    { teamId: 2, team: 'Bottom', played: 10, for: 8, against: 24, home: { played: 5, for: 5, against: 10 }, away: { played: 5, for: 3, against: 14 } },
    { teamId: 3, team: 'Mid', played: 10, for: 14, against: 14, home: { played: 5, for: 8, against: 6 }, away: { played: 5, for: 6, against: 8 } }
  ];
  const r = footballRatings(rows, 1, 2);
  const rev = footballRatings(rows, 2, 1);
  assert.ok(r && rev && r.lambdaHome > rev.lambdaHome && r.muAway < rev.muAway);
  const scale = (/** @type {any} */ x, /** @type {number} */ k) => ({ played: x.played / k, for: x.for / k, against: x.against / k });
  const early = footballRatings(rows.map((x) => ({ ...x, ...scale(x, 5), home: scale(x.home, 5), away: scale(x.away, 5) })), 1, 2);
  assert.ok(early && early.lambdaHome / early.muAway < r.lambdaHome / r.muAway, 'one game says less than ten');
  const h = scoreSportRatings(tableFromResults([{ homeId: 1, awayId: 2, home: 'A', away: 'B', homeScore: 5, awayScore: 1 }, { homeId: 2, awayId: 1, home: 'B', away: 'A', homeScore: 2, awayScore: 4 }]), 1, 2, 'hockey');
  assert.ok(h && h.homeMean > h.awayMean);
  const nba = basketballRatings([{ teamId: 1, team: 'A', played: 20, for: 0, against: 0, wins: 16, losses: 4 }, { teamId: 2, team: 'B', played: 20, for: 0, against: 0, wins: 4, losses: 16 }], 1, 2, 'NBA');
  assert.ok(nba && nba.home.offRtg - nba.home.defRtg > nba.away.offRtg - nba.away.defRtg);
});

test('ratings: market-implied ratings reproduce the consensus', () => {
  const odds = { A: { home: 1.8, draw: 3.8, away: 4.6, over25: 1.75, under25: 2.1 } };
  const r = marketRatings('football', odds);
  const p = buildFootballPrediction({ fixtureId: 'm', homeTeam: 'H', awayTeam: 'A', league: 'X', ratings: r, odds });
  assert.ok(Math.abs(p.modelProbabilities.homeWin - p.marketProbabilities.homeWin) < 0.01);
  const hk = { A: { homeMoneyline: 1.7, awayMoneyline: 2.25, totalLine: 6.5, overOdds: 2.05, underOdds: 1.8 } };
  const hr = marketRatings('hockey', hk);
  const hp = buildScoreSportPrediction({ fixtureId: 'h', homeTeam: 'H', awayTeam: 'A', league: 'NHL', ratings: hr, odds: hk }, 'hockey');
  assert.ok(Math.abs(hp.modelProbabilities.homeWin - hp.marketProbabilities.homeWin) < 0.01);
  const bk = { A: { homeMoneyline: 1.5, awayMoneyline: 2.7, spreadLine: -5.5, homeSpreadOdds: 1.91, awaySpreadOdds: 1.91, totalLine: 224.5, overOdds: 1.91, underOdds: 1.91 } };
  const br = marketRatings('basketball', bk, 'NBA');
  const bp = buildBasketballPrediction({ fixtureId: 'b', homeTeam: 'H', awayTeam: 'A', league: 'NBA', ratings: br, odds: bk });
  assert.ok(Math.abs(bp.projectedScore.total - 224.5) < 2, `total ${bp.projectedScore.total}`);
  assert.ok(Math.abs(bp.projectedScore.spread - 5.5) < 1.5, `spread ${bp.projectedScore.spread}`);
});

// ── settlement ──────────────────────────────────────────────────────────
test('settlement: football on 90 minutes, other sports include extra play', () => {
  const fb = { home: 2, away: 2, regHome: 1, regAway: 1 };
  assert.equal(settle('football', 'draw', fb), 'won');
  assert.equal(settle('football', 'o2.5', fb), 'lost');
  assert.equal(settle('football', 'ahh-1', { home: 2, away: 1 }), 'push');
  assert.equal(settle('football', 'aha0.5', { home: 1, away: 1 }), 'won');
  assert.equal(settle('football', 'dnbh', { home: 0, away: 0 }), 'push');
  const ot = { home: 4, away: 3, regHome: 3, regAway: 3 };
  assert.equal(settle('hockey', 'homeMl', ot), 'won');
  assert.equal(settle('hockey', 'regX', ot), 'won');
  assert.equal(settle('hockey', 'sph-1.5', ot), 'lost');
  assert.equal(settle('baseball', 'o8.5', { home: 5, away: 4 }), 'won');
  assert.equal(settle('basketball', 'spa5.5', { home: 110, away: 105 }), 'won');
  assert.equal(settle('basketball', 'mystery', { home: 1, away: 0 }), null);
  assert.equal(profitFor('won', 2.5), 1.5);
  assert.equal(profitFor('half-lost', 2), -0.5);
});

test('decision: likely positive-EV quoted outcome outranks an edge-only longshot', async () => {
  const { rankSelections } = await import('../src/lib/engine/decision_screener.js');
  const longshot = { selection: 'longshot', modelProb: 0.2, marketProb: 0.19, bestOdds: 6, edgePercent: 20, pricing: 'quoted' };
  const likely = { selection: 'likely', modelProb: 0.75, marketProb: 0.7, bestOdds: 1.4, edgePercent: 5, pricing: 'quoted' };
  const ranked = rankSelections([longshot, likely]);
  assert.equal(ranked[0].selection, 'likely');
  assert.ok(ranked[0].decisionScore > 0);
  assert.equal(ranked[1].eligible, false, 'a value grade does not make a low-likelihood outcome a verdict');
  assert.equal(ranked[1].grade, 'C', 'a genuine positive-value longshot retains its weaker value grade');
});

test('decision: derived quotes, nonpositive EV and excessive disagreement retain PASS', async () => {
  const { selectionDecision } = await import('../src/lib/engine/decision_screener.js');
  const base = { modelProb: 0.75, marketProb: 0.7, bestOdds: 1.4, edgePercent: 5, pricing: 'quoted' };
  for (const patch of [{ pricing: 'derived' }, { edgePercent: 0 }, { marketProb: 0.4 }]) {
    const decision = selectionDecision({ ...base, ...patch });
    assert.equal(decision.grade, 'PASS');
    assert.equal(decision.decisionScore, 0);
  }
  assert.equal(selectionDecision({...base,pushProb:.4}).eligible,false,'push risk excludes the final verdict independently of the value grade');
});

test('pipeline verdict searches quoted selections across the full market book', async () => {
  const { rankSelections } = await import('../src/lib/engine/decision_screener.js');
  const football = buildFootballPrediction(FOOTBALL_INPUTS[0]);
  const basketball = buildBasketballPrediction(BASKETBALL_INPUTS[0]);
  for (const p of [football, basketball]) {
    const ranked = rankSelections(p.markets.flatMap(group => group.selections).filter(selection => selection.pricing === 'quoted'));
    assert.equal(p.bestValue?.id, ranked[0]?.id);
    assert.equal(p.bestValue?.grade, ranked[0]?.grade);
  }
});

test('value grading supports A+, A, B and C without giving unsupported quotes value grades',async()=>{
 const {selectionDecision,likelihoodGrade}=await import('../src/lib/engine/decision_screener.js');
 const examples=[['A+',.9,1.3,17],['A',.85,1.22,3.7],['B',.75,1.4,5],['C',.55,2,10]];
 for(const [grade,modelProb,bestOdds,edgePercent] of examples)assert.equal(selectionDecision({modelProb,marketProb:modelProb,bestOdds,edgePercent,pricing:'quoted'}).grade,grade);
 assert.equal(selectionDecision({modelProb:.9,marketProb:.9,bestOdds:1.3,edgePercent:17,pricing:'derived'}).grade,'PASS');assert.equal(likelihoodGrade(.9),'A+');assert.equal(likelihoodGrade(.75),'A');
});
