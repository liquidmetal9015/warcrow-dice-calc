/**
 * ExplorerTab - Main controller for the Explorer tab
 * Manual dice rolling and reroll priority analysis
 */
import { TabController } from '../base/TabController';
import type { SharedServices, DicePool } from '../../core/types';
import { ExplorerState, type PriorityMode } from './ExplorerState';
import { ExplorerUI } from './ExplorerUI';

export class ExplorerTab extends TabController {
  private state: ExplorerState;
  private ui: ExplorerUI;

  constructor(container: HTMLElement, services: SharedServices) {
    super(container, services);
    this.state = new ExplorerState();
    this.ui = new ExplorerUI(container, services);
  }

  protected async onInitialize(): Promise<void> {
    // Subscribe to state changes
    this.state.subscribe((state) => {
      this.ui.render(state);
    });

    // Bind UI events
    this.bindEvents();

    // Initial render
    this.ui.render(this.state.getState());
  }

  protected onActivate(): void {
    // Re-render when tab becomes visible
    this.ui.render(this.state.getState());
  }

  protected onDeactivate(): void {
    // Nothing special needed
  }

  protected onDispose(): void {
    this.state.dispose();
  }

  /**
   * Bind UI event handlers
   */
  private bindEvents(): void {
    // Dice pool selectors
    this.container.querySelectorAll('.dice-type').forEach(el => {
      const color = el.getAttribute('data-color') as keyof DicePool;
      if (!color) return;

      const minusBtn = el.querySelector('.dice-btn-minus');
      const plusBtn = el.querySelector('.dice-btn-plus');

      minusBtn?.addEventListener('click', () => {
        const currentCount = this.state.getPool()[color];
        this.state.setDiceCount(color, currentCount - 1);
        this.updateDiceCountUI(color);
      });

      plusBtn?.addEventListener('click', () => {
        const currentCount = this.state.getPool()[color];
        this.state.setDiceCount(color, currentCount + 1);
        this.updateDiceCountUI(color);
      });
    });

    // Roll all button
    const rollBtn = this.container.querySelector('#explorer-roll-btn');
    rollBtn?.addEventListener('click', () => {
      this.state.rollAllDice();
    });

    // Clear button
    const clearBtn = this.container.querySelector('#explorer-clear-btn');
    clearBtn?.addEventListener('click', () => {
      this.state.clearPool();
      this.updateAllDiceCountUI();
    });

    // Priority mode radios
    const priorityRadios = this.container.querySelectorAll<HTMLInputElement>('input[name="explorer-priority"]');
    priorityRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.checked) {
          this.state.setPriorityMode(radio.value as PriorityMode);
        }
      });
    });

    // Hollow as filled checkbox
    const hollowCheckbox = this.container.querySelector('#explorer-count-hollow-as-filled') as HTMLInputElement;
    hollowCheckbox?.addEventListener('change', () => {
      this.state.setCountHollowAsFilled(hollowCheckbox.checked);
    });

    // Listen for die face changes from UI components
    this.container.addEventListener('setDieFace', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      this.state.setDieFaceIndex(detail.dieIndex, detail.faceIndex);
    });

    // Listen for single die roll requests
    this.container.addEventListener('rollDie', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      this.state.rollSingleDie(detail.dieIndex);
    });
  }

  /**
   * Update dice count UI for a specific color
   */
  private updateDiceCountUI(color: keyof DicePool): void {
    const el = this.container.querySelector(`.dice-type[data-color="${color}"]`);
    if (!el) return;

    const countSpan = el.querySelector('.dice-count');
    if (countSpan) {
      countSpan.textContent = String(this.state.getPool()[color]);
    }
  }

  /**
   * Update all dice count UI elements
   */
  private updateAllDiceCountUI(): void {
    const pool = this.state.getPool();
    this.container.querySelectorAll('.dice-type').forEach(el => {
      const color = el.getAttribute('data-color') as keyof DicePool;
      if (!color) return;

      const countSpan = el.querySelector('.dice-count');
      if (countSpan) {
        countSpan.textContent = String(pool[color]);
      }
    });
  }
}

