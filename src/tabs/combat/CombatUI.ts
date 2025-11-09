/**
 * CombatUI - UI rendering and management for Combat tab
 */
import type { SharedServices } from '../../core/types';
import type { CombatStateData } from './CombatState';
import { CombatSummary } from './components/CombatSummary';
import { CombatCharts } from './components/CombatCharts';

export class CombatUI {
  private container: HTMLElement;
  private services: SharedServices;
  private summary: CombatSummary;
  private charts: CombatCharts;

  constructor(container: HTMLElement, services: SharedServices) {
    this.container = container;
    this.services = services;

    // Initialize components
    const summaryEl = this.container.querySelector('#combat-summary') as HTMLElement;
    this.summary = new CombatSummary(summaryEl, services.icons);
    this.charts = new CombatCharts(services.charts);
  }

  /**
   * Render the combat state
   */
  render(state: CombatStateData): void {
    this.updateTimestamp(state.lastResults?.timestamp);

    if (state.isSimulating) {
      this.showLoading();
      return;
    }

    const totals = {
      attacker: Object.values(state.attackerPool).reduce((s, c) => s + c, 0),
      defender: Object.values(state.defenderPool).reduce((s, c) => s + c, 0)
    };

    if (totals.attacker === 0 && totals.defender === 0) {
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
    this.summary.renderLoading();
  }

  /**
   * Show empty state
   */
  showEmptyState(): void {
    this.setResultsVisibility(false);
    this.summary.renderEmpty();
    this.updateTimestamp('');
  }

  /**
   * Show combat results
   */
  showResults(results: any): void {
    this.setResultsVisibility(true);
    this.summary.render(results);
    this.charts.render(results);
  }

  /**
   * Update timestamp display
   */
  private updateTimestamp(timestamp?: string): void {
    const ts = this.container.querySelector('#combat-results-timestamp') as HTMLElement;
    if (ts) ts.textContent = timestamp || '';
  }

  /**
   * Set visibility of results section
   */
  private setResultsVisibility(visible: boolean): void {
    const summary = this.container.querySelector('#combat-summary') as HTMLElement;
    const chartContainers = this.container.querySelectorAll('.chart-container');

    if (summary) summary.classList.toggle('hidden', !visible);
    chartContainers.forEach(container => {
      (container as HTMLElement).classList.toggle('hidden', !visible);
    });
  }
}

