/**
 * AnalysisUI - UI rendering and management for Analysis tab
 */
import type { SharedServices } from '../../core/types';
import type { AnalysisStateData } from './AnalysisState';
import { SymbolSummary } from './components/SymbolSummary';
import { DistributionCharts, type ChartMode } from './components/DistributionCharts';
import { BivariateCharts } from './components/BivariateCharts';

export class AnalysisUI {
  private container: HTMLElement;
  private services: SharedServices;
  private symbolSummary: SymbolSummary;
  private distributionCharts: DistributionCharts;
  private bivariateCharts: BivariateCharts;

  constructor(container: HTMLElement, services: SharedServices) {
    this.container = container;
    this.services = services;

    // Initialize components
    const summaryEl = this.container.querySelector('#symbol-summary') as HTMLElement;
    this.symbolSummary = new SymbolSummary(summaryEl, services.icons);
    this.distributionCharts = new DistributionCharts(services.charts);
    this.bivariateCharts = new BivariateCharts(services.charts);
  }

  /**
   * Render the analysis state
   */
  render(state: AnalysisStateData): void {
    this.updateTimestamp(state.lastResults?.timestamp);

    if (state.isSimulating) {
      this.showLoading();
      return;
    }

    const totalDice = Object.values(state.pool).reduce((s, c) => s + c, 0);
    
    if (totalDice === 0) {
      this.showEmptyState();
      return;
    }

    if (!state.lastResults) {
      this.showLoading();
      return;
    }

    // Render results
    this.showResults(state.lastResults);
  }

  /**
   * Show loading state
   */
  showLoading(): void {
    this.setResultsVisibility(true);
    this.symbolSummary.renderLoading();
  }

  /**
   * Show empty state (no dice selected)
   */
  showEmptyState(): void {
    this.setResultsVisibility(false);
    this.symbolSummary.renderEmpty();
    this.updateTimestamp('');
  }

  /**
   * Show simulation results
   */
  showResults(results: any): void {
    this.setResultsVisibility(true);
    this.symbolSummary.render(results);
    this.renderCharts();
  }

  /**
   * Render charts based on current mode selections
   */
  renderCharts(): void {
    // Get last results from state is tricky here because we don't hold state.
    // Ideally renderCharts should be passed results.
    // But render() calls showResults() which calls renderCharts().
    // And render() receives state.
    // So we should pass results to renderCharts.
    // However, renderCharts is also called by event handlers which don't have results.
    // Refactoring point: The Controller should handle chart updates, calling a method on UI with results.
    
    // For now, we dispatch an event if we need data we don't have, or we rely on the fact that
    // render() passes results to showResults, which sets them on components? 
    // No, components need results passed to render().
    
    // We'll dispatch the event for legacy support if needed, but prefer explicit calls.
    this.container.dispatchEvent(new CustomEvent('renderCharts', {
      detail: this.getChartModes(),
      bubbles: true
    }));
  }

  /**
   * Explicitly render charts with data (called by Controller)
   */
  public updateCharts(results: any): void {
    const modes = this.getChartModes();
    this.renderDistributionCharts(results, {
      hits: modes.hits,
      blocks: modes.blocks,
      specials: modes.specials
    });
    this.renderBivariateCharts(results, {
      hitsSpecials: modes.hitsSpecials,
      blocksSpecials: modes.blocksSpecials
    });
  }

  /**
   * Get current chart mode selections from UI
   */
  public getChartModes(): {
    hits: ChartMode;
    blocks: ChartMode;
    specials: ChartMode;
    hitsSpecials: ChartMode;
    blocksSpecials: ChartMode;
  } {
    return {
      hits: this.getRadioValue('analysis-mode-hits', 'filled') as ChartMode,
      blocks: this.getRadioValue('analysis-mode-blocks', 'filled') as ChartMode,
      specials: this.getRadioValue('analysis-mode-specials', 'filled') as ChartMode,
      hitsSpecials: this.getRadioValue('analysis-mode-hs', 'filled') as ChartMode,
      blocksSpecials: this.getRadioValue('analysis-mode-bs', 'filled') as ChartMode
    };
  }

