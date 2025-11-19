/**
 * CombatTab - Main controller for the Combat tab
 * Coordinates attacker/defender state, UI, and simulations
 */
import { TabController } from '../base/TabController';
import type { SharedServices, DicePool } from '../../core/types';
import { CombatState } from './CombatState';
import { CombatUI } from './CombatUI';
import { DEFAULT_SIMULATION_COUNT, DEFAULT_DEBOUNCE_MS } from '../../constants';
import type { Pipeline } from '../../pipeline';
import type { RepeatRollConfig, RepeatDiceConfig } from '../../types/reroll';
import { initializePipelineEditor } from '../../ui/pipelineEditorIntegration';
import { initializeRepeatRollUI, initializeRepeatDiceUI } from '../../ui/rerollEditorIntegration';

export class CombatTab extends TabController {
  private state: CombatState;
  private ui: CombatUI;
  private debounceTimeout: number | null = null;
  private pendingRun: boolean = false;

  constructor(container: HTMLElement, services: SharedServices) {
    super(container, services);
    this.state = new CombatState();
    this.ui = new CombatUI(container, services);
  }

  protected async onInitialize(): Promise<void> {
    // Subscribe to state changes
    this.state.subscribe((state) => {
      this.ui.render(state);
    });

    // Initialize pipeline editors
    initializePipelineEditor('attacker', this.state.getAttackerPipeline(), (pipeline) => {
      this.updateAttackerPipeline(pipeline);
    });

    initializePipelineEditor('defender', this.state.getDefenderPipeline(), (pipeline) => {
      this.updateDefenderPipeline(pipeline);
    });

    // Initialize attacker reroll editors
    initializeRepeatRollUI('attacker', 'attacker-repeat-roll-section', this.state.getAttackerRepeatRollConfig(), (config) => {
      this.updateAttackerRepeatRollConfig(config);
    });

    initializeRepeatDiceUI('attacker', 'attacker-repeat-dice-section', this.state.getAttackerRepeatDiceConfig(), (config) => {
      this.updateAttackerRepeatDiceConfig(config);
    });

    // Initialize defender reroll editors
    initializeRepeatRollUI('defender', 'defender-repeat-roll-section', this.state.getDefenderRepeatRollConfig(), (config) => {
      this.updateDefenderRepeatRollConfig(config);
    });

    initializeRepeatDiceUI('defender', 'defender-repeat-dice-section', this.state.getDefenderRepeatDiceConfig(), (config) => {
      this.updateDefenderRepeatDiceConfig(config);
    });

    // Bind UI events
    this.bindEvents();

    // Initial render
    this.ui.render(this.state.getState());
  }

  protected onActivate(): void {
    this.ui.render(this.state.getState());
  }

