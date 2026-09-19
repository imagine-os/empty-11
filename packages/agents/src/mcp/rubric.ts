/**
 * Recomputing a catalogue entry's rubric total (PAP-209 rubric, section 1 and section 3).
 *
 * The total is stored in the catalogue so a reader does not have to do arithmetic, and it is
 * recomputed here so a stored number can never drift from the scores it claims to summarise.
 * A test asserts the two agree for every server, which is what makes the stored number worth
 * reading at all.
 *
 * Two rescalings, in this order:
 *   1. Extras take their weight out of the base six, which rescale proportionally to
 *      `100 - sum(extra weights)`.
 *   2. Any base criterion scored `na` drops out, and the remaining base weights rescale
 *      proportionally to fill the base budget again.
 */
import {
  RUBRIC_CRITERIA,
  type RubricCriterion,
  type RubricScore,
  type Scorecard,
} from './schema.js';

export interface RubricConfig {
  baseWeights: Record<string, number>;
  domainExtras: Record<string, { weight: number }>;
  thresholds: { adopt: number; trial: number };
}

export interface ComputedRubric {
  /** The weight actually applied to each scored criterion, after both rescalings. */
  rescaledWeights: Record<string, number>;
  total: number;
  verdict: 'adopt' | 'trial' | 'reject';
}

function isScored(score: RubricScore): score is number {
  return score !== 'na';
}

export function computeRubric(card: Scorecard, config: RubricConfig): ComputedRubric {
  const extraWeight = card.extras.reduce((sum, extra) => {
    const declared = config.domainExtras[extra.id];
    if (declared === undefined) throw new Error(`unknown domain extra: ${extra.id}`);
    return sum + declared.weight;
  }, 0);

  const baseBudget = 100 - extraWeight;
  if (baseBudget <= 0) throw new Error('extras may not consume the whole rubric');

  const scoredBase: RubricCriterion[] = RUBRIC_CRITERIA.filter((id) =>
    isScored(card.scores[id].score),
  );
  const scoredBaseWeight = scoredBase.reduce((sum, id) => sum + (config.baseWeights[id] ?? 0), 0);
  if (scoredBaseWeight <= 0) throw new Error('every base criterion is n/a; nothing to score');

  const rescaledWeights: Record<string, number> = {};
  let total = 0;

  for (const id of scoredBase) {
    const weight = ((config.baseWeights[id] ?? 0) / scoredBaseWeight) * baseBudget;
    rescaledWeights[id] = weight;
    const score = card.scores[id].score;
    if (isScored(score)) total += (score / 4) * weight;
  }

  for (const extra of card.extras) {
    const score = extra.score;
    // An extra is listed only when its facts exist, so `na` here is a mistake, not a rescaling
    // case: silently dropping it would hand the candidate its weight for free.
    if (!isScored(score))
      throw new Error(`domain extra ${extra.id} is scored na; remove it instead`);
    const weight = config.domainExtras[extra.id]?.weight ?? 0;
    rescaledWeights[extra.id] = weight;
    total += (score / 4) * weight;
  }

  const rounded = Math.round(total);
  const verdict =
    rounded >= config.thresholds.adopt
      ? 'adopt'
      : rounded >= config.thresholds.trial
        ? 'trial'
        : 'reject';

  return { rescaledWeights, total: rounded, verdict };
}
