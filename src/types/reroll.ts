import type { Aggregate } from '../dice';

// Repeat Roll (Full Reroll) Types
export type RerollCondition = {
  type: 'BelowExpected' | 'MinSymbol' | 'NoSymbol';
  symbol: keyof Aggregate;
  threshold?: number; // for MinSymbol type
};

export type RepeatRollConfig = {
  enabled: boolean;
  condition: RerollCondition;
};

// Selective Reroll (Per-Die) Types
export type DieRoll = {
  color: string;
  faceIndex: number;
  symbols: Aggregate;
};

export type RollResult = {
  dice: DieRoll[];
  aggregate: Aggregate;
};

export type RerollValueWeights = {
  hits: number;
  blocks: number;
  specials: number;
  hollowHits: number;
  hollowBlocks: number;
  hollowSpecials: number;
};

export type RepeatDiceConfig = {
  enabled: boolean;
  maxDiceToReroll: number;
  priorityMode: 'hits' | 'blocks' | 'specials';
  countHollowAsFilled: boolean;
};

// Reroll Statistics
export type RerollStats = {
  fullRerollsOccurred: number;
  diceRerolledCount: number;
  totalRolls: number;
};