  protected onDeactivate(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }
  }

  protected onDispose(): void {
    this.state.dispose();
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
  }

  /**
   * Bind UI event handlers
   */
  private bindEvents(): void {
    // Dice selector events for both attacker and defender
    this.container.querySelectorAll('.dice-btn-plus, .dice-btn-minus').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleDiceAdjust(e.target as HTMLElement));
    });

    // State flags
    const attackerDisarmedEl = this.container.querySelector('#attacker-disarmed') as HTMLInputElement | null;
    if (attackerDisarmedEl) {
      attackerDisarmedEl.addEventListener('change', () => {
        this.state.setAttackerDisarmed(attackerDisarmedEl.checked);
        this.scheduleSimulation();
      });
    }

    const defenderVulnerableEl = this.container.querySelector('#defender-vulnerable') as HTMLInputElement | null;
    if (defenderVulnerableEl) {
      defenderVulnerableEl.addEventListener('change', () => {
        this.state.setDefenderVulnerable(defenderVulnerableEl.checked);
        this.scheduleSimulation();
      });
    }

    // Reset button
    const resetBtn = this.container.querySelector('#reset-combat');
    resetBtn?.addEventListener('click', () => this.handleReset());
  }

  /**
   * Handle dice count adjustment
   */
  private handleDiceAdjust(button: HTMLElement): void {
    const parent = button.closest('.dice-type');
    if (!parent) return;

    const label = (parent.querySelector('.dice-label') as HTMLElement)?.textContent?.trim();
    if (!label) return;

    const poolName = (parent as HTMLElement).dataset.pool || 'attacker';
    const isPlus = button.classList.contains('dice-btn-plus');
    const currentCount = parseInt((parent.querySelector('.dice-count') as HTMLElement)?.textContent || '0', 10);
    const newCount = Math.max(0, currentCount + (isPlus ? 1 : -1));

    if (poolName === 'attacker') {
      this.state.setAttackerDiceCount(label as keyof DicePool, newCount);
    } else {
      this.state.setDefenderDiceCount(label as keyof DicePool, newCount);
    }

    // Update UI immediately
    const countEl = parent.querySelector('.dice-count') as HTMLElement;
    if (countEl) countEl.textContent = String(newCount);

    // Schedule simulation
    this.scheduleSimulation();
  }

  /**
   * Handle reset button
   */
  private handleReset(): void {
    this.state.reset();

    // Update UI counts
    this.container.querySelectorAll('.dice-type').forEach(el => {
      const countEl = el.querySelector('.dice-count') as HTMLElement;
      if (countEl) countEl.textContent = '0';
    });

    // Reset reroll UI for both attacker and defender
    const resetRerollUI = (prefix: string) => {
      const enableRepeatRoll = this.container.querySelector(`#${prefix}-repeat-roll-section #enable-repeat-roll`) as HTMLInputElement;
      const enableRepeatDice = this.container.querySelector(`#${prefix}-repeat-dice-section #enable-repeat-dice`) as HTMLInputElement;
      
      if (enableRepeatRoll) {
        enableRepeatRoll.checked = false;
        enableRepeatRoll.dispatchEvent(new Event('change'));
      }
      if (enableRepeatDice) {
        enableRepeatDice.checked = false;
        enableRepeatDice.dispatchEvent(new Event('change'));
      }
    };

    resetRerollUI('attacker');
    resetRerollUI('defender');

    // Reset combat state flags
    const attackerDisarmedEl = this.container.querySelector('#attacker-disarmed') as HTMLInputElement | null;
    if (attackerDisarmedEl) attackerDisarmedEl.checked = false;
    const defenderVulnerableEl = this.container.querySelector('#defender-vulnerable') as HTMLInputElement | null;
    if (defenderVulnerableEl) defenderVulnerableEl.checked = false;
  }

  /**
   * Schedule a simulation run (debounced)
   */
  private scheduleSimulation(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = window.setTimeout(() => {
      this.runSimulation();
    }, DEFAULT_DEBOUNCE_MS);
  }

  /**
   * Run the combat simulation
   */
  private async runSimulation(): Promise<void> {
    if (this.state.isSimulating()) {
      this.pendingRun = true;
      return;
    }

    const totals = this.state.getTotalDice();
    if (totals.attacker === 0 && totals.defender === 0) {
      this.ui.showEmptyState();
      return;
    }

    this.state.setSimulating(true);

    try {
      // Small delay for UI responsiveness
      await new Promise(r => setTimeout(r, 150));

      const results = await this.services.simulation.runCombatWithPipeline(
        this.state.getAttackerPool(),
        this.state.getDefenderPool(),
        this.services.diceData.getFaces(),
        DEFAULT_SIMULATION_COUNT,
        this.state.getAttackerPipeline(),
        this.state.getDefenderPipeline(),
        this.state.getAttackerRepeatRollConfig(),
        this.state.getAttackerRepeatDiceConfig(),
        this.state.getDefenderRepeatRollConfig(),
        this.state.getDefenderRepeatDiceConfig(),
        this.state.isAttackerDisarmed(),
        this.state.isDefenderVulnerable()
      );

      this.state.setResults(results);
    } catch (e) {
      console.error('[CombatTab] Simulation error:', e);
    } finally {
      this.state.setSimulating(false);

      // Run pending simulation if requested
      if (this.pendingRun) {
        this.pendingRun = false;
        this.scheduleSimulation();
      }
    }
  }

  /**
   * Public API for external updates (e.g., from pipeline/reroll editors)
   */
  public updateAttackerPipeline(pipeline: Pipeline): void {
    this.state.updateAttackerPipeline(pipeline);
    this.scheduleSimulation();
  }

  public updateDefenderPipeline(pipeline: Pipeline): void {
    this.state.updateDefenderPipeline(pipeline);
    this.scheduleSimulation();
  }

  public updateAttackerRepeatRollConfig(config: RepeatRollConfig): void {
    this.state.updateAttackerRepeatRollConfig(config);
    this.scheduleSimulation();
  }

  public updateAttackerRepeatDiceConfig(config: RepeatDiceConfig): void {
    this.state.updateAttackerRepeatDiceConfig(config);
    this.scheduleSimulation();
  }

  public updateDefenderRepeatRollConfig(config: RepeatRollConfig): void {
    this.state.updateDefenderRepeatRollConfig(config);
    this.scheduleSimulation();
  }

  public updateDefenderRepeatDiceConfig(config: RepeatDiceConfig): void {
    this.state.updateDefenderRepeatDiceConfig(config);
    this.scheduleSimulation();
  }
}

