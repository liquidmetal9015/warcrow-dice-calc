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

// Fixed dice configuration for "fix" mechanic
export type FixedDie = {
  color: string; // Normalized color (RED, ORANGE, etc.)
  faceIndex: number; // 0-7, which face to fix
};

export type FixedDiceConfig = FixedDie[];

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

// Aggregate manipulation utilities
export function addAggregates(target: Aggregate, source: Aggregate): void {
  target.hits += source.hits;
  target.blocks += source.blocks;
  target.specials += source.specials;
  target.hollowHits += source.hollowHits;
  target.hollowBlocks += source.hollowBlocks;
  target.hollowSpecials += source.hollowSpecials;
}

export function subtractAggregates(target: Aggregate, source: Aggregate): void {
  target.hits = Math.max(0, target.hits - source.hits);
  target.blocks = Math.max(0, target.blocks - source.blocks);
  target.specials = Math.max(0, target.specials - source.specials);
  target.hollowHits = Math.max(0, target.hollowHits - source.hollowHits);
  target.hollowBlocks = Math.max(0, target.hollowBlocks - source.hollowBlocks);
  target.hollowSpecials = Math.max(0, target.hollowSpecials - source.hollowSpecials);
}

export function combineAggregates(a: Aggregate, b: Aggregate): Aggregate {
  const result = blankAggregate();
  addAggregates(result, a);
  addAggregates(result, b);
  return result;
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

/**
 * Simulate dice roll with fixed dice applied first.
 * Fixed dice are deterministic and not rolled.
 * Remaining dice in the pool are rolled normally.
 * 
 * @param pool - Full dice pool (includes dice to be fixed)
 * @param fixedDice - Array of fixed dice configurations
 * @param facesByColor - Die face definitions
 * @param rng - Random number generator
 * @returns Aggregate of all symbols (fixed + rolled)
 */
export function simulateDiceRollWithFixed(
  pool: Pool,
  fixedDice: FixedDiceConfig,
  facesByColor: FacesByColor,
  rng: RNG = Math.random
): Aggregate {
  const agg = blankAggregate();
  
  // Step 1: Process fixed dice (deterministic)
  const fixedCounts: Pool = {};
  for (const fixed of fixedDice) {
    const colorKey = normalizeColor(fixed.color);
    const faces = facesByColor[colorKey];
    if (!faces) continue;
    
    // Validate face index
    const faceIndex = Math.max(0, Math.min(7, Math.floor(fixed.faceIndex)));
    const face = faces[faceIndex] as readonly SymbolKey[];
    const symbols = countSymbolsFromFace(face);
    
    // Add to aggregate
    addAggregates(agg, symbols);
    
    // Track how many fixed dice per color
    fixedCounts[colorKey] = (fixedCounts[colorKey] || 0) + 1;
  }
  
  // Step 2: Create reduced pool (subtract fixed dice)
  const reducedPool: Pool = {};
  for (const [color, count] of Object.entries(pool)) {
    const colorKey = normalizeColor(color);
    const fixedCount = fixedCounts[colorKey] || 0;
    const remainingCount = Math.max(0, count - fixedCount);
    if (remainingCount > 0) {
      reducedPool[colorKey] = remainingCount;
    }
  }
  
  // Step 3: Roll remaining dice normally
  const rolledAgg = simulateDiceRoll(reducedPool, facesByColor, rng);
  
  // Step 4: Combine fixed and rolled aggregates
  addAggregates(agg, rolledAgg);
  
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
  rng: RNG = Math.random
): Promise<MonteCarloResults> {
  return runAnalysis({
    pool,
    facesByColor,
    simulationCount,
    rng,
    roll: simulateDiceRoll,
    transformAggregate: (pre) => applyPipelineToAggregate(pre, pipeline)
  });
}

export async function performMonteCarloSimulationWithFixed(
  pool: Pool,
  facesByColor: FacesByColor,
  simulationCount: number,
  fixedDice: FixedDiceConfig,
  pipeline?: { applyPost?: (state: { dice: unknown[]; rollDetails: unknown[]; aggregate: Aggregate }) => void },
  rng: RNG = Math.random
): Promise<MonteCarloResults> {
  return runAnalysis({
    pool,
    facesByColor,
    simulationCount,
    rng,
    roll: (p, f, r) => simulateDiceRollWithFixed(p, fixedDice, f, r),
    transformAggregate: pipeline ? (pre) => applyPipelineToAggregate(pre, pipeline) : undefined,
    fixedDice
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
  rng: RNG = Math.random
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
    }
  });
}

export async function performCombatSimulationWithFixed(
  attackerPool: Pool,
  defenderPool: Pool,
  facesByColor: FacesByColor,
  simulationCount: number,
  attackerFixedDice: FixedDiceConfig,
  defenderFixedDice: FixedDiceConfig,
  attackerPipeline?: { applyPost?: (state: { dice: unknown[]; rollDetails: unknown[]; aggregate: Aggregate }) => void; applyCombat?: (self: Aggregate, opp: Aggregate, role: 'attacker'|'defender') => void },
  defenderPipeline?: { applyPost?: (state: { dice: unknown[]; rollDetails: unknown[]; aggregate: Aggregate }) => void; applyCombat?: (self: Aggregate, opp: Aggregate, role: 'attacker'|'defender') => void },
  rng: RNG = Math.random
): Promise<CombatResults> {
  return runCombat({
    attackerPool,
    defenderPool,
    facesByColor,
    simulationCount,
    rng,
    roll: simulateDiceRoll, // Base roll function, fixed dice applied via wrapper
    attackerFixedDice,
    defenderFixedDice,
    transforms: {
      attacker: {
        transformAggregate: attackerPipeline ? (pre) => applyPipelineToAggregate(pre, attackerPipeline) : undefined,
        applyCombat: attackerPipeline && typeof attackerPipeline.applyCombat === 'function'
          ? (self, opp) => attackerPipeline.applyCombat!(self, opp, 'attacker')
          : undefined
      },
      defender: {
        transformAggregate: defenderPipeline ? (pre) => applyPipelineToAggregate(pre, defenderPipeline) : undefined,
        applyCombat: defenderPipeline && typeof defenderPipeline.applyCombat === 'function'
          ? (self, opp) => defenderPipeline.applyCombat!(self, opp, 'defender')
          : undefined
      }
    }
  });
}


