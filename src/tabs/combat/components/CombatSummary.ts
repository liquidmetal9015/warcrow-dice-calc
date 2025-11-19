/**
 * CombatSummary - Renders combat summary statistics
 */
import type { CombatResults } from '../../../domain/dice';
import type { IconService } from '../../../services/IconService';

export class CombatSummary {
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
   * Render combat summary with results
   */
  render(results: CombatResults): void {
    const ex = results.expected || {};
    const safe = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const icon = (key: string, fallback?: string) => this.iconService.renderIcon(key as any, fallback);

    this.container.innerHTML = `
      <div class="combat-stats">
        <div class="stat-group attacker-stats">
          <h3>Attacker</h3>
          <div class="stat-item">
            <span class="stat-label">${icon('HIT','⚔️')} Hits</span>
            <span class="stat-value">${safe(ex.attackerHits).toFixed(2)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">${icon('SPECIAL','⚡')} Specials</span>
            <span class="stat-value">${safe(ex.attackerSpecials).toFixed(2)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">${icon('BLOCK','🛡️')} Blocks</span>
            <span class="stat-value">${safe(ex.attackerBlocks).toFixed(2)}</span>
          </div>
        </div>
        <div class="stat-group defender-stats">
          <h3>Defender</h3>
          <div class="stat-item">
            <span class="stat-label">${icon('HIT','⚔️')} Hits</span>
            <span class="stat-value">${safe(ex.defenderHits).toFixed(2)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">${icon('SPECIAL','⚡')} Specials</span>
            <span class="stat-value">${safe(ex.defenderSpecials).toFixed(2)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">${icon('BLOCK','🛡️')} Blocks</span>
            <span class="stat-value">${safe(ex.defenderBlocks).toFixed(2)}</span>
          </div>
        </div>
        <div class="stat-group outcome-stats">
          <h3>Outcome</h3>
          <div class="stat-item">
            <span class="stat-label">Attacker Win Rate</span>
            <span class="stat-value">${safe(results.attackerWinRate).toFixed(1)}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Attacker Tie Rate</span>
            <span class="stat-value">${safe(results.attackerTieRate).toFixed(1)}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Attacker Loss Rate</span>
            <span class="stat-value">${safe(results.attackerLossRate).toFixed(1)}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">${icon('WOUND','❤')} Wounds (Attacker → Defender)</span>
            <span class="stat-value">${safe(ex.woundsAttacker).toFixed(2)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">${icon('WOUND','❤')} Wounds (Defender → Attacker)</span>
            <span class="stat-value">${safe(ex.woundsDefender).toFixed(2)}</span>
          </div>
        </div>
      </div>
    `;
  }
}

