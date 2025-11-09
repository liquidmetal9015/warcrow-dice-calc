/**
 * CombatState - State management for the Combat tab
 * Manages attacker/defender pools, pipelines, and combat results
 */
import { TabState } from '../base/TabState';
import { Pipeline } from '../../pipeline';
import type { DicePool } from '../../core/types';
import type { RepeatRollConfig, RepeatDiceConfig } from '../../types/reroll';
import type { CombatResults } from '../../dice';
import { getDefaultRepeatRollConfig, getDefaultRepeatDiceConfig } from '../../ui/rerollEditor';

export interface CombatStateData {
  attackerPool: DicePool;
  defenderPool: DicePool;
  attackerPipeline: Pipeline;
  defenderPipeline: Pipeline;
  attackerRepeatRollConfig: RepeatRollConfig;
  attackerRepeatDiceConfig: RepeatDiceConfig;
  defenderRepeatRollConfig: RepeatRollConfig;
  defenderRepeatDiceConfig: RepeatDiceConfig;
  isSimulating: boolean;
  lastResults: CombatResults | null;
  resultsOutdated: boolean;
}

export class CombatState extends TabState<CombatStateData> {
  constructor() {
    super({
      attackerPool: { Red: 0, Orange: 0, Yellow: 0, Green: 0, Blue: 0, Black: 0 },
      defenderPool: { Red: 0, Orange: 0, Yellow: 0, Green: 0, Blue: 0, Black: 0 },
      attackerPipeline: new Pipeline([]),
      defenderPipeline: new Pipeline([]),
      attackerRepeatRollConfig: getDefaultRepeatRollConfig(),
      attackerRepeatDiceConfig: getDefaultRepeatDiceConfig(),
      defenderRepeatRollConfig: getDefaultRepeatRollConfig(),
      defenderRepeatDiceConfig: getDefaultRepeatDiceConfig(),
      isSimulating: false,
      lastResults: null,
      resultsOutdated: false
    });
  }

  // Attacker pool management
  getAttackerPool(): DicePool {
    return { ...this.state.attackerPool };
  }

  setAttackerDiceCount(color: keyof DicePool, count: number): void {
    this.updateState({
      attackerPool: { ...this.state.attackerPool, [color]: Math.max(0, count) },
      resultsOutdated: true
    });
  }

  // Defender pool management
  getDefenderPool(): DicePool {
    return { ...this.state.defenderPool };
  }

  setDefenderDiceCount(color: keyof DicePool, count: number): void {
    this.updateState({
      defenderPool: { ...this.state.defenderPool, [color]: Math.max(0, count) },
      resultsOutdated: true
    });
  }

  // Reset
  reset(): void {
    this.updateState({
      attackerPool: { Red: 0, Orange: 0, Yellow: 0, Green: 0, Blue: 0, Black: 0 },
      defenderPool: { Red: 0, Orange: 0, Yellow: 0, Green: 0, Blue: 0, Black: 0 },
      attackerPipeline: new Pipeline([]),
      defenderPipeline: new Pipeline([]),
      attackerRepeatRollConfig: getDefaultRepeatRollConfig(),
      attackerRepeatDiceConfig: getDefaultRepeatDiceConfig(),
      defenderRepeatRollConfig: getDefaultRepeatRollConfig(),
      defenderRepeatDiceConfig: getDefaultRepeatDiceConfig(),
      lastResults: null,
      resultsOutdated: false
    });
  }

  getTotalDice(): { attacker: number; defender: number } {
    return {
      attacker: Object.values(this.state.attackerPool).reduce((s, c) => s + c, 0),
      defender: Object.values(this.state.defenderPool).reduce((s, c) => s + c, 0)
    };
  }

  // Pipeline management
  getAttackerPipeline(): Pipeline {
    return this.state.attackerPipeline;
  }

  updateAttackerPipeline(pipeline: Pipeline): void {
    this.updateState({ attackerPipeline: pipeline, resultsOutdated: true });
  }

  getDefenderPipeline(): Pipeline {
    return this.state.defenderPipeline;
  }

  updateDefenderPipeline(pipeline: Pipeline): void {
    this.updateState({ defenderPipeline: pipeline, resultsOutdated: true });
  }

  // Attacker reroll configs
  getAttackerRepeatRollConfig(): RepeatRollConfig {
    return { ...this.state.attackerRepeatRollConfig };
  }

  updateAttackerRepeatRollConfig(config: RepeatRollConfig): void {
    this.updateState({ attackerRepeatRollConfig: config, resultsOutdated: true });
  }

  getAttackerRepeatDiceConfig(): RepeatDiceConfig {
    return { ...this.state.attackerRepeatDiceConfig };
  }

  updateAttackerRepeatDiceConfig(config: RepeatDiceConfig): void {
    this.updateState({ attackerRepeatDiceConfig: config, resultsOutdated: true });
  }

  // Defender reroll configs
  getDefenderRepeatRollConfig(): RepeatRollConfig {
    return { ...this.state.defenderRepeatRollConfig };
  }

  updateDefenderRepeatRollConfig(config: RepeatRollConfig): void {
    this.updateState({ defenderRepeatRollConfig: config, resultsOutdated: true });
  }

  getDefenderRepeatDiceConfig(): RepeatDiceConfig {
    return { ...this.state.defenderRepeatDiceConfig };
  }

  updateDefenderRepeatDiceConfig(config: RepeatDiceConfig): void {
    this.updateState({ defenderRepeatDiceConfig: config, resultsOutdated: true });
  }

  // Simulation state
  setSimulating(isSimulating: boolean): void {
    this.updateState({ isSimulating });
  }

  setResults(results: CombatResults): void {
    this.updateState({
      lastResults: results,
      resultsOutdated: false
    });
  }

  getResults(): CombatResults | null {
    return this.state.lastResults;
  }

  isSimulating(): boolean {
    return this.state.isSimulating;
  }
}

