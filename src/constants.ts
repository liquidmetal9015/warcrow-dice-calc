export const DEFAULT_SIMULATION_COUNT = 10000;
export const DEFAULT_DEBOUNCE_MS = 150;

export const STORAGE_KEYS = {
  pipeline: (scope: 'analysis'|'attacker'|'defender') => `pipeline:${scope}`,
  fixedDice: (scope: 'analysis'|'attacker'|'defender') => `fixedDice:${scope}`
} as const;

export const TAB_NAMES = {
  analysis: 'analysis',
  combat: 'combat',
  faces: 'faces'
} as const;


