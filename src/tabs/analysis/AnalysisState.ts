/**
 * AnalysisState - State management for the Analysis tab
 * Manages dice pool, pipeline, reroll configs, and simulation results
 */
import { TabState } from '../base/TabState';
import { Pipeline } from '../../pipeline';
import type { DicePool } from '../../core/types';
import type { RepeatRollConfig, RepeatDiceConfig } from '../../types/reroll';
import type { MonteCarloResults } from '../../dice';
import { getDefaultRepeatRollConfig, getDefaultRepeatDiceConfig } from '../../ui/rerollEditor';

export interface AnalysisStateData {
  pool: DicePool;
  pipeline: Pipeline;
  repeatRollConfig: RepeatRollConfig;
  repeatDiceConfig: RepeatDiceConfig;
  disarmed: boolean;
  vulnerable: boolean;
  isSimulating: boolean;
  lastResults: MonteCarloResults | null;
  resultsOutdated: boolean;
}

export class AnalysisState extends TabState<AnalysisStateData> {
  constructor() {
    super({
      pool: { Red: 0, Orange: 0, Yellow: 0, Green: 0, Blue: 0, Black: 0 },
      pipeline: new Pipeline([]),
      repeatRollConfig: getDefaultRepeatRollConfig(),
      repeatDiceConfig: getDefaultRepeatDiceConfig(),
      disarmed: false,
      vulnerable: false,
      isSimulating: false,
      lastResults: null,
      resultsOutdated: false
    });
  }

  // Pool management
  getPool(): DicePool {
    return { ...this.state.pool };
  }

  updatePool(pool: Partial<DicePool>): void {
    this.updateState({
      pool: { ...this.state.pool, ...pool },
      resultsOutdated: true
    });
  }

  setDiceCount(color: keyof DicePool, count: number): void {
    this.updateState({
      pool: { ...this.state.pool, [color]: Math.max(0, count) },
      resultsOutdated: true
    });
  }

  resetPool(): void {
    this.updateState({
      pool: { Red: 0, Orange: 0, Yellow: 0, Green: 0, Blue: 0, Black: 0 },
      pipeline: new Pipeline([]),
      repeatRollConfig: getDefaultRepeatRollConfig(),
      repeatDiceConfig: getDefaultRepeatDiceConfig(),
      disarmed: false,
      vulnerable: false,
      lastResults: null,
      resultsOutdated: false
    });
  }

  getTotalDice(): number {
    return Object.values(this.state.pool).reduce((sum, count) => sum + count, 0);
  }

  // Pipeline management
  getPipeline(): Pipeline {
    return this.state.pipeline;
  }

  updatePipeline(pipeline: Pipeline): void {
    this.updateState({
      pipeline,
      resultsOutdated: true
    });
  }

  // Reroll config management
  getRepeatRollConfig(): RepeatRollConfig {
    return { ...this.state.repeatRollConfig };
  }

  updateRepeatRollConfig(config: RepeatRollConfig): void {
    this.updateState({
      repeatRollConfig: config,
      resultsOutdated: true
    });
  }

  getRepeatDiceConfig(): RepeatDiceConfig {
    return { ...this.state.repeatDiceConfig };
  }

  updateRepeatDiceConfig(config: RepeatDiceConfig): void {
    this.updateState({
      repeatDiceConfig: config,
      resultsOutdated: true
    });
  }

  // State flags
  isDisarmed(): boolean {
    return this.state.disarmed;
  }

  setDisarmed(disarmed: boolean): void {
    if (disarmed === this.state.disarmed) return;
    this.updateState({
      disarmed,
      resultsOutdated: true
    });
  }

  isVulnerable(): boolean {
    return this.state.vulnerable;
  }

  setVulnerable(vulnerable: boolean): void {
    if (vulnerable === this.state.vulnerable) return;
    this.updateState({
      vulnerable,
      resultsOutdated: true
    });
  }

  // Simulation state
  setSimulating(isSimulating: boolean): void {
    this.updateState({ isSimulating });
  }

  setResults(results: MonteCarloResults): void {
    this.updateState({
      lastResults: results,
      resultsOutdated: false
    });
  }

  getResults(): MonteCarloResults | null {
    return this.state.lastResults;
  }

  markResultsOutdated(): void {
    this.updateState({ resultsOutdated: true });
  }

  isResultsOutdated(): boolean {
    return this.state.resultsOutdated;
  }

  isSimulating(): boolean {
    return this.state.isSimulating;
  }
}

