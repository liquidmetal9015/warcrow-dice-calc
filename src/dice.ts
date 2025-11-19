export type SymbolKey = 'HIT' | 'HOLLOW_HIT' | 'BLOCK' | 'HOLLOW_BLOCK' | 'SPECIAL' | 'HOLLOW_SPECIAL';

export const DS = Object.freeze({
  HIT: 'HIT',
  HOLLOW_HIT: 'HOLLOW_HIT',
  BLOCK: 'BLOCK',
  HOLLOW_BLOCK: 'HOLLOW_BLOCK',
  SPECIAL: 'SPECIAL',
  HOLLOW_SPECIAL: 'HOLLOW_SPECIAL'
} as const);

export type Aggregate = {
  hits: number;
  blocks: number;
  specials: number;
  hollowHits: number;
  hollowBlocks: number;
  hollowSpecials: number;
};

export type Pool = Record<string, number>;
export type FacesByColor = Record<string, ReadonlyArray<ReadonlyArray<SymbolKey>>>;
export type RNG = () => number;

export function normalizeColor(color: string): string {
  switch (color) {
    case 'Red': return 'RED';
    case 'Orange': return 'ORANGE';
    case 'Yellow': return 'YELLOW';
    case 'Green': return 'GREEN';
    case 'Blue': return 'BLUE';
    case 'Black': return 'BLACK';
    default: return String(color).toUpperCase();
  }
}

export function isAttackColor(color: string): boolean {
  return color === 'RED' || color === 'ORANGE' || color === 'YELLOW';
}

export async function loadDiceFaces(): Promise<FacesByColor> {
  const base = import.meta.env.BASE_URL || '/';
  const path = base.endsWith('/') ? base + 'warcrow_dice_faces.json' : base + '/warcrow_dice_faces.json';
  const resp = await fetch(path, { cache: 'no-store' });
  if (!resp.ok) throw new Error('Failed to load warcrow_dice_faces.json');
  const faces = (await resp.json()) as FacesByColor;
  // Basic validation: each die should have 8 faces
  for (const color of Object.keys(faces)) {
    const arr = faces[color];
    if (!Array.isArray(arr) || arr.length !== 8) {
      throw new Error(`Die ${color} must have exactly 8 faces`);
    }
  }
  return faces;
}

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

// --- Simulation Types ---
export type Distribution = Record<number, number>;
export type JointDistribution = Record<number, Record<number, number>>;

export interface AnalysisExpected {
  hits: number; blocks: number; specials: number; hollowHits: number; hollowBlocks: number; hollowSpecials: number;
}

export interface AnalysisStd { hits: number; blocks: number; specials: number; }

export interface MonteCarloResults {
  hits: Distribution;
  blocks: Distribution;
  specials: Distribution;
  hollowHits: Distribution;
  hollowBlocks: Distribution;
  hollowSpecials: Distribution;
  totalHits: Distribution;
  totalBlocks: Distribution;
  totalSpecials: Distribution;
  jointHitsSpecialsFilled: JointDistribution;
  jointBlocksSpecialsFilled: JointDistribution;
  jointHitsSpecialsHollow: JointDistribution;
  jointBlocksSpecialsHollow: JointDistribution;
  jointHitsSpecialsTotal: JointDistribution;
  jointBlocksSpecialsTotal: JointDistribution;
  expected: AnalysisExpected;
  std: AnalysisStd;
  timestamp: string;
  rerollStats?: RerollStats;
}

import { incJoint, normalizeDistribution, normalizeJoint } from './utils/distribution';
import { runAnalysis, runCombat } from './services/simulation';

function applyPipelineToAggregate(pre: Aggregate, pipeline?: { applyPost?: (state: { dice: unknown[]; rollDetails: unknown[]; aggregate: Aggregate }) => void }): Aggregate {
  if (!pipeline || typeof pipeline.applyPost !== 'function') return pre;
  const state = { dice: [], rollDetails: [], aggregate: { ...pre } };
  pipeline.applyPost(state);
  return state.aggregate;
}

export async function performMonteCarloSimulation(
  pool: Pool,
  facesByColor: FacesByColor,
  simulationCount: number,
  rng: RNG = Math.random
): Promise<MonteCarloResults> {
  return runAnalysis({ pool, facesByColor, simulationCount, rng, roll: simulateDiceRoll });
}

