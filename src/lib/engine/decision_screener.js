/**
 * Decision layer: expected value, fractional Kelly staking, value grading and
 * odds-movement signals (steam / reverse line movement / closing line value).
 */

import { round } from './math.js';

/**
 * Expected value per unit staked.
 * @param {number} modelProbability true win probability (0…1)
 * @param {number} bookmakerOdds decimal odds
 */
export function calculateExpectedValue(modelProbability, bookmakerOdds) {
  const edge = modelProbability * bookmakerOdds - 1;
  return {
    modelProbability,
    bookmakerOdds,
    impliedBookmakerProb: 1 / bookmakerOdds,
    edgePercent: round(edge * 100, 2),
    isPositiveEV: edge > 0
  };
}

/**
 * Fractional Kelly stake with a hard bankroll cap.
 * @param {number} modelProbability
 * @param {number} bookmakerOdds
 * @param {number} [kellyFraction] e.g. 0.25 = quarter Kelly
 * @param {number} [maxBankrollPct] cap as a fraction of bankroll
 */
export function calculateKellyStake(modelProbability, bookmakerOdds, kellyFraction = 0.25, maxBankrollPct = 0.035) {
  const b = bookmakerOdds - 1;
  const p = modelProbability;
  const fullKelly = b > 0 ? (b * p - (1 - p)) / b : 0;

  if (fullKelly <= 0) {
    return { fullKellyPct: 0, recommendedStakePct: 0, cappedAtMaximum: false, action: 'PASS' };
  }

  const scaled = fullKelly * kellyFraction;
  const finalStake = Math.min(scaled, maxBankrollPct);
  return {
    fullKellyPct: round(fullKelly * 100, 2),
    recommendedStakePct: round(finalStake * 100, 2),
    cappedAtMaximum: scaled > maxBankrollPct,
    action: 'BET_VALUE'
  };
}

/**
 * Grade a selection by edge, discounted when the model is far from the
 * market (large disagreement is more often model error than market error).
 * @param {number} edgePercent
 * @param {number} [modelMarketGapPct] |model − market| probability gap in points
 * @returns {'A+' | 'A' | 'B' | 'C' | 'PASS'}
 */
export function gradeSelection(edgePercent, modelMarketGapPct = 0) {
  const penalty = Math.max(0, modelMarketGapPct - 8) * 0.35;
  const score = edgePercent - penalty;
  if (score >= 6) return 'A+';
  if (score >= 3.5) return 'A';
  if (score >= 1.5) return 'B';
  if (score > 0) return 'C';
  return 'PASS';
}

/**
 * Closing line value: how much better the taken price was than the close.
 * Positive CLV is the most reliable long-run indicator of a sharp bettor.
 * @param {number} takenOdds
 * @param {number} closingFairOdds de-vigged closing odds
 */
export function calculateClosingLineValue(takenOdds, closingFairOdds) {
  return round((takenOdds / closingFairOdds - 1) * 100, 2);
}

/**
 * Detect steam moves and reverse line movement.
 * @param {number} openingOdds
 * @param {number} currentOdds
 * @param {number} [publicBetPercent] share of tickets on this selection (0…100)
 */
export function analyzeOddsMovement(openingOdds, currentOdds, publicBetPercent = 50) {
  const move = ((currentOdds - openingOdds) / openingOdds) * 100;

  let signalType = 'NEUTRAL';
  let smartMoneyIndication = false;
  let explanation;

  if (publicBetPercent < 45 && move < -3.5) {
    signalType = 'REVERSE_LINE_MOVEMENT_SHARP_INFLOW';
    smartMoneyIndication = true;
    explanation = `Price shortened ${Math.abs(move).toFixed(1)}% while only ${publicBetPercent}% of tickets backed it — money, not tickets, moved this line.`;
  } else if (publicBetPercent > 65 && move > 3) {
    signalType = 'REVERSE_LINE_MOVEMENT_FADE_PUBLIC';
    smartMoneyIndication = true;
    explanation = `Price drifted ${move.toFixed(1)}% despite ${publicBetPercent}% of tickets — books are happy to hold public liability here.`;
  } else if (move < -6) {
    signalType = 'STEAM_MOVE';
    smartMoneyIndication = true;
    explanation = `Steam: price collapsed ${Math.abs(move).toFixed(1)}% from the open across the market.`;
  } else {
    explanation = `Normal fluctuation (${move >= 0 ? '+' : ''}${move.toFixed(1)}% from open).`;
  }

  return { openingOdds, currentOdds, oddsMovementPct: round(move, 2), signalType, smartMoneyIndication, explanation };
}

/**
 * Transparent decision heuristic, not a calibrated probability or track record.
 * Likelihood receives most weight; EV and the margin above break-even reward
 * favourable quoted prices. Large model/market disagreements reduce the score.
 * A push is not a win, so conditional probabilities are discounted by push risk.
 * @param {{modelProb:number,marketProb:number,bestOdds:number,edgePercent:number,pushProb?:number,pricing?:string,grade?:string}} selection
 */
export function selectionDecision(selection) {
  const { modelProb: p, marketProb: market, bestOdds: odds, edgePercent: ev } = selection;
  const push = selection.pushProb ?? 0;
  const probability = p * (1 - push);
  const gap = Math.abs(p - market);
  const cushion = p - 1 / odds;
  const valueSupported = selection.pricing === 'quoted' && Number.isFinite(p) && p > 0 && p < 1
    && Number.isFinite(odds) && odds > 1 && push >= 0 && push < 1
    && ev > 0 && ev <= 25 && gap <= 0.15 && cushion > 0;
  const eligible = valueSupported && probability >= 0.5;
  const decisionScore = valueSupported
    ? round(100 * (0.65 * probability + 0.25 * Math.min(ev / 25, 1) + 0.1 * Math.min(cushion / 0.15, 1)) * (1 - gap), 3)
    : 0;
  return { eligible, decisionScore, successProbability: probability,
    grade: /** @type {'A+' | 'A' | 'B' | 'C' | 'PASS'} */ (!valueSupported ? 'PASS' : decisionScore >= 70 ? 'A+' : decisionScore >= 60 ? 'A' : decisionScore >= 50 ? 'B' : 'C') };
}

/** @template { {modelProb:number,marketProb:number,bestOdds:number,edgePercent:number,pushProb?:number,pricing?:string,grade?:string} } T
 * @param {T[]} selections
 * @returns {Array<T & ReturnType<typeof selectionDecision>>}
 */
export function rankSelections(selections) {
  return selections.map(s => ({ ...s, ...selectionDecision(s) }))
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.decisionScore - a.decisionScore || b.successProbability - a.successProbability || b.edgePercent - a.edgePercent);
}

/** Likelihood band, independent of bookmaker value; never a historical accuracy claim. */
export function likelihoodGrade(/** @type {number} */ probability) {
 return probability >= .85 ? 'A+' : probability >= .7 ? 'A' : probability >= .55 ? 'B' : probability >= .4 ? 'C' : 'PASS';
}
