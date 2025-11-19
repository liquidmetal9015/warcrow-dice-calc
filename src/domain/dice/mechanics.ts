import { DS } from './constants';
import type { Aggregate, Pool, FacesByColor, RNG, SymbolKey } from './types';
import type { RerollCondition, RepeatRollConfig, RepeatDiceConfig, DieRoll, RollResult, RerollValueWeights, RerollStats } from '../../types/reroll';
import { normalizeColor, isAttackColor } from './data';
import { applyDisarmedToRoll, applyVulnerableToRoll } from './policies';

export function blankAggregate(): Aggregate {
  return { hits: 0, blocks: 0, specials: 0, hollowHits: 0, hollowBlocks: 0, hollowSpecials: 0 };
}

export function countSymbolsFromFace(face: ReadonlyArray<SymbolKey>): Aggregate {
  const out = blankAggregate();
  for (const sym of face) {
    switch (sym) {
      case DS.HIT: out.hits++; break;
      case DS.BLOCK: out.blocks++; break;
      case DS.SPECIAL: out.specials++; break;
      case DS.HOLLOW_HIT: out.hollowHits++; break;
      case DS.HOLLOW_BLOCK: out.hollowBlocks++; break;
      case DS.HOLLOW_SPECIAL: out.hollowSpecials++; break;
    }
  }
  return out;
}

export function simulateDiceRoll(pool: Pool, facesByColor: FacesByColor, rng: RNG = Math.random): Aggregate {
  const agg = blankAggregate();
  for (const [color, countRaw] of Object.entries(pool)) {
    const count = Math.max(0, countRaw | 0);
    const colorKey = normalizeColor(color);
    const faces = facesByColor[colorKey];
    if (!faces) continue;
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(rng() * 8);
      const face = faces[idx] as readonly SymbolKey[];
      const rolled = countSymbolsFromFace(face);
      agg.hits += rolled.hits;
      agg.blocks += rolled.blocks;
      agg.specials += rolled.specials;
      agg.hollowHits += rolled.hollowHits;
      agg.hollowBlocks += rolled.hollowBlocks;
      agg.hollowSpecials += rolled.hollowSpecials;
    }
  }
  return agg;
}

export function computeDieStats(faces: ReadonlyArray<ReadonlyArray<SymbolKey>>, color: string) {
  const total = faces.length;
  let hitFaces = 0, blockFaces = 0, specialFaces = 0;
  for (const face of faces) {
    if (face.includes(DS.HIT)) hitFaces++;
    if (face.includes(DS.BLOCK)) blockFaces++;
    if (face.includes(DS.SPECIAL)) specialFaces++;
  }
  if (isAttackColor(color)) {
    return {
      primaryLabel: 'Hit',
      primaryPct: (hitFaces / total) * 100,
      secondaryLabel: 'Special',
      secondaryPct: (specialFaces / total) * 100
    };
  }
  return {
    primaryLabel: 'Block',
    primaryPct: (blockFaces / total) * 100,
    secondaryLabel: 'Special',
    secondaryPct: (specialFaces / total) * 100
  };
}

// ============================================================================
// Reroll Functionality
// ============================================================================

/**
 * Calculate expected value for a specific symbol from pool composition
 */
export function computePoolExpectedValue(
  pool: Pool,
  facesByColor: FacesByColor,
  symbol: keyof Aggregate
): number {
  let total = 0;
  
  for (const [color, count] of Object.entries(pool)) {
    const colorKey = normalizeColor(color);
    const faces = facesByColor[colorKey];
    if (!faces) continue;
    
    let colorTotal = 0;
    for (const face of faces) {
      const symbols = countSymbolsFromFace(face);
      colorTotal += symbols[symbol] || 0;
    }
    
    const colorExpected = colorTotal / 8; // average per die
    total += colorExpected * count;
  }
  
  return total; // total expected for entire pool
}

/**
 * Check if reroll condition is met
 */
export function shouldRerollAggregate(
  agg: Aggregate,
  condition: RerollCondition,
  pool: Pool,
  facesByColor: FacesByColor
): boolean {
  const actual = agg[condition.symbol] || 0;
  
  switch (condition.type) {
    case 'BelowExpected':
      const expected = computePoolExpectedValue(pool, facesByColor, condition.symbol);
      return actual < expected;
    
    case 'MinSymbol':
      return actual < (condition.threshold || 0);
    
    case 'NoSymbol':
      return actual === 0;
  }
  
  return false;
}

/**
 * Roll with detailed individual die tracking
 */
