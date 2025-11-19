/**
 * Reroll Editor Integration
 * Bridges the existing rerollEditor UI components with the new tab system
 */
import { initRepeatRollUI, initRepeatDiceUI } from './rerollEditor';
import type { RepeatRollConfig, RepeatDiceConfig } from '../types/reroll';

export type RerollScope = 'analysis' | 'attacker' | 'defender';

/**
 * Initialize repeat roll UI for a specific scope
 */
export function initializeRepeatRollUI(
  scope: RerollScope,
  containerId: string,
  initialConfig: RepeatRollConfig,
  onChange: (config: RepeatRollConfig) => void
): void {
  initRepeatRollUI(containerId, initialConfig, onChange, scope);
}

/**
 * Initialize repeat dice UI for a specific scope
 */
export function initializeRepeatDiceUI(
  scope: RerollScope,
  containerId: string,
  initialConfig: RepeatDiceConfig,
  onChange: (config: RepeatDiceConfig) => void
): void {
  initRepeatDiceUI(containerId, initialConfig, onChange, scope);
}

