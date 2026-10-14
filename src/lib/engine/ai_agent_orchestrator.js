/**
 * Multi-agent reasoning hub.
 *
 * Four deterministic specialist agents each inspect one aspect of a pipeline
 * prediction and emit findings; the master agent reconciles them into a
 * recommendation. Every sentence is generated from computed numbers — the
 * hub never asserts facts it did not derive.
 */

import { buildFootballPrediction } from './prediction_pipeline.js';
import { rankSelections, selectionDecision } from './decision_screener.js';

/** @param {number} p */
const pct = (p) => `${(p * 100).toFixed(1)}%`;

/**
 * @typedef {Object} AgentReport
 * @property {string} agent
 * @property {string} role
 * @property {'bullish' | 'bearish' | 'neutral'} stance
 * @property {number} confidence 0…1
 * @property {string} headline
 * @property {string[]} findings
 */

export class PuntersEdgeAIAgentHub {
  /** @param {{ modelName?: string }} [config] */
  constructor(config = {}) {
    this.modelName = config.modelName ?? 'PuntersEdge Reasoner (deterministic)';
  }

  /**
   * Market agent: price discovery, margins, movement.
   * @param {any} p prediction from the pipeline
   * @returns {AgentReport}
   */
  marketAgent(p) {
    const margins = /** @type {[string, number][]} */ (Object.entries(p.margins ?? {}).filter(([, m]) => Number.isFinite(m)));
    const sharpest = margins.length ? margins.reduce((a, b) => (b[1] < a[1] ? b : a)) : null;
    const softest = margins.length ? margins.reduce((a, b) => (b[1] > a[1] ? b : a)) : null;
    const findings = [
      sharpest && softest
        ? `Lowest margin: ${sharpest[0]} at ${sharpest[1].toFixed(2)}%; highest: ${softest[0]} at ${softest[1].toFixed(2)}%.`
        : 'No complete bookmaker market yet, so margins cannot be compared.',
      p.movement ? p.movement.explanation : 'No opening price on record, so movement cannot be assessed.'
    ];
    return {
      agent: 'Market Intelligence',
      role: 'Price discovery & line movement',
      stance: p.movement?.smartMoneyIndication ? 'bullish' : 'neutral',
      confidence: p.movement?.smartMoneyIndication ? 0.7 : 0.5,
      headline: p.movement?.smartMoneyIndication ? 'Observed price movement; its cause is unverified' : 'No verified price-movement signal supplied',
      findings
    };
  }

  /**
   * Squad agent: absences and their modelled effect.
   * @param {any} p
   * @returns {AgentReport}
   */
  squadAgent(p) {
    const n = p.absences.length;
    return {
      agent: 'Squad & Context',
      role: 'Availability & lineup impact',
      stance: n > 0 ? 'bearish' : 'neutral',
      confidence: n > 0 ? 0.65 : 0.55,
      headline: n === 0 ? 'No absences supplied in this feed' : `${n} absence${n > 1 ? 's' : ''} priced into the model`,
      findings: [p.lineupAlert]
    };
  }

