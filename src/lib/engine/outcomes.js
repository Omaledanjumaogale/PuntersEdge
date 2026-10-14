/** Discretize normal scores with continuity correction, keeping pushes separate. */
import { normalCdf } from './math.js';
/** @param {number} mean @param {number} sd @param {number} threshold */
export function normalOutcomes(mean, sd, threshold) {
  if (![mean, sd, threshold].every(Number.isFinite) || sd <= 0 || !Number.isInteger(threshold * 2))
    throw new Error('Only finite whole/half lines and positive dispersion are supported');
  const integer = Number.isInteger(threshold);
  const lose = normalCdf(integer ? threshold - .5 : threshold, mean, sd);
  const win = 1 - normalCdf(integer ? threshold + .5 : threshold, mean, sd);
  const push = Math.max(0, 1-win-lose);
  return { win, lose, push, conditional: win / (win+lose) };
}
/** Infer a mean from a whole/half line's conditional, de-vigged probability.
 * @param {number} threshold @param {number} sd @param {number} probability */
export function normalMeanFromPrice(threshold, sd, probability) {
  if (!(probability>0 && probability<1)) throw new Error('Invalid probability');
  let low=threshold-12*sd, high=threshold+12*sd;
  for(let i=0;i<60;i++){const mid=(low+high)/2;if(normalOutcomes(mid,sd,threshold).conditional<probability)low=mid;else high=mid;}
  return (low+high)/2;
}
