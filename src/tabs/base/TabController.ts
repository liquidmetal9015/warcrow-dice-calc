/**
 * TabController - Abstract base class for all tab controllers
 * Defines lifecycle methods and common patterns
 */
import type { SharedServices } from '../../core/types';
import type { IDisposable } from '../../types/state';

export interface TabLifecycle {
  /**
   * Called when tab is first created
   */
  initialize(): Promise<void>;

  /**
   * Called when tab becomes visible
   */
  activate(): void;

  /**
   * Called when tab becomes hidden
   */
  deactivate(): void;

  /**
   * Called when tab is destroyed
   */
  dispose(): void;
}

export abstract class TabController implements TabLifecycle, IDisposable {
  protected container: HTMLElement;
  protected services: SharedServices;
  protected isActive: boolean = false;
  protected isInitialized: boolean = false;

  constructor(container: HTMLElement, services: SharedServices) {
    this.container = container;
    this.services = services;
  }

  /**
   * Initialize the tab (called once)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('[TabController] Already initialized');
      return;
    }

    try {
      await this.onInitialize();
      this.isInitialized = true;
    } catch (e) {
      console.error('[TabController] Initialization failed:', e);
      throw e;
    }
  }

  /**
   * Activate the tab (show it)
   */
  activate(): void {
    if (this.isActive) return;

    if (!this.isInitialized) {
      console.warn('[TabController] Tab not initialized, initializing now');
      this.initialize().then(() => {
        this.isActive = true;
        this.onActivate();
      });
      return;
    }

    this.isActive = true;
    this.container.classList.remove('hidden');
    this.onActivate();
  }

  /**
   * Deactivate the tab (hide it)
   */
  deactivate(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.container.classList.add('hidden');
    this.onDeactivate();
  }

  /**
   * Cleanup and dispose resources
   */
  dispose(): void {
    this.deactivate();
    this.onDispose();
    this.isInitialized = false;
  }

  /**
   * Check if tab is currently active
   */
  isTabActive(): boolean {
    return this.isActive;
  }

  /**
   * Check if tab is initialized
   */
  isTabInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Lifecycle hooks (to be implemented by subclasses)
   */
  protected abstract onInitialize(): Promise<void>;
  protected abstract onActivate(): void;
  protected abstract onDeactivate(): void;
  protected abstract onDispose(): void;
}