  /**
   * Quant agent: model vs market disagreement.
   * @param {any} p
   * @returns {AgentReport}
   */
  quantAgent(p) {
    const findings = [];
    const family = p.family ?? p.sport;
    if (family === 'hockey' || family === 'baseball') {
      findings.push(
        `Expected ${p.summary.unit}: ${p.projectedScore.home} – ${p.projectedScore.away}; most likely regulation score ${p.summary.scoreline}.`,
        `Model moneyline ${pct(p.modelProbabilities.homeWin)} / ${pct(p.modelProbabilities.awayWin)} vs market ${pct(p.marketProbabilities.homeWin)} / ${pct(p.marketProbabilities.awayWin)}.`,
        `Over ${p.marketLines.total}: model ${pct(p.modelProbabilities.overTotal)} vs market ${pct(p.marketProbabilities.overTotal)}.`
      );
    } else if (family === 'football') {
      findings.push(
        `Expected goals ${p.expectedGoals.homeLambda.toFixed(2)} – ${p.expectedGoals.awayMu.toFixed(2)} (ρ ${p.expectedGoals.rho.toFixed(2)}).`,
        `Model 1X2 ${pct(p.modelProbabilities.homeWin)} / ${pct(p.modelProbabilities.draw)} / ${pct(p.modelProbabilities.awayWin)} vs market ${pct(p.marketProbabilities.homeWin)} / ${pct(p.marketProbabilities.draw)} / ${pct(p.marketProbabilities.awayWin)}.`,
        `Most likely score ${p.topScorelines[0].home}–${p.topScorelines[0].away} (${pct(p.topScorelines[0].prob)}).`
      );
    } else {
      findings.push(
        `Projected ${p.projectedScore.home} – ${p.projectedScore.away} at ${p.paceMetrics.possessionsPer48} possessions.`,
        `Model total ${p.projectedScore.total} vs market line ${p.marketLines.total}; model margin ${p.projectedScore.spread > 0 ? '+' : ''}${p.projectedScore.spread} vs line ${-p.marketLines.spread > 0 ? '+' : ''}${-p.marketLines.spread}.`,
        `Outcome dispersion: margin σ ${p.dispersion.marginSd}, total σ ${p.dispersion.totalSd}.`
      );
    }
    if (p.ratingsSource === 'market') {
      findings.push('No independent team ratings for this game yet: the model is fitted to the market consensus, so any edge comes from finding the best price.');
    } else if (p.ratingsSource && p.ratingsSource !== 'sample') {
      findings.push(`Team strengths come from ${p.ratingsSource}.`);
    }
    const gap = p.bestValue ? Math.abs(p.bestValue.modelProb - p.bestValue.marketProb) : 0;
    return {
      agent: 'Quantitative Model',
      role: family === 'football' ? 'Dixon–Coles distribution' : family === 'hockey' ? 'Poisson goal model' : family === 'baseball' ? 'Negative-binomial run model' : 'Tempo-free projection',
      stance: gap > 0.02 ? 'bullish' : 'neutral',
      confidence: Math.max(0.35, 0.8 - gap * 2),
      headline: gap > 0.08 ? 'Large model–market gap: treat with caution' : gap > 0.02 ? 'Model sees a mispricing' : 'Model agrees with the market',
      findings
    };
  }

  /**
   * Risk agent: staking discipline.
   * @param {any} p
   * @returns {AgentReport}
   */
  riskAgent(p) {
    const v = p.bestValue;
    const positive = v && selectionDecision(v).eligible;
    return {
      agent: 'Risk Manager',
      role: 'Kelly sizing & exposure',
      stance: positive ? 'neutral' : 'bearish',
      confidence: 0.75,
      headline: positive ? `Stake ${v.kellyStakePercent}% of bankroll (¼ Kelly, capped 3.5%)` : 'No stake — no positive expectation',
      findings: positive
        ? [
            `Break-even probability at ${v.bestOdds.toFixed(2)} is ${pct(1 / v.bestOdds)}; blended estimate is ${pct(v.modelProb)}.`,
            'Quarter-Kelly reduces exposure. Model error and losing runs can still produce substantial losses.'
          ]
        : ['No quoted outcome clears the combined likelihood, value and disagreement checks.']
    };
  }