export async function performMonteCarloSimulationWithPipeline(
  pool: Pool,
  facesByColor: FacesByColor,
  simulationCount: number,
  pipeline: { applyPost?: (state: { dice: unknown[]; rollDetails: unknown[]; aggregate: Aggregate }) => void },
  rng: RNG = Math.random,
  repeatRollConfig?: RepeatRollConfig | null,
  repeatDiceConfig?: RepeatDiceConfig | null,
  disarmed: boolean = false,
  vulnerable: boolean = false
): Promise<MonteCarloResults> {
  return runAnalysis({
    pool,
    facesByColor,
    simulationCount,
    rng,
    roll: simulateDiceRoll,
    transformAggregate: (pre) => applyPipelineToAggregate(pre, pipeline),
    repeatRollConfig: repeatRollConfig || null,
    repeatDiceConfig: repeatDiceConfig || null,
    disarmed,
    vulnerable
  });
}

export interface CombatExpected {
  attackerHits: number; attackerSpecials: number; attackerBlocks: number;
  defenderHits: number; defenderSpecials: number; defenderBlocks: number;
  woundsAttacker: number; woundsDefender: number;
}

export interface CombatResults {
  woundsAttacker: Distribution;
  woundsDefender: Distribution;
  attackerSpecialsDist: Distribution;
  defenderSpecialsDist: Distribution;
  expected: CombatExpected;
  attackerWinRate: number; attackerTieRate: number; attackerLossRate: number;
  timestamp: string;
}

export async function performCombatSimulation(
  attackerPool: Pool,
  defenderPool: Pool,
  facesByColor: FacesByColor,
  simulationCount: number,
  rng: RNG = Math.random
): Promise<CombatResults> {
  return runCombat({ attackerPool, defenderPool, facesByColor, simulationCount, rng, roll: simulateDiceRoll });
}

export async function performCombatSimulationWithPipeline(
  attackerPool: Pool,
  defenderPool: Pool,
  facesByColor: FacesByColor,
  simulationCount: number,
  attackerPipeline: { applyPost?: (state: { dice: unknown[]; rollDetails: unknown[]; aggregate: Aggregate }) => void; applyCombat?: (self: Aggregate, opp: Aggregate, role: 'attacker'|'defender') => void },
  defenderPipeline: { applyPost?: (state: { dice: unknown[]; rollDetails: unknown[]; aggregate: Aggregate }) => void; applyCombat?: (self: Aggregate, opp: Aggregate, role: 'attacker'|'defender') => void },
  attackerRepeatRollConfig: RepeatRollConfig | null = null,
  attackerRepeatDiceConfig: RepeatDiceConfig | null = null,
  defenderRepeatRollConfig: RepeatRollConfig | null = null,
  defenderRepeatDiceConfig: RepeatDiceConfig | null = null,
  rng: RNG = Math.random,
  attackerDisarmed: boolean = false,
  defenderVulnerable: boolean = false
): Promise<CombatResults> {
  return runCombat({
    attackerPool,
    defenderPool,
    facesByColor,
    simulationCount,
    rng,
    roll: simulateDiceRoll,
    transforms: {
      attacker: {
        transformAggregate: (pre) => applyPipelineToAggregate(pre, attackerPipeline),
        applyCombat: attackerPipeline && typeof attackerPipeline.applyCombat === 'function'
          ? (self, opp) => attackerPipeline.applyCombat!(self, opp, 'attacker')
          : undefined
      },
      defender: {
        transformAggregate: (pre) => applyPipelineToAggregate(pre, defenderPipeline),
        applyCombat: defenderPipeline && typeof defenderPipeline.applyCombat === 'function'
          ? (self, opp) => defenderPipeline.applyCombat!(self, opp, 'defender')
          : undefined
      }
    },
    attackerRepeatRollConfig,
    attackerRepeatDiceConfig,
    defenderRepeatRollConfig,
    defenderRepeatDiceConfig,
    attackerDisarmed,
    defenderVulnerable
  });
}

// ============================================================================
// Reroll Functionality
// ============================================================================

import type {
  RerollCondition,
  RepeatRollConfig,
  DieRoll,
  RollResult,
  RerollValueWeights,
  RepeatDiceConfig,
  RerollStats
} from './types/reroll';

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

// ============================================================================
// Die cancellation policies (for Disarmed / Vulnerable and future extensions)
// ============================================================================

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


