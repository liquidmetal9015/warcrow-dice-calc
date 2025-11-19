/**
 * AnalysisTab - Main controller for the Analysis tab
 * Coordinates state, UI, and simulation logic
 */
import { TabController } from '../base/TabController';
import type { SharedServices, DicePool } from '../../core/types';
import { AnalysisState } from './AnalysisState';
import { AnalysisUI } from './AnalysisUI';
import { DEFAULT_SIMULATION_COUNT, DEFAULT_DEBOUNCE_MS } from '../../constants';
import type { Pipeline } from '../../pipeline';
import type { RepeatRollConfig, RepeatDiceConfig } from '../../types/reroll';
import { initializePipelineEditor } from '../../ui/pipelineEditorIntegration';
import { initializeRepeatRollUI, initializeRepeatDiceUI } from '../../ui/rerollEditorIntegration';

export class AnalysisTab extends TabController {
  private state: AnalysisState;
  private ui: AnalysisUI;
  private debounceTimeout: number | null = null;
  private pendingRun: boolean = false;

  constructor(container: HTMLElement, services: SharedServices) {
    super(container, services);
    this.state = new AnalysisState();
    this.ui = new AnalysisUI(container, services);
  }

  protected async onInitialize(): Promise<void> {
    // Subscribe to state changes
    this.state.subscribe((state) => {
      this.ui.render(state);
    });

    // Initialize pipeline editor
    initializePipelineEditor('analysis', this.state.getPipeline(), (pipeline) => {
      this.updatePipeline(pipeline);
    });

    // Initialize reroll editors
    initializeRepeatRollUI('analysis', 'repeat-roll-section', this.state.getRepeatRollConfig(), (config) => {
      this.updateRepeatRollConfig(config);
    });

    initializeRepeatDiceUI('analysis', 'repeat-dice-section', this.state.getRepeatDiceConfig(), (config) => {
      this.updateRepeatDiceConfig(config);
    });

    // Bind UI events
    this.bindEvents();

    // Initial render
    this.ui.render(this.state.getState());
  }

  protected onActivate(): void {
    // Render current state when tab becomes visible
    this.ui.render(this.state.getState());
  }

  protected onDeactivate(): void {
    // Clear any pending simulations
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
    this.ui.bindDiceAdjust((type, isPlus) => {
        const currentCount = this.state.getPool()[type as keyof DicePool] || 0;
        const newCount = Math.max(0, currentCount + (isPlus ? 1 : -1));
        this.state.setDiceCount(type as keyof DicePool, newCount);
        // We can let the state subscription update the UI, or do optimistic update.
        // The original code updated UI textContent manually for responsiveness.
        this.ui.updateDiceCount(type, newCount);
        this.scheduleSimulation();
    });

    this.ui.bindReset(() => this.handleReset());

    this.ui.bindStateChange((type, value) => {
        if (type === 'disarmed') this.state.setDisarmed(value);
        if (type === 'vulnerable') this.state.setVulnerable(value);
        this.scheduleSimulation();
    });

    this.ui.bindChartModeChange(() => {
        this.renderChartsWithCurrentResults();
    });
  }

  /**
   * Handle reset button
   */
  private handleReset(): void {
    this.state.resetPool();
    this.ui.resetUI();
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
   * Run the simulation
   */
  private async runSimulation(): Promise<void> {
    if (this.state.isSimulating()) {
      this.pendingRun = true;
      return;
    }

    const totalDice = this.state.getTotalDice();
    if (totalDice === 0) {
      this.ui.showEmptyState();
      return;
    }

    this.state.setSimulating(true);

    try {
      // Small delay for UI responsiveness
      await new Promise(r => setTimeout(r, 150));

      const results = await this.services.simulation.runAnalysisWithPipeline(
        this.state.getPool(),
        this.services.diceData.getFaces(),
        DEFAULT_SIMULATION_COUNT,
        this.state.getPipeline(),
        this.state.getRepeatRollConfig(),
        this.state.getRepeatDiceConfig(),
        this.state.isDisarmed(),
        this.state.isVulnerable()
      );

      this.state.setResults(results);
      this.renderChartsWithCurrentResults();
    } catch (e) {
      console.error('[AnalysisTab] Simulation error:', e);
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
   * Render charts with current results
   */
  private renderChartsWithCurrentResults(): void {
    const results = this.state.getResults();
    if (!results) return;
    this.ui.updateCharts(results);
  }

  /**
   * Public API for external updates (e.g., from reroll editor)
   */
  public updatePipeline(pipeline: Pipeline): void {
    this.state.updatePipeline(pipeline);
    this.scheduleSimulation();
  }

  public updateRepeatRollConfig(config: RepeatRollConfig): void {
    this.state.updateRepeatRollConfig(config);
    this.scheduleSimulation();
  }

  public updateRepeatDiceConfig(config: RepeatDiceConfig): void {
    this.state.updateRepeatDiceConfig(config);
    this.scheduleSimulation();
  }
}