export function simulateDiceRollDetailed(
  pool: Pool,
  facesByColor: FacesByColor,
  rng: RNG = Math.random
): RollResult {
  const dice: DieRoll[] = [];
  const agg = blankAggregate();
  
  for (const [color, count] of Object.entries(pool)) {
    const colorKey = normalizeColor(color);
    const faces = facesByColor[colorKey];
    if (!faces) continue;
    
    for (let i = 0; i < count; i++) {
      const faceIndex = Math.floor(rng() * 8);
      const face = faces[faceIndex];
      if (!face) continue;
      const symbols = countSymbolsFromFace(face);
      
      dice.push({ color: colorKey, faceIndex, symbols });
      
      // Aggregate
      agg.hits += symbols.hits;
      agg.blocks += symbols.blocks;
      agg.specials += symbols.specials;
      agg.hollowHits += symbols.hollowHits;
      agg.hollowBlocks += symbols.hollowBlocks;
      agg.hollowSpecials += symbols.hollowSpecials;
    }
  }
  
  return { dice, aggregate: agg };
}

/**
 * Compute expected value per die color based on weights
 */
export function computeColorExpectedValues(
  facesByColor: FacesByColor,
  weights: RerollValueWeights
): Record<string, number> {
  const expectations: Record<string, number> = {};
  
  for (const [color, faces] of Object.entries(facesByColor)) {
    let totalValue = 0;
    
    for (const face of faces) {
      const symbols = countSymbolsFromFace(face);
      const value = (
        symbols.hits * weights.hits +
        symbols.blocks * weights.blocks +
        symbols.specials * weights.specials +
        symbols.hollowHits * weights.hollowHits +
        symbols.hollowBlocks * weights.hollowBlocks +
        symbols.hollowSpecials * weights.hollowSpecials
      );
      totalValue += value;
    }
    
    expectations[color] = totalValue / 8;
  }
  
  return expectations;
}

/**
 * Score individual die relative to its color's expected value
 */
export function scoreDie(
  die: DieRoll,
  weights: RerollValueWeights,
  colorExpectations: Record<string, number>
): number {
  const actualValue = (
    die.symbols.hits * weights.hits +
    die.symbols.blocks * weights.blocks +
    die.symbols.specials * weights.specials +
    die.symbols.hollowHits * weights.hollowHits +
    die.symbols.hollowBlocks * weights.hollowBlocks +
    die.symbols.hollowSpecials * weights.hollowSpecials
  );
  
  const expectedValue = colorExpectations[die.color] || 0;
  
  // Negative = underperformed, Positive = overperformed
  return actualValue - expectedValue;
}

/**
 * Select worst-performing dice to reroll
 * Only rerolls dice that are performing below their expected value
 */
export function selectDiceToReroll(
  dice: DieRoll[],
  maxRerolls: number,
  weights: RerollValueWeights,
  facesByColor: FacesByColor
): number[] {
  const colorExpectations = computeColorExpectedValues(facesByColor, weights);
  
  const scored = dice.map((die, idx) => ({
    idx,
    score: scoreDie(die, weights, colorExpectations)
  }));
  
  // Only consider dice with negative scores (below expected)
  const underperforming = scored.filter(s => s.score < 0);
  
  // Sort ascending (worst first)
  underperforming.sort((a, b) => a.score - b.score);
  
  // Return indices of worst N underperforming dice
  return underperforming.slice(0, Math.min(maxRerolls, underperforming.length)).map(s => s.idx);
}

/**
 * Get weights for priority mode
 * Only the target symbol has weight - everything else is 0
 */
export function getWeightsForPriorityMode(
  mode: 'hits' | 'blocks' | 'specials',
  countHollowAsFilled: boolean
): RerollValueWeights {
  const defaults = { hits: 0, blocks: 0, specials: 0, hollowHits: 0, hollowBlocks: 0, hollowSpecials: 0 };
  
  // Hollow symbols are worth 1 if elite promotion is active, 0 otherwise
  const hollowMultiplier = countHollowAsFilled ? 1 : 0;
  
  switch (mode) {
    case 'hits':
      return { 
        ...defaults, 
        hits: 1,
        hollowHits: hollowMultiplier
      };
    case 'blocks':
      return { 
        ...defaults, 
        blocks: 1,
        hollowBlocks: hollowMultiplier
      };
    case 'specials':
      return {
        ...defaults,
        specials: 1,
        hollowSpecials: hollowMultiplier
      };
    default:
      return defaults;
  }
}

/**
 * Internal helper to simulate a roll with optional full and selective rerolls.
 * Returns detailed dice when needed so that higher-level effects (like states)
 * can be applied on top.
 */
