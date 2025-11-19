import type { RerollStats } from '../../types/reroll';

export type SymbolKey = 'HIT' | 'HOLLOW_HIT' | 'BLOCK' | 'HOLLOW_BLOCK' | 'SPECIAL' | 'HOLLOW_SPECIAL';

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

