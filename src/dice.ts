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
  const resp = await fetch('warcrow_dice_faces.json', { cache: 'no-store' });
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

export function simulateDiceRoll(pool: Pool, facesByColor: FacesByColor, _isElite: boolean, rng: RNG = Math.random): Aggregate {
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

function incJoint(map: JointDistribution, x: number, y: number) {
  if (!map[x]) map[x] = {} as Record<number, number>;
  map[x][y] = (map[x][y] || 0) + 1;
}

function normalizeDistribution(map: Distribution, n: number) {
  for (const k of Object.keys(map)) {
    const key = Number(k);
    const current = map[key] ?? 0;
    map[key] = (current / n) * 100;
  }
}

function normalizeJoint(map: JointDistribution, n: number) {
  for (const x of Object.keys(map)) {
    const xi = Number(x);
    const row = map[xi];
    if (!row) { map[xi] = {}; continue; }
    for (const y of Object.keys(row)) {
      const yi = Number(y);
      const val = row[yi] || 0;
      row[yi] = (val / n) * 100;
    }
    map[xi] = row;
  }
}

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
  isElite: boolean,
  rng: RNG = Math.random
): Promise<MonteCarloResults> {
  const results: MonteCarloResults = {
    hits: {}, blocks: {}, specials: {}, hollowHits: {}, hollowBlocks: {}, hollowSpecials: {},
    totalHits: {}, totalBlocks: {}, totalSpecials: {},
    jointHitsSpecialsFilled: {}, jointBlocksSpecialsFilled: {}, jointHitsSpecialsHollow: {}, jointBlocksSpecialsHollow: {}, jointHitsSpecialsTotal: {}, jointBlocksSpecialsTotal: {},
    expected: { hits: 0, blocks: 0, specials: 0, hollowHits: 0, hollowBlocks: 0, hollowSpecials: 0 },
    std: { hits: 0, blocks: 0, specials: 0 },
    timestamp: new Date().toLocaleTimeString()
  };

  let sumSqHits = 0, sumSqBlocks = 0, sumSqSpecials = 0;
  for (let i = 0; i < simulationCount; i++) {
    const roll = simulateDiceRoll(pool, facesByColor, isElite, rng);
    results.hits[roll.hits] = (results.hits[roll.hits] || 0) + 1;
    results.blocks[roll.blocks] = (results.blocks[roll.blocks] || 0) + 1;
    results.specials[roll.specials] = (results.specials[roll.specials] || 0) + 1;
    results.hollowHits[roll.hollowHits] = (results.hollowHits[roll.hollowHits] || 0) + 1;
    results.hollowBlocks[roll.hollowBlocks] = (results.hollowBlocks[roll.hollowBlocks] || 0) + 1;
    results.hollowSpecials[roll.hollowSpecials] = (results.hollowSpecials[roll.hollowSpecials] || 0) + 1;

    const totalHits = roll.hits + roll.hollowHits;
    const totalBlocks = roll.blocks + roll.hollowBlocks;
    const totalSpecials = roll.specials + roll.hollowSpecials;
    results.totalHits[totalHits] = (results.totalHits[totalHits] || 0) + 1;
    results.totalBlocks[totalBlocks] = (results.totalBlocks[totalBlocks] || 0) + 1;
    results.totalSpecials[totalSpecials] = (results.totalSpecials[totalSpecials] || 0) + 1;

    incJoint(results.jointHitsSpecialsFilled, roll.hits, roll.specials);
    incJoint(results.jointBlocksSpecialsFilled, roll.blocks, roll.specials);
    incJoint(results.jointHitsSpecialsHollow, roll.hollowHits, roll.hollowSpecials);
    incJoint(results.jointBlocksSpecialsHollow, roll.hollowBlocks, roll.hollowSpecials);
    incJoint(results.jointHitsSpecialsTotal, totalHits, totalSpecials);
    incJoint(results.jointBlocksSpecialsTotal, totalBlocks, totalSpecials);

    results.expected.hits += roll.hits;
    results.expected.blocks += roll.blocks;
    results.expected.specials += roll.specials;
    results.expected.hollowHits += roll.hollowHits;
    results.expected.hollowBlocks += roll.hollowBlocks;
    results.expected.hollowSpecials += roll.hollowSpecials;

    sumSqHits += roll.hits * roll.hits;
    sumSqBlocks += roll.blocks * roll.blocks;
    sumSqSpecials += roll.specials * roll.specials;
  }

  normalizeDistribution(results.hits, simulationCount);
  normalizeDistribution(results.blocks, simulationCount);
  normalizeDistribution(results.specials, simulationCount);
  normalizeDistribution(results.hollowHits, simulationCount);
  normalizeDistribution(results.hollowBlocks, simulationCount);
  normalizeDistribution(results.hollowSpecials, simulationCount);
  normalizeDistribution(results.totalHits, simulationCount);
  normalizeDistribution(results.totalBlocks, simulationCount);
  normalizeDistribution(results.totalSpecials, simulationCount);
  normalizeJoint(results.jointHitsSpecialsFilled, simulationCount);
  normalizeJoint(results.jointBlocksSpecialsFilled, simulationCount);
  normalizeJoint(results.jointHitsSpecialsHollow, simulationCount);
  normalizeJoint(results.jointBlocksSpecialsHollow, simulationCount);
  normalizeJoint(results.jointHitsSpecialsTotal, simulationCount);
  normalizeJoint(results.jointBlocksSpecialsTotal, simulationCount);

  results.expected.hits /= simulationCount;
  results.expected.blocks /= simulationCount;
  results.expected.specials /= simulationCount;
  results.expected.hollowHits /= simulationCount;
  results.expected.hollowBlocks /= simulationCount;
  results.expected.hollowSpecials /= simulationCount;

  const meanH = results.expected.hits;
  const meanB = results.expected.blocks;
  const meanS = results.expected.specials;
  const varH = Math.max(0, (sumSqHits / simulationCount) - (meanH * meanH));
  const varB = Math.max(0, (sumSqBlocks / simulationCount) - (meanB * meanB));
  const varS = Math.max(0, (sumSqSpecials / simulationCount) - (meanS * meanS));
  results.std.hits = Math.sqrt(varH);
  results.std.blocks = Math.sqrt(varB);
  results.std.specials = Math.sqrt(varS);

  return results;
}

