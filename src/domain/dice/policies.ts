import { DS } from './constants';
import type { DieRoll } from '../../types/reroll';
import type { Aggregate } from './types';

type SymbolMetric = keyof Aggregate;
type ComparisonDirection = 'max' | 'min';

interface DieCancellationCriterion {
  symbol: SymbolMetric;
  direction: ComparisonDirection;
}

interface DieCancellationPolicy {
  criteria: DieCancellationCriterion[];
  required?: { symbol: SymbolMetric; min: number };
}

function selectDieToCancel(dice: DieRoll[], policy: DieCancellationPolicy): number {
  const candidates: Array<{ idx: number; die: DieRoll }> = [];

  for (let idx = 0; idx < dice.length; idx++) {
    const die = dice[idx];
    if (!die) continue;
    if (policy.required) {
      const value = die.symbols[policy.required.symbol] || 0;
      if (value < policy.required.min) continue;
    }
    candidates.push({ idx, die });
  }

  if (!candidates.length) return -1;

  let bestIdx = candidates[0]!.idx;

  for (let i = 1; i < candidates.length; i++) {
    const candidate = candidates[i]!;
    let isBetter = false;
    const currentDie = dice[bestIdx]!;
    const nextDie = candidate.die;

    for (const criterion of policy.criteria) {
      const aVal = nextDie.symbols[criterion.symbol] || 0;
      const bVal = currentDie.symbols[criterion.symbol] || 0;
      if (aVal === bVal) continue;

      if (criterion.direction === 'max') {
        if (aVal > bVal) isBetter = true;
      } else {
        if (aVal < bVal) isBetter = true;
      }
      // First differing criterion decides
      break;
    }

    if (isBetter) {
      bestIdx = candidate.idx;
    }
  }

  return bestIdx;
}

const DISARMED_POLICY: DieCancellationPolicy = {
  required: { symbol: 'hits', min: 1 },
  criteria: [
    { symbol: 'hits', direction: 'max' },
    { symbol: 'specials', direction: 'max' }
  ]
};

const VULNERABLE_POLICY: DieCancellationPolicy = {
  required: { symbol: 'blocks', min: 1 },
  criteria: [
    { symbol: 'blocks', direction: 'max' },
    { symbol: 'specials', direction: 'max' }
  ]
};

/**
 * Apply Disarmed: cancel the die with the most filled hits.
 * Hollow symbols are ignored for the selection heuristic but still removed
 * from the aggregate when that die is canceled.
 */
export function applyDisarmedToRoll(dice: DieRoll[], aggregate: Aggregate): void {
  const bestIndex = selectDieToCancel(dice, DISARMED_POLICY);
  if (bestIndex === -1) return;

  const die = dice[bestIndex];
  if (!die) return;

  aggregate.hits = Math.max(0, (aggregate.hits || 0) - (die.symbols.hits || 0));
  aggregate.blocks = Math.max(0, (aggregate.blocks || 0) - (die.symbols.blocks || 0));
  aggregate.specials = Math.max(0, (aggregate.specials || 0) - (die.symbols.specials || 0));
  aggregate.hollowHits = Math.max(0, (aggregate.hollowHits || 0) - (die.symbols.hollowHits || 0));
  aggregate.hollowBlocks = Math.max(0, (aggregate.hollowBlocks || 0) - (die.symbols.hollowBlocks || 0));
  aggregate.hollowSpecials = Math.max(0, (aggregate.hollowSpecials || 0) - (die.symbols.hollowSpecials || 0));

  die.symbols = { hits: 0, blocks: 0, specials: 0, hollowHits: 0, hollowBlocks: 0, hollowSpecials: 0 };
}

/**
 * Apply Vulnerable: cancel the die with the most filled blocks.
 * Hollow symbols are ignored for the selection heuristic but still removed
 * from the aggregate when that die is canceled.
 */
export function applyVulnerableToRoll(dice: DieRoll[], aggregate: Aggregate): void {
  const bestIndex = selectDieToCancel(dice, VULNERABLE_POLICY);
  if (bestIndex === -1) return;

  const die = dice[bestIndex];
  if (!die) return;

  aggregate.hits = Math.max(0, (aggregate.hits || 0) - (die.symbols.hits || 0));
  aggregate.blocks = Math.max(0, (aggregate.blocks || 0) - (die.symbols.blocks || 0));
  aggregate.specials = Math.max(0, (aggregate.specials || 0) - (die.symbols.specials || 0));
  aggregate.hollowHits = Math.max(0, (aggregate.hollowHits || 0) - (die.symbols.hollowHits || 0));
  aggregate.hollowBlocks = Math.max(0, (aggregate.hollowBlocks || 0) - (die.symbols.hollowBlocks || 0));
  aggregate.hollowSpecials = Math.max(0, (aggregate.hollowSpecials || 0) - (die.symbols.hollowSpecials || 0));

  die.symbols = { hits: 0, blocks: 0, specials: 0, hollowHits: 0, hollowBlocks: 0, hollowSpecials: 0 };
}

