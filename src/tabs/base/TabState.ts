/**
 * TabState - Base class for tab-specific state management
 * Implements observable pattern for state changes
 */
import type { StateChangeListener, IState } from '../../types/state';

export abstract class TabState<T> implements IState<T> {
  protected state: T;
  protected listeners: Set<StateChangeListener<T>> = new Set();

  constructor(initialState: T) {
    this.state = initialState;
  }

  /**
   * Get current state (returns a copy to prevent mutations)
   */
  getState(): Readonly<T> {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   * Returns an unsubscribe function
   */
  subscribe(listener: StateChangeListener<T>): () => void {
    this.listeners.add(listener);
    return () => this.unsubscribe(listener);
  }

  /**
   * Unsubscribe from state changes
   */
  unsubscribe(listener: StateChangeListener<T>): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   */
  protected notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (e) {
        console.error('[TabState] Error in state listener:', e);
      }
    });
  }

  /**
   * Update state and notify listeners
   */
  protected updateState(updates: Partial<T>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  /**
   * Replace entire state (use sparingly)
   */
  protected setState(newState: T): void {
    this.state = newState;
    this.notifyListeners();
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.listeners.clear();
  }
}

