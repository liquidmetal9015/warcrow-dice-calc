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
    const state = this.getChartModes();
    
    // Get last results from state (we need access to this)
    const summaryEl = this.container.querySelector('#symbol-summary') as HTMLElement;
    const resultsContainer = summaryEl.closest('.results-section');
    if (!resultsContainer) return;

    // For now, we'll trigger chart rendering via a custom event
    // The AnalysisTab will listen for this and call the appropriate methods
    this.container.dispatchEvent(new CustomEvent('renderCharts', {
      detail: state,
      bubbles: true
    }));
  }

  /**
   * Get current chart mode selections from UI
   */
  private getChartModes(): {
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
}

