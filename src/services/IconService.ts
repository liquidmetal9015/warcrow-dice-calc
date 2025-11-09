/**
 * IconService - Manages Warcrow icon glyphs from custom font
 * Provides centralized icon rendering with fallbacks
 */
export type IconKey = 
  | 'HIT' | 'HOLLOW_HIT' 
  | 'BLOCK' | 'HOLLOW_BLOCK' 
  | 'SPECIAL' | 'HOLLOW_SPECIAL'
  | 'DIE_RED' | 'DIE_ORANGE' | 'DIE_YELLOW'
  | 'DIE_GREEN' | 'DIE_BLUE' | 'DIE_BLACK'
  | 'STRESS' | 'WOUND';

const ICON_MAP: Record<IconKey, string> = {
  'HIT': '1',
  'HOLLOW_HIT': '2',
  'BLOCK': '3',
  'HOLLOW_BLOCK': '4',
  'SPECIAL': '5',
  'HOLLOW_SPECIAL': '6',
  'DIE_BLACK': '7',
  'DIE_BLUE': '8',
  'DIE_GREEN': '9',
  'DIE_YELLOW': '0',
  'DIE_ORANGE': 'q',
  'DIE_RED': 'w',
  'STRESS': 'f',
  'WOUND': 'L'
};

const FALLBACK_MAP: Record<IconKey, string> = {
  'HIT': '⚔️',
  'HOLLOW_HIT': '⭕',
  'BLOCK': '🛡️',
  'HOLLOW_BLOCK': '⭕',
  'SPECIAL': '⚡',
  'HOLLOW_SPECIAL': '⭕',
  'DIE_RED': '⚔️',
  'DIE_ORANGE': '⚔️',
  'DIE_YELLOW': '⚡',
  'DIE_GREEN': '🛡️',
  'DIE_BLUE': '🛡️',
  'DIE_BLACK': '⚡',
  'STRESS': '💢',
  'WOUND': '❤️'
};

export class IconService {
  private missingIconsLogged = new Set<string>();

  /**
   * Get icon glyph from the Warcrow font
   */
  getGlyph(key: IconKey): string | null {
    return ICON_MAP[key] || null;
  }

  /**
   * Get fallback emoji for icon
   */
  getFallback(key: IconKey): string {
    return FALLBACK_MAP[key] || key;
  }

  /**
   * Render icon as HTML span with Warcrow font or fallback
   */
  renderIcon(key: IconKey, fallbackText?: string): string {
    const glyph = this.getGlyph(key);
    if (glyph) {
      return `<span class="wc-icon">${glyph}</span>`;
    }
    
    // Log missing icon once
    this.logMissingIcon(key);
    
    const fallback = fallbackText || this.getFallback(key);
    return `<span class="wc-fallback">${fallback}</span>`;
  }

  /**
   * Check if icon font is loaded
   */
  isIconFontLoaded(): boolean {
    const map = (window as any).WARCROW_ICON_MAP;
    return map && typeof map === 'object';
  }

  /**
   * Get the icon map from global scope (for backward compatibility)
   */
  getIconMap(): Record<string, string> | null {
    const map = (window as any).WARCROW_ICON_MAP;
    return map && typeof map === 'object' ? map : null;
  }

  /**
   * Log missing icon warning (once per icon)
   */
  private logMissingIcon(key: string): void {
    if (!this.missingIconsLogged.has(key)) {
      console.warn(`[IconService] Missing glyph for ${key}; using fallback.`);
      this.missingIconsLogged.add(key);
    }
  }
}

// Singleton instance
export const iconService = new IconService();

