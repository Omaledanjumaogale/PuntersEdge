/**
 * Lineup and Squad Absence Impact Recalibration Engine
 * Reverse engineered from RedScores.com squad nomination & injury/suspension news.
 */

/**
 * Calculates adjusted offensive and defensive parameters after accounting for missing players.
 * 
 * @param {Object} baselineParams { lambdaHome, muAway }
 * @param {Array} homeAbsences Array of missing players: { name, position, impactRating, minutesWeight }
 * @param {Array} awayAbsences Array of missing players: { name, position, impactRating, minutesWeight }
 */
export function adjustParametersForLineups(baselineParams, homeAbsences = [], awayAbsences = []) {
  // Typical position impact weights on attack vs defense:
  // FWD: 70% attack, 30% pressing/defense
  // MID: 50% attack, 50% defense
  // DEF/GK: 10% attack, 90% defense
  
  let homeAttackDegradation = 0.0;
  let homeDefenseDegradation = 0.0;

  for (const player of homeAbsences) {
    const weight = player.minutesWeight || 1.0;
    const rating = player.impactRating || 0.05; // 0.05 = 5% baseline team impact

    if (player.position === 'FWD') {
      homeAttackDegradation += rating * 0.70 * weight;
      homeDefenseDegradation += rating * 0.30 * weight;
    } else if (player.position === 'MID') {
      homeAttackDegradation += rating * 0.50 * weight;
      homeDefenseDegradation += rating * 0.50 * weight;
    } else if (player.position === 'DEF' || player.position === 'GK') {
      homeAttackDegradation += rating * 0.10 * weight;
      homeDefenseDegradation += rating * 0.90 * weight;
    }
  }

  let awayAttackDegradation = 0.0;
  let awayDefenseDegradation = 0.0;

  for (const player of awayAbsences) {
    const weight = player.minutesWeight || 1.0;
    const rating = player.impactRating || 0.05;

    if (player.position === 'FWD') {
      awayAttackDegradation += rating * 0.70 * weight;
      awayDefenseDegradation += rating * 0.30 * weight;
    } else if (player.position === 'MID') {
      awayAttackDegradation += rating * 0.50 * weight;
      awayDefenseDegradation += rating * 0.50 * weight;
    } else if (player.position === 'DEF' || player.position === 'GK') {
      awayAttackDegradation += rating * 0.10 * weight;
      awayDefenseDegradation += rating * 0.90 * weight;
    }
  }

  // Adjusted Home Expected Goals (Lambda):
  // Decreases with Home attack degradation, increases with Away defense degradation
  const adjustedLambda = baselineParams.lambdaHome * (1 - homeAttackDegradation) * (1 + awayDefenseDegradation);

  // Adjusted Away Expected Goals (Mu):
  // Decreases with Away attack degradation, increases with Home defense degradation
  const adjustedMu = baselineParams.muAway * (1 - awayAttackDegradation) * (1 + homeDefenseDegradation);

  return {
    original: {
      lambdaHome: baselineParams.lambdaHome,
      muAway: baselineParams.muAway,
      total: baselineParams.lambdaHome + baselineParams.muAway
    },
    adjusted: {
      lambdaHome: Math.max(0.15, Math.round(adjustedLambda * 1000) / 1000),
      muAway: Math.max(0.15, Math.round(adjustedMu * 1000) / 1000),
      total: Math.round((adjustedLambda + adjustedMu) * 1000) / 1000
    },
    impactDelta: {
      homeAttackChangePct: -(homeAttackDegradation * 100).toFixed(2),
      homeDefenseChangePct: +(homeDefenseDegradation * 100).toFixed(2),
      awayAttackChangePct: -(awayAttackDegradation * 100).toFixed(2),
      awayDefenseChangePct: +(awayDefenseDegradation * 100).toFixed(2)
    }
  };
}