export async function performMonteCarloSimulationWithPipeline(
  pool: Pool,
  facesByColor: FacesByColor,
  simulationCount: number,
  pipeline: { applyPost?: (state: { dice: unknown[]; rollDetails: unknown[]; aggregate: Aggregate }) => void },
  rng: RNG = Math.random
): Promise<MonteCarloResults> {
  const results: MonteCarloResults = {
    hits: {}, blocks: {}, specials: {}, hollowHits: {}, hollowBlocks: {}, hollowSpecials: {},
    totalHits: {}, totalBlocks: {}, totalSpecials: {},
    jointHitsSpecialsFilled: {}, jointBlocksSpecialsFilled: {}, jointHitsSpecialsHollow: {}, jointBlocksSpecialsHollow: {}, jointHitsSpecialsTotal: {}, jointBlocksSpecialsTotal: {},
    expected: { hits: 0, blocks: 0, specials: 0, hollowHits: 0, hollowBlocks: 0, hollowSpecials: 0 },
    std: { hits: 0, blocks: 0, specials: 0 },
    timestamp: new Date().toLocaleTimeString()
  };

  let sumSqHits = 0, sumSqBlocks = 0, sumSqSpecials = 0;
  for (let i = 0; i < simulationCount; i++) {
    const pre = simulateDiceRoll(pool, facesByColor, false, rng);
    const roll = applyPipelineToAggregate(pre, pipeline);

    results.hits[roll.hits] = (results.hits[roll.hits] || 0) + 1;
    results.blocks[roll.blocks] = (results.blocks[roll.blocks] || 0) + 1;
    results.specials[roll.specials] = (results.specials[roll.specials] || 0) + 1;
    results.hollowHits[roll.hollowHits] = (results.hollowHits[roll.hollowHits] || 0) + 1;
    results.hollowBlocks[roll.hollowBlocks] = (results.hollowBlocks[roll.hollowBlocks] || 0) + 1;
    results.hollowSpecials[roll.hollowSpecials] = (results.hollowSpecials[roll.hollowSpecials] || 0) + 1;

    const totalHits = (roll.hits || 0) + (roll.hollowHits || 0);
    const totalBlocks = (roll.blocks || 0) + (roll.hollowBlocks || 0);
    const totalSpecials = (roll.specials || 0) + (roll.hollowSpecials || 0);
    results.totalHits[totalHits] = (results.totalHits[totalHits] || 0) + 1;
    results.totalBlocks[totalBlocks] = (results.totalBlocks[totalBlocks] || 0) + 1;
    results.totalSpecials[totalSpecials] = (results.totalSpecials[totalSpecials] || 0) + 1;

    incJoint(results.jointHitsSpecialsFilled, roll.hits, roll.specials);
    incJoint(results.jointBlocksSpecialsFilled, roll.blocks, roll.specials);
    incJoint(results.jointHitsSpecialsHollow, roll.hollowHits, roll.hollowSpecials);
    incJoint(results.jointBlocksSpecialsHollow, roll.hollowBlocks, roll.hollowSpecials);
    incJoint(results.jointHitsSpecialsTotal, totalHits, totalSpecials);
    incJoint(results.jointBlocksSpecialsTotal, totalBlocks, totalSpecials);

    results.expected.hits += roll.hits || 0;
    results.expected.blocks += roll.blocks || 0;
    results.expected.specials += roll.specials || 0;
    results.expected.hollowHits += roll.hollowHits || 0;
    results.expected.hollowBlocks += roll.hollowBlocks || 0;
    results.expected.hollowSpecials += roll.hollowSpecials || 0;

    sumSqHits += (roll.hits || 0) * (roll.hits || 0);
    sumSqBlocks += (roll.blocks || 0) * (roll.blocks || 0);
    sumSqSpecials += (roll.specials || 0) * (roll.specials || 0);
  }

  normalizeDistribution(results.hits, simulationCount);
  normalizeDistribution(results.blocks, simulationCount);
  normalizeDistribution(results.specials, simulationCount);
  normalizeDistribution(results.hollowHits, simulationCount);
  normalizeDistribution(results.hollowBlocks, simulationCount);
  normalizeDistribution(results.hollowSpecials, simulationCount);
  normalizeDistribution(results.totalHits, simulationCount);
  normalizeDistribution(results.totalBlocks, simulationCount);
  normalizeDistribution(results.totalSpecials, simulationCount);
  normalizeJoint(results.jointHitsSpecialsFilled, simulationCount);
  normalizeJoint(results.jointBlocksSpecialsFilled, simulationCount);
  normalizeJoint(results.jointHitsSpecialsHollow, simulationCount);
  normalizeJoint(results.jointBlocksSpecialsHollow, simulationCount);
  normalizeJoint(results.jointHitsSpecialsTotal, simulationCount);
  normalizeJoint(results.jointBlocksSpecialsTotal, simulationCount);

  results.expected.hits /= simulationCount;
  results.expected.blocks /= simulationCount;
  results.expected.specials /= simulationCount;
  results.expected.hollowHits /= simulationCount;
  results.expected.hollowBlocks /= simulationCount;
  results.expected.hollowSpecials /= simulationCount;

  const meanH = results.expected.hits;
  const meanB = results.expected.blocks;
  const meanS = results.expected.specials;
  const varH = Math.max(0, (sumSqHits / simulationCount) - (meanH * meanH));
  const varB = Math.max(0, (sumSqBlocks / simulationCount) - (meanB * meanB));
  const varS = Math.max(0, (sumSqSpecials / simulationCount) - (meanS * meanS));
  results.std.hits = Math.sqrt(varH);
  results.std.blocks = Math.sqrt(varB);
  results.std.specials = Math.sqrt(varS);

  return results;
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
  isAttackerElite: boolean,
  isDefenderElite: boolean,
  rng: RNG = Math.random
): Promise<CombatResults> {
  const results: CombatResults = {
    woundsAttacker: {}, woundsDefender: {}, attackerSpecialsDist: {}, defenderSpecialsDist: {},
    expected: { attackerHits: 0, attackerSpecials: 0, attackerBlocks: 0, defenderHits: 0, defenderSpecials: 0, defenderBlocks: 0, woundsAttacker: 0, woundsDefender: 0 },
    attackerWinRate: 0, attackerTieRate: 0, attackerLossRate: 0,
    timestamp: new Date().toLocaleTimeString()
  };

  let attackerWins = 0, attackerTies = 0, attackerLosses = 0;
  for (let i = 0; i < simulationCount; i++) {
    const attackerRoll = simulateDiceRoll(attackerPool, facesByColor, isAttackerElite, rng);
    const defenderRoll = simulateDiceRoll(defenderPool, facesByColor, isDefenderElite, rng);
    const woundsA = Math.max(0, attackerRoll.hits - defenderRoll.blocks);
    const woundsD = Math.max(0, defenderRoll.hits - attackerRoll.blocks);

    results.woundsAttacker[woundsA] = (results.woundsAttacker[woundsA] || 0) + 1;
    results.woundsDefender[woundsD] = (results.woundsDefender[woundsD] || 0) + 1;
    results.attackerSpecialsDist[attackerRoll.specials] = (results.attackerSpecialsDist[attackerRoll.specials] || 0) + 1;
    results.defenderSpecialsDist[defenderRoll.specials] = (results.defenderSpecialsDist[defenderRoll.specials] || 0) + 1;

    if (woundsA > woundsD) attackerWins++; else if (woundsA === woundsD) attackerTies++; else attackerLosses++;

    results.expected.attackerHits += attackerRoll.hits;
    results.expected.attackerSpecials += attackerRoll.specials;
    results.expected.attackerBlocks += attackerRoll.blocks;
    results.expected.defenderHits += defenderRoll.hits;
    results.expected.defenderBlocks += defenderRoll.blocks;
    results.expected.defenderSpecials += defenderRoll.specials;
    results.expected.woundsAttacker += woundsA;
    results.expected.woundsDefender += woundsD;
  }

  normalizeDistribution(results.woundsAttacker, simulationCount);
  normalizeDistribution(results.woundsDefender, simulationCount);
  normalizeDistribution(results.attackerSpecialsDist, simulationCount);
  normalizeDistribution(results.defenderSpecialsDist, simulationCount);

  results.expected.attackerHits /= simulationCount;
  results.expected.attackerSpecials /= simulationCount;
  results.expected.attackerBlocks /= simulationCount;
  results.expected.defenderHits /= simulationCount;
  results.expected.defenderBlocks /= simulationCount;
  results.expected.defenderSpecials /= simulationCount;
  results.expected.woundsAttacker /= simulationCount;
  results.expected.woundsDefender /= simulationCount;
  results.attackerWinRate = (attackerWins / simulationCount) * 100;
  results.attackerTieRate = (attackerTies / simulationCount) * 100;
  results.attackerLossRate = (attackerLosses / simulationCount) * 100;

  return results;
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
  const results: CombatResults = {
    woundsAttacker: {}, woundsDefender: {}, attackerSpecialsDist: {}, defenderSpecialsDist: {},
    expected: { attackerHits: 0, attackerSpecials: 0, attackerBlocks: 0, defenderHits: 0, defenderSpecials: 0, defenderBlocks: 0, woundsAttacker: 0, woundsDefender: 0 },
    attackerWinRate: 0, attackerTieRate: 0, attackerLossRate: 0,
    timestamp: new Date().toLocaleTimeString()
  };

  let attackerWins = 0, attackerTies = 0, attackerLosses = 0;
  for (let i = 0; i < simulationCount; i++) {
    const preA = simulateDiceRoll(attackerPool, facesByColor, false, rng);
    const preD = simulateDiceRoll(defenderPool, facesByColor, false, rng);
    const attackerRoll = applyPipelineToAggregate(preA, attackerPipeline);
    const defenderRoll = applyPipelineToAggregate(preD, defenderPipeline);

    if (defenderPipeline && typeof defenderPipeline.applyCombat === 'function') defenderPipeline.applyCombat(defenderRoll, attackerRoll, 'defender');
    if (attackerPipeline && typeof attackerPipeline.applyCombat === 'function') attackerPipeline.applyCombat(attackerRoll, defenderRoll, 'attacker');

    const woundsA = Math.max(0, (attackerRoll.hits || 0) - (defenderRoll.blocks || 0));
    const woundsD = Math.max(0, (defenderRoll.hits || 0) - (attackerRoll.blocks || 0));

    results.woundsAttacker[woundsA] = (results.woundsAttacker[woundsA] || 0) + 1;
    results.woundsDefender[woundsD] = (results.woundsDefender[woundsD] || 0) + 1;
    results.attackerSpecialsDist[attackerRoll.specials] = (results.attackerSpecialsDist[attackerRoll.specials] || 0) + 1;
    results.defenderSpecialsDist[defenderRoll.specials] = (results.defenderSpecialsDist[defenderRoll.specials] || 0) + 1;

    if (woundsA > woundsD) attackerWins++; else if (woundsA === woundsD) attackerTies++; else attackerLosses++;

    results.expected.attackerHits += attackerRoll.hits || 0;
    results.expected.attackerSpecials += attackerRoll.specials || 0;
    results.expected.attackerBlocks += attackerRoll.blocks || 0;
    results.expected.defenderHits += defenderRoll.hits || 0;
    results.expected.defenderBlocks += defenderRoll.blocks || 0;
    results.expected.defenderSpecials += defenderRoll.specials || 0;
    results.expected.woundsAttacker += woundsA;
    results.expected.woundsDefender += woundsD;
  }

  normalizeDistribution(results.woundsAttacker, simulationCount);
  normalizeDistribution(results.woundsDefender, simulationCount);
  normalizeDistribution(results.attackerSpecialsDist, simulationCount);
  normalizeDistribution(results.defenderSpecialsDist, simulationCount);

  results.expected.attackerHits /= simulationCount;
  results.expected.attackerSpecials /= simulationCount;
  results.expected.attackerBlocks /= simulationCount;
  results.expected.defenderHits /= simulationCount;
  results.expected.defenderBlocks /= simulationCount;
  results.expected.defenderSpecials /= simulationCount;
  results.expected.woundsAttacker /= simulationCount;
  results.expected.woundsDefender /= simulationCount;
  results.attackerWinRate = (attackerWins / simulationCount) * 100;
  results.attackerTieRate = (attackerTies / simulationCount) * 100;
  results.attackerLossRate = (attackerLosses / simulationCount) * 100;

  return results;
}