  /**
   * Get selected radio button value
   */
  private getRadioValue(name: string, defaultValue: string): string {
    const radio = this.container.querySelector(`input[name="${name}"]:checked`) as HTMLInputElement;
    return radio?.value || defaultValue;
  }

  /**
   * Update timestamp display
   */
  private updateTimestamp(timestamp?: string): void {
    const ts = this.container.querySelector('#results-timestamp') as HTMLElement;
    if (ts) ts.textContent = timestamp || '';
  }

  /**
   * Set visibility of results section
   */
  private setResultsVisibility(visible: boolean): void {
    const summary = this.container.querySelector('#symbol-summary') as HTMLElement;
    const sections = this.container.querySelectorAll('.chart-section');
    
    if (summary) summary.classList.toggle('hidden', !visible);
    sections.forEach(sec => (sec as HTMLElement).classList.toggle('hidden', !visible));
  }

  /**
   * Render distribution charts (called from AnalysisTab)
   */
  renderDistributionCharts(results: any, modes: {
    hits: ChartMode;
    blocks: ChartMode;
    specials: ChartMode;
  }): void {
    this.distributionCharts.render(results, modes);
  }

  /**
   * Render bivariate charts (called from AnalysisTab)
   */
  renderBivariateCharts(results: any, modes: {
    hitsSpecials: ChartMode;
    blocksSpecials: ChartMode;
  }): void {
    this.bivariateCharts.render(results, modes);
  }

  // ==========================================================================
  // Event Binding
  // ==========================================================================

  public bindDiceAdjust(handler: (type: string, isPlus: boolean) => void): void {
    this.container.querySelectorAll('.dice-btn-plus, .dice-btn-minus').forEach(btn => {
      // Cloning to remove old listeners if any? No, just adding new ones. Controller handles lifecycle.
      btn.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          const parent = target.closest('.dice-type');
          if (!parent) return;
          const label = (parent.querySelector('.dice-label') as HTMLElement)?.textContent?.trim();
          if (!label) return;
          const isPlus = target.classList.contains('dice-btn-plus');
          handler(label, isPlus);
      });
    });
  }

  public bindReset(handler: () => void): void {
      const resetBtn = this.container.querySelector('#reset-pool');
      resetBtn?.addEventListener('click', handler);
  }

  public bindStateChange(handler: (type: 'disarmed' | 'vulnerable', value: boolean) => void): void {
      const disarmedEl = this.container.querySelector('#analysis-disarmed') as HTMLInputElement | null;
      if (disarmedEl) {
          disarmedEl.addEventListener('change', () => handler('disarmed', disarmedEl.checked));
      }
      const vulnerableEl = this.container.querySelector('#analysis-vulnerable') as HTMLInputElement | null;
      if (vulnerableEl) {
          vulnerableEl.addEventListener('change', () => handler('vulnerable', vulnerableEl.checked));
      }
  }

  public bindChartModeChange(handler: () => void): void {
      const selectors = [
          'analysis-mode-hits', 'analysis-mode-blocks', 'analysis-mode-specials',
          'analysis-mode-hs', 'analysis-mode-bs'
      ];
      selectors.forEach(name => {
          this.container.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
              radio.addEventListener('change', handler);
          });
      });
  }

  public updateDiceCount(type: string, count: number): void {
      const types = this.container.querySelectorAll('.dice-type');
      types.forEach(el => {
          const label = el.querySelector('.dice-label')?.textContent?.trim();
          if (label === type) {
              const countEl = el.querySelector('.dice-count');
              if (countEl) countEl.textContent = String(count);
          }
      });
  }

  public resetUI(): void {
      this.container.querySelectorAll('.dice-type .dice-count').forEach(el => el.textContent = '0');
      
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

      const disarmedEl = this.container.querySelector('#analysis-disarmed') as HTMLInputElement | null;
      if (disarmedEl) disarmedEl.checked = false;
      const vulnerableEl = this.container.querySelector('#analysis-vulnerable') as HTMLInputElement | null;
      if (vulnerableEl) vulnerableEl.checked = false;
  }
}
