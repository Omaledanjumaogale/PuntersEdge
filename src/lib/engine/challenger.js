/** Offline-trained challenger. Not wired into production recommendations.
 * Artifacts and calibration must be fitted before the prediction timestamp.
 * A market-implied baseline is never labelled independent model evidence.
 */
import { generateScoreMatrix } from './football_model.js';

const timestamp = (/** @type {string} */ value) => {
  const t = Date.parse(value);
  if (!Number.isFinite(t)) throw new Error('A valid ISO timestamp is required');
  return t;
};

/** @param {any} artifact @param {any} fixture */
export function footballChallenger(artifact, fixture) {
  const at = timestamp(fixture.predictedAt);
  if (timestamp(artifact.trainedThrough) >= at || at >= timestamp(fixture.kickoff))
    throw new Error('Training and prediction must precede kickoff');
  if (artifact.league !== fixture.league) throw new Error('League mismatch');
  const h = artifact.teams?.[fixture.homeId], a = artifact.teams?.[fixture.awayId];
  if (!h || !a) return { status: 'abstain', reason: 'unseen_team', modelVersion: artifact.version };
  const values = [artifact.intercept, artifact.homeAdvantage, artifact.rho, h.attack, h.defence, a.attack, a.defence];
  if (!values.every(Number.isFinite)) throw new Error('Invalid fitted parameters');
  const lambda = Math.exp(artifact.intercept + artifact.homeAdvantage + h.attack + a.defence);
  const mu = Math.exp(artifact.intercept + a.attack + h.defence);
  if (!Number.isFinite(lambda + mu) || lambda > 12 || mu > 12 || lambda < .05 || mu < .05)
    return { status: 'abstain', reason: 'out_of_domain', modelVersion: artifact.version };
  if (Math.min(1-lambda*mu*artifact.rho, 1+lambda*artifact.rho, 1+mu*artifact.rho, 1-artifact.rho) <= 0)
    return { status: 'abstain', reason: 'invalid_dependence_for_fixture', modelVersion: artifact.version };
  const maxGoals = Math.max(16, Math.ceil(Math.max(lambda, mu) + 10 * Math.sqrt(Math.max(lambda, mu))));
  const model = generateScoreMatrix(lambda, mu, artifact.rho, maxGoals);
  return { status: 'shadow', modelVersion: artifact.version, league: fixture.league,
    fixtureId: fixture.fixtureId, predictedAt: fixture.predictedAt,
    trainedThrough: artifact.trainedThrough, independent: true,
    probabilities: model.probabilities, expectedGoals: { home: lambda, away: mu },
    truncatedMass: model.truncatedMass, recommendation: 'PASS' };
}

/** @param {any} s @param {any} policy
 * Probability and lower bound must use the same conditional-on-no-push basis.
 * Validation approval must belong to this exact model, league, market and rules.
 */
export function challengerDecision(s, policy) {
  const reasons = [];
  const fields = [s.probability, s.lowerProbability, s.pushProbability, s.odds];
  if (!fields.every(Number.isFinite) || s.probability <= 0 || s.probability >= 1
    || s.lowerProbability < 0 || s.lowerProbability > s.probability
    || s.pushProbability < 0 || s.pushProbability >= 1 || s.odds <= 1)
    return { action: 'PASS', reasons: ['invalid_probability_or_quote'], expectedValue: null };
  if (!policy?.approved || policy.version !== s.modelVersion || policy.league !== s.league
    || policy.market !== s.market || policy.rules !== s.rules) reasons.push('unvalidated_segment');
  if (!s.independent) reasons.push('market_only');
  if (s.pricing !== 'quoted') reasons.push('unavailable_quote');
  const age = timestamp(s.predictedAt) - timestamp(s.quoteObservedAt);
  if (!Number.isFinite(policy?.maxQuoteAgeMs) || policy.maxQuoteAgeMs <= 0 || age < 0 || age > policy.maxQuoteAgeMs) reasons.push('stale_quote');
  if (timestamp(s.predictedAt) >= timestamp(s.kickoff)) reasons.push('not_prematch');
  if (s.dataComplete !== true) reasons.push('incomplete_inputs');
  if (!Number.isFinite(policy?.minProbability) || policy.minProbability < 0 || policy.minProbability > 1
    || !Number.isFinite(policy?.minLowerEV) || policy.minLowerEV < 0) reasons.push('invalid_policy');
  const expectedValue = (1 - s.pushProbability) * (s.probability * s.odds - 1);
  const lowerExpectedValue = (1 - s.pushProbability) * (s.lowerProbability * s.odds - 1);
  if (s.lowerProbability < policy?.minProbability || lowerExpectedValue <= policy?.minLowerEV) reasons.push('insufficient_evidence');
  return { action: reasons.length ? 'PASS' : 'ELIGIBLE', reasons, expectedValue,
    lowerExpectedValue, successProbability: s.probability * (1 - s.pushProbability) };
}