  /**
   * Run all agents over a pipeline prediction and reconcile.
   * @param {any} prediction
   */
  analyze(prediction) {
    const agents = [this.marketAgent(prediction), this.squadAgent(prediction), this.quantAgent(prediction), this.riskAgent(prediction)];
    /** @type {import('./market_book.js').MarketSelection[]} */
    const candidates = prediction.markets?.flatMap((/** @type {any} */ group) => group.selections) ?? prediction.valueBets ?? [];
    const v = rankSelections(candidates.filter((/** @type {any} */ selection) => selection.pricing === 'quoted'))[0];

    const recommendation = v && v.eligible && v.grade !== 'PASS'
      ? {
          action: 'BET',
          market: v.market,
          selection: v.selection,
          bookmaker: v.bookmaker,
          odds: v.bestOdds,
          fairOdds: v.fairOdds,
          edgePercent: v.edgePercent,
          stakePercent: v.kellyStakePercent,
          grade: v.grade,
          probability: v.successProbability,
          decisionScore: v.decisionScore,
          rationale: `Blending the model (${Math.round(prediction.modelWeight * 100)}%) with the de-vigged market puts ${v.selection} at ${pct(v.modelProb)} against a market consensus of ${pct(v.marketProb)}. ${v.bookmaker}'s ${v.bestOdds.toFixed(2)} beats the fair price of ${v.fairOdds.toFixed(2)}, an expected edge of +${v.edgePercent.toFixed(2)}%. The decision score is ${v.decisionScore.toFixed(1)}/100: estimated win likelihood has 65% weight, positive expected value 25%, and the probability margin above break-even 10%, discounted for model disagreement. This is an uncalibrated ranking heuristic, not a proven success rate.`
        }
      : {
          action: 'PASS',
          market: v?.market ?? '—',
          selection: v?.selection ?? '—',
          bookmaker: v?.bookmaker ?? '—',
          odds: v?.bestOdds ?? 0,
          fairOdds: v?.fairOdds ?? 0,
          edgePercent: v?.edgePercent ?? 0,
          stakePercent: 0,
          grade: 'PASS',
          rationale: 'No quoted selection passes all decision checks: positive expected value, at least 50% estimated outright win probability, and no more than 15 percentage points of model–market disagreement. Derived prices are informational and cannot become a bet verdict.'
        };

    const consensusConfidence = agents.reduce((a, g) => a + g.confidence, 0) / agents.length;
    return { engine: this.modelName, fixture: prediction.matchTitle, agents, recommendation, consensusConfidence };
  }

  /**
   * Backwards-compatible entry point used by the CLI pipeline: accepts a
   * normalised feed entity from UnifiedSportsFetcher.
   * @param {any} matchEntity
   * @param {{ lambdaHome: number, muAway: number }} [baselineParams]
   */
  async synthesizeMatchPrediction(matchEntity, baselineParams = { lambdaHome: 1.85, muAway: 0.85 }) {
    /** @type {Record<string, Record<string, number>>} */
    const odds = {};
    const names = { sportyBet: 'SportyBet', oneXBet: '1xBet', twentyTwoBet: '22Bet' };
    for (const [key, label] of Object.entries(names)) {
      const o = matchEntity.oddsMarket[key];
      if (o) odds[label] = { home: o.home, draw: o.draw, away: o.away, over25: o.over2_5, under25: o.under2_5 };
    }
    const prediction = buildFootballPrediction({
      fixtureId: matchEntity.matchId,
      homeTeam: matchEntity.homeTeam.name,
      awayTeam: matchEntity.awayTeam.name,
      league: matchEntity.tournament,
      kickoffTime: matchEntity.startTimeUtc,
      ratings: baselineParams,
      absences: { home: matchEntity.lineups.homeMissing, away: matchEntity.lineups.awayMissing },
      odds
    });
    const analysis = this.analyze(prediction);
    const p = prediction.probabilities;
    const dc = prediction.derived.doubleChance;
    const dnb = prediction.derived.drawNoBet;

    return {
      prediction,
      analysis,
      matchOverview: { fixture: prediction.matchTitle, competition: prediction.league, kickoffUtc: prediction.kickoffTime },
      comprehensiveMarketProbabilities: {
        oneXTwo: { home: pct(p.homeWin), draw: pct(p.draw), away: pct(p.awayWin) },
        doubleChance: { '1X': pct(dc['1X'].prob), '12': pct(dc['12'].prob), X2: pct(dc.X2.prob) },
        drawNoBet: { home: pct(dnb.homeDNB.prob), away: pct(dnb.awayDNB.prob) },
        overUnderGoals: { over2_5: pct(p.over25), under2_5: pct(p.under25) },
        bothTeamsToScore: { yes: pct(prediction.modelProbabilities.bttsYes), no: pct(prediction.modelProbabilities.bttsNo) }
      },
      primaryRecommendation: {
        action: analysis.recommendation.action,
        recommendedMarket: analysis.recommendation.selection,
        targetBookmaker: analysis.recommendation.bookmaker,
        quotedOdds: analysis.recommendation.odds,
        mathematicalEdge: `${analysis.recommendation.edgePercent >= 0 ? '+' : ''}${analysis.recommendation.edgePercent}%`,
        confidenceRating: analysis.recommendation.grade,
        suggestedStakePct: `${analysis.recommendation.stakePercent}% of bankroll`,
        plainEnglishRationale: analysis.recommendation.rationale
      }
    };
  }
}
