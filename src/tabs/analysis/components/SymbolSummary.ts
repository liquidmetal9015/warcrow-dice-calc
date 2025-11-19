/**
 * SymbolSummary - Renders the symbol summary statistics
 */
import type { MonteCarloResults } from '../../../domain/dice';
import type { IconService } from '../../../services/IconService';

export class SymbolSummary {
  private container: HTMLElement;
  private iconService: IconService;

  constructor(container: HTMLElement, iconService: IconService) {
    this.container = container;
    this.iconService = iconService;
  }

  /**
   * Render loading state
   */
  renderLoading(): void {
    this.container.innerHTML = `
      <div class="loading-placeholder">
        <div class="skeleton-card">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>
      </div>
    `;
  }

  /**
   * Render empty state
   */
  renderEmpty(): void {
    this.container.innerHTML = '';
  }

  /**
   * Render summary with results
   */
  render(results: MonteCarloResults): void {
    const ex = results.expected || {};
    const sd = results.std || {};
    const safe = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const minMax = this.computeMinMax(results);
    const icon = (key: string, fallback?: string) => this.iconService.renderIcon(key as any, fallback);

    this.container.innerHTML = `
      <div class="symbol-group">
        <h3>${icon('HIT','⚔️')} Hits</h3>
        <div class="symbol-stats">
          <div class="stat-item">
            <span class="stat-label">Expected</span>
            <span class="stat-value">${safe(ex.hits).toFixed(2)} ± ${safe(sd.hits).toFixed(2)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Min</span>
            <span class="stat-value">${minMax.hits.min}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Max</span>
            <span class="stat-value">${minMax.hits.max}</span>
          </div>
        </div>
      </div>
      <div class="symbol-group">
        <h3>${icon('BLOCK','🛡️')} Blocks</h3>
        <div class="symbol-stats">
          <div class="stat-item">
            <span class="stat-label">Expected</span>
            <span class="stat-value">${safe(ex.blocks).toFixed(2)} ± ${safe(sd.blocks).toFixed(2)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Min</span>
            <span class="stat-value">${minMax.blocks.min}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Max</span>
            <span class="stat-value">${minMax.blocks.max}</span>
          </div>
        </div>
      </div>
      <div class="symbol-group">
        <h3>${icon('SPECIAL','⚡')} Specials</h3>
        <div class="symbol-stats">
          <div class="stat-item">
            <span class="stat-label">Expected</span>
            <span class="stat-value">${safe(ex.specials).toFixed(2)} ± ${safe(sd.specials).toFixed(2)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Min</span>
            <span class="stat-value">${minMax.specials.min}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Max</span>
            <span class="stat-value">${minMax.specials.max}</span>
          </div>
        </div>
      </div>
      ${this.renderRerollStats(results)}
    `;
  }

  /**
   * Render reroll statistics if present
   */
  private renderRerollStats(results: MonteCarloResults): string {
    if (!results.rerollStats) return '';

    const stats = results.rerollStats;
    const hasRerolls = stats.fullRerollsOccurred > 0 || stats.diceRerolledCount > 0;

    if (!hasRerolls) {
      return `
        <div class="symbol-group reroll-stats">
          <h3>Rerolls</h3>
          <div class="symbol-stats">
            <div class="stat-item">
              <span class="stat-label">No rerolls</span>
              <span class="stat-value">—</span>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="symbol-group reroll-stats">
        <h3>Rerolls</h3>
        <div class="symbol-stats">
          ${stats.fullRerollsOccurred > 0 ? `
            <div class="stat-item">
              <span class="stat-label">Repeat Roll %</span>
              <span class="stat-value">${((stats.fullRerollsOccurred / stats.totalRolls) * 100).toFixed(1)}%</span>
            </div>
          ` : ''}
          ${stats.diceRerolledCount > 0 ? `
            <div class="stat-item">
              <span class="stat-label">Avg Dice Repeated/Roll</span>
              <span class="stat-value">${(stats.diceRerolledCount / stats.totalRolls).toFixed(2)}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Compute min/max values from distributions
   */
  private computeMinMax(results: MonteCarloResults): {
    [k in 'hits'|'blocks'|'specials']: { min: number; max: number }
  } {
    const out: any = {};
    const pairs: Array<['hits'|'blocks'|'specials', Record<number, number>]> = [
      ['hits', results.hits],
      ['blocks', results.blocks],
      ['specials', results.specials]
    ];

    for (const [key, map] of pairs) {
      const present = Object.keys(map)
        .map(k => parseInt(k, 10))
        .filter(n => !Number.isNaN(n) && (map[n] || 0) > 0);
      
      out[key] = present.length === 0 
        ? { min: 0, max: 0 } 
        : { min: Math.min(...present), max: Math.max(...present) };
    }

    return out;
  }
}

