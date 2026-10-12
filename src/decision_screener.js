/**
 * Quantitative Decision & Value Screener Engine
 * Evaluates Positive Expected Value (+EV), Line Drift / RLM, and Optimal Fractional Kelly Staking.
 */

/**
 * Calculates Expected Value (+EV) of a wager.
 * 
 * @param {number} modelProbability True estimated win probability (0.0 to 1.0)
 * @param {number} bookmakerOdds Decimal odds offered by bookmaker (e.g. 2.15)
 */
export function calculateExpectedValue(modelProbability, bookmakerOdds) {
  const edge = (modelProbability * bookmakerOdds) - 1.0;
  const isPositiveEV = edge > 0;
  return {
    modelProbability,
    bookmakerOdds,
    impliedBookmakerProb: 1 / bookmakerOdds,
    edgePercent: Math.round(edge * 10000) / 100, // e.g. 5.25%
    isPositiveEV
  };
}

/**
 * Calculates Fractional Kelly Criterion bet size.
 * 
 * @param {number} modelProbability (p)
 * @param {number} bookmakerOdds (decimal)
 * @param {number} kellyFraction (e.g., 0.25 for Quarter Kelly)
 * @param {number} maxBankrollPct (Safety cap, e.g., 0.03 for 3% max bet)
 */
export function calculateKellyStake(modelProbability, bookmakerOdds, kellyFraction = 0.25, maxBankrollPct = 0.035) {
  const b = bookmakerOdds - 1.0; // Net odds
  const p = modelProbability;
  const q = 1.0 - p;

  const fullKelly = (b * p - q) / b;

  if (fullKelly <= 0) {
    return {
      recommendedStakePct: 0,
      fullKelly: 0,
      adjustedKelly: 0,
      action: 'PASS / NO VALUE'
    };
  }

  const scaledKelly = fullKelly * kellyFraction;
  const finalStake = Math.min(scaledKelly, maxBankrollPct);

  return {
    fullKellyPct: Math.round(fullKelly * 10000) / 100,
    recommendedStakePct: Math.round(finalStake * 10000) / 100,
    cappedAtMaximum: scaledKelly > maxBankrollPct,
    action: 'BET_VALUE'
  };
}

/**
 * Detects Market Signals: Reverse Line Movement (RLM) & Steam Moves
 * 
 * @param {number} openingOdds Opening decimal odds
 * @param {number} currentOdds Current closing decimal odds
 * @param {number} publicBetPercent Percentage of public bets on this selection (0 to 100)
 */
export function analyzeOddsMovement(openingOdds, currentOdds, publicBetPercent = 50) {
  const oddsRatio = currentOdds / openingOdds;
  const oddsMovementPct = ((currentOdds - openingOdds) / openingOdds) * 100;

  let signalType = 'NEUTRAL';
  let smartMoneyIndication = false;
  let explanation = '';

  // Reverse Line Movement (RLM):
  // If public bets are heavily on this side (> 60%), but odds lengthened (went up, indicating bookmaker is making it more tempting to attract dumb money while sharp money hit the other side)
  // OR public is low on this side (< 40%), but odds shortened (dropped, indicating bookmaker lowered odds despite low public tickets because sharp money bet heavily on it)
  if (publicBetPercent < 45 && oddsMovementPct < -3.5) {
    signalType = 'REVERSE_LINE_MOVEMENT_SHARP_INFLOW';
    smartMoneyIndication = true;
    explanation = `Smart money detected: Low public action (${publicBetPercent}%) but odds dropped by ${Math.abs(oddsMovementPct).toFixed(1)}%, indicating heavy institutional/syndicate volume.`;
  } else if (publicBetPercent > 65 && oddsMovementPct > +3.0) {
    signalType = 'REVERSE_LINE_MOVEMENT_FADE_PUBLIC';
    smartMoneyIndication = true;
    explanation = `Bookmaker shading: High public action (${publicBetPercent}%) but odds drifted up by ${oddsMovementPct.toFixed(1)}%. Bookmakers are accepting risk on the public side.`;
  } else if (oddsMovementPct < -6.0) {
    signalType = 'STEAM_MOVE';
    smartMoneyIndication = true;
    explanation = `Rapid steam move: Odds collapsed by ${Math.abs(oddsMovementPct).toFixed(1)}% across market consensus.`;
  } else {
    explanation = `Normal market fluctuation within standard liquidity bands (${oddsMovementPct.toFixed(1)}% drift).`;
  }

  return {
    openingOdds,
    currentOdds,
    oddsMovementPct: Math.round(oddsMovementPct * 100) / 100,
    signalType,
    smartMoneyIndication,
    explanation
  };
}