function rollWithRerollsInternal(
  pool: Pool,
  facesByColor: FacesByColor,
  repeatRollConfig: RepeatRollConfig | null,
  repeatDiceConfig: RepeatDiceConfig | null,
  rng: RNG,
  forceDetailed: boolean
): { dice: DieRoll[] | null; aggregate: Aggregate; stats: RerollStats } {
  let agg: Aggregate;
  let dice: DieRoll[] | null = null;
  let fullRerollsOccurred = 0;
  let diceRerolledCount = 0;

  const hasRepeatRoll = !!(repeatRollConfig && repeatRollConfig.enabled);
  const hasRepeatDice = !!(repeatDiceConfig && repeatDiceConfig.enabled);
  const needsDetailed = forceDetailed || hasRepeatDice;

  if (needsDetailed) {
    // Phase 1: Initial roll with detailed tracking
    let result = simulateDiceRollDetailed(pool, facesByColor, rng);
    dice = result.dice;
    agg = result.aggregate;

    // Phase 2: Full reroll if enabled and condition met
    if (hasRepeatRoll && repeatRollConfig && shouldRerollAggregate(agg, repeatRollConfig.condition, pool, facesByColor)) {
      result = simulateDiceRollDetailed(pool, facesByColor, rng);
      dice = result.dice;
      agg = result.aggregate;
      fullRerollsOccurred = 1;
    }

    // Phase 3: Selective reroll (repeat dice)
    if (hasRepeatDice && repeatDiceConfig) {
      const weights = getWeightsForPriorityMode(repeatDiceConfig.priorityMode, repeatDiceConfig.countHollowAsFilled);
      const toReroll = selectDiceToReroll(dice, repeatDiceConfig.maxDiceToReroll, weights, facesByColor);

      diceRerolledCount = toReroll.length;

      for (const idx of toReroll) {
        const die = dice[idx];
        if (!die) continue;
        const faces = facesByColor[die.color];
        if (!faces) continue;

        const newFaceIndex = Math.floor(rng() * 8);
        const newFace = faces[newFaceIndex];
        if (!newFace) continue;
        const newSymbols = countSymbolsFromFace(newFace);

        dice[idx] = { color: die.color, faceIndex: newFaceIndex, symbols: newSymbols };
      }

      // Re-aggregate after repeat dice
      agg = blankAggregate();
      for (const die of dice) {
        agg.hits += die.symbols.hits;
        agg.blocks += die.symbols.blocks;
        agg.specials += die.symbols.specials;
        agg.hollowHits += die.symbols.hollowHits;
        agg.hollowBlocks += die.symbols.hollowBlocks;
        agg.hollowSpecials += die.symbols.hollowSpecials;
      }
    }
  } else if (hasRepeatRoll && repeatRollConfig) {
    // Only full reroll enabled (no detailed tracking needed)
    agg = simulateDiceRoll(pool, facesByColor, rng);
    if (shouldRerollAggregate(agg, repeatRollConfig.condition, pool, facesByColor)) {
      agg = simulateDiceRoll(pool, facesByColor, rng); // reroll once
      fullRerollsOccurred = 1;
    }
  } else {
    // No rerolls at all
    agg = simulateDiceRoll(pool, facesByColor, rng);
  }

  return {
    dice,
    aggregate: agg,
    stats: {
      fullRerollsOccurred,
      diceRerolledCount,
      totalRolls: 1
    }
  };
}

/**
 * Simulate dice roll with both full and selective rerolls
 * Sequence: Initial roll → Full reroll (once if triggered) → Selective reroll (up to X dice)
 */
export function simulateDiceRollWithRerolls(
  pool: Pool,
  facesByColor: FacesByColor,
  repeatRollConfig: RepeatRollConfig | null,
  repeatDiceConfig: RepeatDiceConfig | null,
  rng: RNG = Math.random
): { aggregate: Aggregate; stats: RerollStats } {
  const { aggregate, stats } = rollWithRerollsInternal(
    pool,
    facesByColor,
    repeatRollConfig,
    repeatDiceConfig,
    rng,
    !!(repeatDiceConfig && repeatDiceConfig.enabled)
  );
  return { aggregate, stats };
}

/**
 * Simulate dice roll with rerolls and apply Disarmed/Vulnerable state effects.
 */
export function simulateDiceRollWithRerollsAndStates(
  pool: Pool,
  facesByColor: FacesByColor,
  repeatRollConfig: RepeatRollConfig | null,
  repeatDiceConfig: RepeatDiceConfig | null,
  options: { disarmed: boolean; vulnerable: boolean },
  rng: RNG = Math.random
): { aggregate: Aggregate; stats: RerollStats } {
  const needsStates = !!(options.disarmed || options.vulnerable);
  const { dice, aggregate, stats } = rollWithRerollsInternal(
    pool,
    facesByColor,
    repeatRollConfig,
    repeatDiceConfig,
    rng,
    needsStates
  );

  if (dice && options.disarmed) {
    applyDisarmedToRoll(dice, aggregate);
  }
  if (dice && options.vulnerable) {
    applyVulnerableToRoll(dice, aggregate);
  }

  return { aggregate, stats };
}

