/**
 * Lineup & absence recalibration.
 *
 * Each missing player removes a share of his side's attack and defence
 * according to position. Impacts compound multiplicatively, so ten absences
 * can never remove more than 100% of a team.
 */

import { round } from './math.js';

/**
 * @typedef {{ name: string, position: 'GK' | 'DEF' | 'MID' | 'FWD', impactRating?: number, minutesWeight?: number }} Absence
 */

/** Attack / defence split of a player's impact by position. */
export const POSITION_WEIGHTS = {
  FWD: { attack: 0.7, defense: 0.3 },
  MID: { attack: 0.5, defense: 0.5 },
  DEF: { attack: 0.1, defense: 0.9 },
  GK: { attack: 0.0, defense: 1.0 }
};

/**
 * Multiplicative degradation of a team's attack and defence.
 * @param {Absence[]} absences
 */
export function teamDegradation(absences = []) {
  let attackKeep = 1;
  let defenseKeep = 1;
  for (const player of absences) {
    const w = POSITION_WEIGHTS[player.position];
    if (!w) continue;
    const impact = (player.impactRating ?? 0.05) * (player.minutesWeight ?? 1);
    attackKeep *= 1 - impact * w.attack;
    defenseKeep *= 1 - impact * w.defense;
  }
  return { attack: 1 - attackKeep, defense: 1 - defenseKeep };
}

/**
 * Adjust λ / μ for both teams' absences.
 * @param {{ lambdaHome: number, muAway: number }} baselineParams
 * @param {Absence[]} [homeAbsences]
 * @param {Absence[]} [awayAbsences]
 */
export function adjustParametersForLineups(baselineParams, homeAbsences = [], awayAbsences = []) {
  const home = teamDegradation(homeAbsences);
  const away = teamDegradation(awayAbsences);

  const lambda = baselineParams.lambdaHome * (1 - home.attack) * (1 + away.defense);
  const mu = baselineParams.muAway * (1 - away.attack) * (1 + home.defense);

  return {
    original: {
      lambdaHome: baselineParams.lambdaHome,
      muAway: baselineParams.muAway,
      total: baselineParams.lambdaHome + baselineParams.muAway
    },
    adjusted: {
      lambdaHome: Math.max(0.15, round(lambda, 3)),
      muAway: Math.max(0.15, round(mu, 3)),
      total: round(lambda + mu, 3)
    },
    impactDelta: {
      homeAttackChangePct: -round(home.attack * 100, 2),
      homeDefenseChangePct: round(home.defense * 100, 2),
      awayAttackChangePct: -round(away.attack * 100, 2),
      awayDefenseChangePct: round(away.defense * 100, 2)
    }
  };
}
