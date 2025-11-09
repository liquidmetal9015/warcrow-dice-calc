/**
 * UI Helper utilities to prevent common bugs
 */

/**
 * Creates a state reader function that always reads from DOM elements.
 * This prevents stale closure captures in event handlers.
 * 
 * @example
 * ```typescript
 * const getConfig = createStateReader(() => ({
 *   enabled: enableCheckbox.checked,
 *   max: parseInt(maxInput.value, 10),
 *   mode: Array.from(radios).find(r => r.checked)?.value || 'default'
 * }));
 * 
 * // Use in all event handlers
 * enableCheckbox.addEventListener('change', () => {
 *   callback(getConfig()); // Always reads fresh state
 * });
 * ```
 */
export function createStateReader<T>(reader: () => T): () => T {
  return reader;
}

/**
 * Gets the checked radio button value from a radio group.
 * Returns undefined if no radio is checked.
 * 
 * @example
 * ```typescript
 * const radios = document.querySelectorAll('input[name="mode"]');
 * const mode = getCheckedRadioValue(radios) || 'default';
 * ```
 */
export function getCheckedRadioValue(
  radios: NodeListOf<HTMLInputElement> | HTMLInputElement[]
): string | undefined {
  return Array.from(radios).find(r => r.checked)?.value;
}

/**
 * Safely parses an integer from an input element with fallback.
 * Ensures the value is within min/max bounds.
 * 
 * @example
 * ```typescript
 * const max = parseInputInt(maxInput, 2, 1, 10);
 * ```
 */
export function parseInputInt(
  input: HTMLInputElement | null,
  fallback: number,
  min?: number,
  max?: number
): number {
  if (!input) return fallback;
  
  let value = parseInt(input.value || String(fallback), 10);
  
  if (isNaN(value)) {
    value = fallback;
  }
  
  if (min !== undefined && value < min) {
    value = min;
  }
  
  if (max !== undefined && value > max) {
    value = max;
  }
  
  return value;
}

/**
 * Validates that all required form elements exist.
 * Throws an error with helpful message if any are missing.
 * 
 * @example
 * ```typescript
 * const elements = {
 *   enable: document.getElementById('enable') as HTMLInputElement,
 *   max: document.getElementById('max') as HTMLInputElement
 * };
 * 
 * validateElements(elements, 'MyFormUI');
 * // Now TypeScript knows all elements are non-null
 * ```
 */
export function validateElements<T extends Record<string, HTMLElement | null>>(
  elements: T,
  componentName: string
): asserts elements is { [K in keyof T]: NonNullable<T[K]> } {
  const missing = Object.entries(elements)
    .filter(([_, el]) => !el)
    .map(([name]) => name);
  
  if (missing.length > 0) {
    throw new Error(
      `${componentName}: Missing required elements: ${missing.join(', ')}`
    );
  }
}

/**
 * Type-safe event listener wrapper that ensures the target element exists.
 * 
 * @example
 * ```typescript
 * safeAddEventListener(checkbox, 'change', () => {
 *   callback(getConfig());
 * });
 * ```
 */
export function safeAddEventListener<K extends keyof HTMLElementEventMap>(
  element: HTMLElement | null,
  event: K,
  handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
): void {
  if (element) {
    element.addEventListener(event, handler as EventListener, options);
  }
}

/**
 * Creates a debounced version of a callback function.
 * Useful for input fields that should trigger updates after user stops typing.
 * 
 * @example
 * ```typescript
 * const debouncedCallback = debounce((config) => {
 *   expensiveOperation(config);
 * }, 300);
 * 
 * input.addEventListener('input', () => {
 *   debouncedCallback(getConfig());
 * });
 * ```
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };
}

