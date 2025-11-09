import type { FixedDiceConfig } from '../dice';
import { STORAGE_KEYS } from '../constants';

const STORAGE_VERSION = '1.0';

interface StoredFixedDice {
  version: string;
  config: FixedDiceConfig;
}

/**
 * Save fixed dice configuration to localStorage
 */
export function saveFixedDice(scope: 'analysis' | 'attacker' | 'defender', config: FixedDiceConfig): void {
  const key = STORAGE_KEYS.fixedDice(scope);
  const data: StoredFixedDice = {
    version: STORAGE_VERSION,
    config
  };
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Failed to save fixed dice for ${scope}:`, e);
  }
}

/**
 * Load fixed dice configuration from localStorage
 * Returns empty array if not found or invalid
 */
export function loadFixedDice(scope: 'analysis' | 'attacker' | 'defender'): FixedDiceConfig {
  const key = STORAGE_KEYS.fixedDice(scope);
  const stored = localStorage.getItem(key);
  
  if (!stored) {
    return [];
  }
  
  try {
    const parsed = JSON.parse(stored) as StoredFixedDice;
    
    // Version check
    if (parsed.version !== STORAGE_VERSION) {
      console.warn(`Fixed dice config version mismatch for ${scope}, clearing`);
      localStorage.removeItem(key);
      return [];
    }
    
    // Validate structure
    if (!Array.isArray(parsed.config)) {
      console.warn(`Invalid fixed dice config structure for ${scope}, clearing`);
      localStorage.removeItem(key);
      return [];
    }
    
    // Validate each fixed die
    const validConfig = parsed.config.filter(die => {
      return (
        die &&
        typeof die.color === 'string' &&
        typeof die.faceIndex === 'number' &&
        die.faceIndex >= 0 &&
        die.faceIndex <= 7
      );
    });
    
    return validConfig;
  } catch (e) {
    console.error(`Failed to load fixed dice for ${scope}:`, e);
    localStorage.removeItem(key);
    return [];
  }
}

/**
 * Clear fixed dice configuration for a scope
 */
export function clearFixedDice(scope: 'analysis' | 'attacker' | 'defender'): void {
  const key = STORAGE_KEYS.fixedDice(scope);
  localStorage.removeItem(key);
}

/**
 * Clear all fixed dice configurations
 */
export function clearAllFixedDice(): void {
  clearFixedDice('analysis');
  clearFixedDice('attacker');
  clearFixedDice('defender');
}
