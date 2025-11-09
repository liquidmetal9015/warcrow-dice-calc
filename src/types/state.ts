/**
 * State management types
 */

/**
 * Generic state change listener
 */
export type StateChangeListener<T = any> = (state: T) => void;

/**
 * Base state interface
 */
export interface IState<T> {
  /**
   * Get current state snapshot (immutable)
   */
  getState(): Readonly<T>;

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateChangeListener<T>): () => void;

  /**
   * Unsubscribe from state changes
   */
  unsubscribe(listener: StateChangeListener<T>): void;
}

/**
 * Disposable interface for cleanup
 */
export interface IDisposable {
  dispose(): void;
}

