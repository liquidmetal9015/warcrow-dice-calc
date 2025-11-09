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
    // Dice selector events
    this.container.querySelectorAll('.dice-btn-plus, .dice-btn-minus').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleDiceAdjust(e.target as HTMLElement));
    });

    // Reset button
    const resetBtn = this.container.querySelector('#reset-pool');
    resetBtn?.addEventListener('click', () => this.handleReset());

    // Chart mode changes
    ['analysis-mode-hits', 'analysis-mode-blocks', 'analysis-mode-specials'].forEach(name => {
      this.container.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
        radio.addEventListener('change', () => this.handleChartModeChange());
      });
    });

    ['analysis-mode-hs', 'analysis-mode-bs'].forEach(name => {
      this.container.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
        radio.addEventListener('change', () => this.handleChartModeChange());
      });
    });

    // Listen for chart render requests from UI
    this.container.addEventListener('renderCharts', () => {
      this.renderChartsWithCurrentResults();
    });
  }

  /**
   * Handle dice count adjustment
   */
  private handleDiceAdjust(button: HTMLElement): void {
    const parent = button.closest('.dice-type');
    if (!parent) return;

    const label = (parent.querySelector('.dice-label') as HTMLElement)?.textContent?.trim();
    if (!label) return;

    const isPlus = button.classList.contains('dice-btn-plus');
    const currentCount = parseInt((parent.querySelector('.dice-count') as HTMLElement)?.textContent || '0', 10);
    const newCount = Math.max(0, currentCount + (isPlus ? 1 : -1));

    this.state.setDiceCount(label as keyof DicePool, newCount);
    
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
    this.state.resetPool();
    
    // Update UI counts
    this.container.querySelectorAll('.dice-type').forEach(el => {
      const countEl = el.querySelector('.dice-count') as HTMLElement;
      if (countEl) countEl.textContent = '0';
    });

    // Reset reroll UI (if present)
    const enableRepeatRoll = this.container.querySelector('#enable-repeat-roll') as HTMLInputElement;
    const enableRepeatDice = this.container.querySelector('#enable-repeat-dice') as HTMLInputElement;
    if (enableRepeatRoll) {
      enableRepeatRoll.checked = false;
      enableRepeatRoll.dispatchEvent(new Event('change'));
    }
    if (enableRepeatDice) {
      enableRepeatDice.checked = false;
      enableRepeatDice.dispatchEvent(new Event('change'));
    }
  }

  /**
   * Handle chart mode changes
   */
  private handleChartModeChange(): void {
    this.renderChartsWithCurrentResults();
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
        this.state.getRepeatDiceConfig()
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

    const modes = this.getChartModes();

    this.ui.renderDistributionCharts(results, {
      hits: modes.hits,
      blocks: modes.blocks,
      specials: modes.specials
    });

    this.ui.renderBivariateCharts(results, {
      hitsSpecials: modes.hitsSpecials,
      blocksSpecials: modes.blocksSpecials
    });
  }

  /**
   * Get current chart modes from UI
   */
  private getChartModes(): {
    hits: 'filled' | 'hollow' | 'both';
    blocks: 'filled' | 'hollow' | 'both';
    specials: 'filled' | 'hollow' | 'both';
    hitsSpecials: 'filled' | 'hollow' | 'both';
    blocksSpecials: 'filled' | 'hollow' | 'both';
  } {
    return {
      hits: this.getRadioValue('analysis-mode-hits', 'filled'),
      blocks: this.getRadioValue('analysis-mode-blocks', 'filled'),
      specials: this.getRadioValue('analysis-mode-specials', 'filled'),
      hitsSpecials: this.getRadioValue('analysis-mode-hs', 'filled'),
      blocksSpecials: this.getRadioValue('analysis-mode-bs', 'filled')
    };
  }

  /**
   * Get radio button value
   */
  private getRadioValue(name: string, defaultValue: string): 'filled' | 'hollow' | 'both' {
    const radio = this.container.querySelector(`input[name="${name}"]:checked`) as HTMLInputElement;
    return (radio?.value || defaultValue) as 'filled' | 'hollow' | 'both';
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

