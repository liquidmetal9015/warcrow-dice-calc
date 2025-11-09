import type { RepeatRollConfig, RepeatDiceConfig } from '../types/reroll';
import type { Aggregate } from '../dice';

export interface RerollEditorCallbacks {
  onRepeatRollChanged: (config: RepeatRollConfig) => void;
  onRepeatDiceChanged: (config: RepeatDiceConfig) => void;
}

/**
 * Initialize Repeat Roll UI
 */
export function initRepeatRollUI(
  containerId: string,
  initialConfig: RepeatRollConfig,
  callback: (config: RepeatRollConfig) => void
): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const enableCheckbox = container.querySelector('#enable-repeat-roll') as HTMLInputElement;
  const conditionRadios = container.querySelectorAll('input[name="reroll-condition"]') as NodeListOf<HTMLInputElement>;

  if (!enableCheckbox || !conditionRadios.length) return;

  // Initialize state
  enableCheckbox.checked = initialConfig.enabled;

  // Helper to parse condition value
  function parseConditionValue(value: string): RepeatRollConfig['condition'] {
    if (value.startsWith('below-expected-')) {
      const symbol = value.replace('below-expected-', '') as keyof Aggregate;
      return { type: 'BelowExpected', symbol };
    }
    // Default fallback
    return { type: 'BelowExpected', symbol: 'hits' };
  }

  // Set initial condition
  const condType = initialConfig.condition.type;
  const condSymbol = initialConfig.condition.symbol;
  if (condType === 'BelowExpected') {
    const targetValue = `below-expected-${condSymbol}`;
    conditionRadios.forEach(radio => {
      if (radio.value === targetValue) {
        radio.checked = true;
      }
    });
  }

  // Helper to read current config from DOM (prevents stale closure captures)
  function getCurrentConfig(): RepeatRollConfig {
    const checkedRadio = Array.from(conditionRadios).find(r => r.checked);
    const condition: RepeatRollConfig['condition'] = checkedRadio 
      ? parseConditionValue(checkedRadio.value) 
      : { type: 'BelowExpected', symbol: 'hits' };
    return {
      enabled: enableCheckbox.checked,
      condition
    };
  }

  // Enable/disable toggle
  enableCheckbox.addEventListener('change', () => {
    callback(getCurrentConfig());
  });

  // Condition change
  conditionRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        callback(getCurrentConfig());
      }
    });
  });
}

/**
 * Initialize Repeat Dice UI
 */
export function initRepeatDiceUI(
  containerId: string,
  initialConfig: RepeatDiceConfig,
  callback: (config: RepeatDiceConfig) => void
): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const enableCheckbox = container.querySelector('#enable-repeat-dice') as HTMLInputElement;
  const maxDiceInput = container.querySelector('#max-dice-reroll') as HTMLInputElement;
  const priorityRadios = container.querySelectorAll('input[name="priority-mode"]') as NodeListOf<HTMLInputElement>;
  const hollowCheckbox = container.querySelector('#count-hollow-as-filled') as HTMLInputElement;

  if (!enableCheckbox || !maxDiceInput) return;

  // Initialize state
  enableCheckbox.checked = initialConfig.enabled;
  maxDiceInput.value = String(initialConfig.maxDiceToReroll);
  if (hollowCheckbox) {
    hollowCheckbox.checked = initialConfig.countHollowAsFilled;
  }

  // Set initial priority mode
  priorityRadios.forEach(radio => {
    if (radio.value === initialConfig.priorityMode) {
      radio.checked = true;
    }
  });

  // Helper to read current config from DOM (prevents stale closure captures)
  function getCurrentConfig(): RepeatDiceConfig {
    const checkedRadio = Array.from(priorityRadios).find(r => r.checked);
    return {
      enabled: enableCheckbox.checked,
      maxDiceToReroll: parseInt(maxDiceInput.value || '2', 10),
      priorityMode: checkedRadio?.value as RepeatDiceConfig['priorityMode'] || 'hits',
      countHollowAsFilled: hollowCheckbox?.checked || false
    };
  }

  // Enable/disable toggle
  enableCheckbox.addEventListener('change', () => {
    callback(getCurrentConfig());
  });

  // Max dice change
  maxDiceInput.addEventListener('input', () => {
    const max = Math.max(1, Math.min(10, parseInt(maxDiceInput.value || '2', 10)));
    maxDiceInput.value = String(max);
    callback(getCurrentConfig());
  });

  // Priority mode change
  priorityRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        callback(getCurrentConfig());
      }
    });
  });

  // Hollow checkbox change
  if (hollowCheckbox) {
    hollowCheckbox.addEventListener('change', () => {
      callback(getCurrentConfig());
    });
  }
}

/**
 * Get default repeat roll config
 */
export function getDefaultRepeatRollConfig(): RepeatRollConfig {
  return {
    enabled: false,
    condition: {
      type: 'BelowExpected',
      symbol: 'hits'
    }
  };
}

/**
 * Get default repeat dice config
 */
export function getDefaultRepeatDiceConfig(): RepeatDiceConfig {
  return {
    enabled: false,
    maxDiceToReroll: 2,
    priorityMode: 'hits',
    countHollowAsFilled: false
  };
}

