/**
 * DiceData - Centralized dice faces data loading and management
 * Single source of truth for dice face definitions
 */
import type { FacesByColor, SymbolKey } from '../domain/dice';

export class DiceData {
  private facesByColor: FacesByColor | null = null;
  private loadPromise: Promise<FacesByColor> | null = null;

  /**
   * Load dice faces from JSON file (singleton pattern)
   */
  async load(): Promise<FacesByColor> {
    // Return cached data if already loaded
    if (this.facesByColor) {
      return this.facesByColor;
    }

    // Return existing promise if load is in progress
    if (this.loadPromise) {
      return this.loadPromise;
    }

    // Start new load
    this.loadPromise = this.fetchDiceFaces();
    this.facesByColor = await this.loadPromise;
    return this.facesByColor;
  }

  /**
   * Get cached dice faces (throws if not loaded)
   */
  getFaces(): FacesByColor {
    if (!this.facesByColor) {
      throw new Error('Dice faces not loaded. Call load() first.');
    }
    return this.facesByColor;
  }

  /**
   * Check if dice faces are loaded
   */
  isLoaded(): boolean {
    return this.facesByColor !== null;
  }

  /**
   * Fetch dice faces from JSON file
   */
  private async fetchDiceFaces(): Promise<FacesByColor> {
    const base = import.meta.env.BASE_URL || '/';
    const path = base.endsWith('/') 
      ? base + 'warcrow_dice_faces.json' 
      : base + '/warcrow_dice_faces.json';
    
    const resp = await fetch(path, { cache: 'no-store' });
    
    if (!resp.ok) {
      throw new Error(`Failed to load warcrow_dice_faces.json (${resp.status})`);
    }
    
    const faces = await resp.json() as FacesByColor;
    
    // Validate structure
    this.validateFaces(faces);
    
    return faces;
  }

  /**
   * Validate dice faces structure
   */
  private validateFaces(faces: FacesByColor): void {
    const requiredColors = ['RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE', 'BLACK'];
    
    for (const color of requiredColors) {
      if (!faces[color]) {
        throw new Error(`Missing dice color: ${color}`);
      }
      
      const colorFaces = faces[color];
      if (!Array.isArray(colorFaces) || colorFaces.length !== 8) {
        throw new Error(`Die ${color} must have exactly 8 faces (found ${colorFaces?.length})`);
      }

      // Validate each face has valid symbols
      colorFaces.forEach((face, idx) => {
        if (!Array.isArray(face)) {
          throw new Error(`Die ${color} face ${idx} is not an array`);
        }
      });
    }
  }

  /**
   * Get faces for a specific color
   */
  getFacesForColor(color: string): ReadonlyArray<ReadonlyArray<SymbolKey>> | null {
    if (!this.facesByColor) return null;
    return this.facesByColor[color] || null;
  }
}

// Singleton instance
export const diceData = new DiceData();

