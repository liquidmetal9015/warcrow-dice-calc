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


