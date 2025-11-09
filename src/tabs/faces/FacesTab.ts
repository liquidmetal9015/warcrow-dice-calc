/**
 * FacesTab - Dice face reference display
 * Shows all dice faces for all colors
 */
import { TabController } from '../base/TabController';
import type { SharedServices } from '../../core/types';
import { isAttackColor } from '../../dice';

export class FacesTab extends TabController {
  protected async onInitialize(): Promise<void> {
    this.renderFaceReference();
  }

  protected onActivate(): void {
    // Re-render in case dice data changed
    this.renderFaceReference();
  }

  protected onDeactivate(): void {
    // Nothing needed
  }

  protected onDispose(): void {
    // Nothing to clean up
  }

  /**
   * Render the complete face reference
   */
  private renderFaceReference(): void {
    const faceGrid = this.container.querySelector('.dice-face-grid') as HTMLElement;
    if (!faceGrid) return;

    faceGrid.innerHTML = '';

    const facesByColor = this.services.diceData.getFaces();
    const order = ['RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE', 'BLACK'] as const;
    const iconMap: Record<typeof order[number], string> = {
      RED: '⚔️',
      ORANGE: '⚔️',
      YELLOW: '⚡',
      GREEN: '🛡️',
      BLUE: '🛡️',
      BLACK: '⚡'
    };

    for (const color of order) {
      const faces = facesByColor[color];
      if (!faces) continue;

      const pretty = color.charAt(0) + color.slice(1).toLowerCase();
      const wrapper = document.createElement('div');
      wrapper.className = 'die-reference';
      wrapper.dataset.color = pretty;

      const role = isAttackColor(color) ? 'Attack' : 'Defense';
      const dieKey = `DIE_${color}`;
      const headerIcon = this.services.icons.renderIcon(dieKey as any, iconMap[color]);

      wrapper.innerHTML = `
        <div class="die-header">
          <div class="dice-icon ${pretty.toLowerCase()}-die">${headerIcon}</div>
          <div class="die-info">
            <h3>${pretty} ${role} Die</h3>
            <p>Faces derived from canonical JSON</p>
          </div>
        </div>
        <div class="face-list"></div>
      `;

      const list = wrapper.querySelector('.face-list') as HTMLElement;
      faces.forEach((face, idx) => {
        const div = document.createElement('div');
        div.className = 'face-item';
        const text = `Face ${idx + 1}: `;

        // Render with icons if available
        const iconMap = this.services.icons.getIconMap();
        if (iconMap) {
          const spans = face.map(sym => {
            const glyph = iconMap[sym];
            if (!glyph) return this.symbolToEmoji(sym);
            return `<span class="wc-icon">${glyph}</span>`;
          }).join(' ');
          div.innerHTML = text + spans;
        } else {
          div.textContent = text + face.map(sym => this.symbolToEmoji(sym)).join(' ');
        }

        list.appendChild(div);
      });

      faceGrid.appendChild(wrapper);
    }
  }

  /**
   * Convert symbol to emoji fallback
   */
  private symbolToEmoji(sym: string): string {
    switch (sym) {
      case 'HIT': return '⚔️ HIT';
      case 'HOLLOW_HIT': return '⭕ HOLLOW HIT';
      case 'BLOCK': return '🛡️ BLOCK';
      case 'HOLLOW_BLOCK': return '⭕ HOLLOW BLOCK';
      case 'SPECIAL': return '⚡ SPECIAL';
      case 'HOLLOW_SPECIAL': return '⭕ HOLLOW SPECIAL';
      default: return sym;
    }
  }
}

