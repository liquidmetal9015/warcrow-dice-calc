/**
 * Core types shared across the application
 */
import type { FacesByColor } from '../domain/dice';
import type { StorageService } from '../services/StorageService';
import type { ChartService } from '../services/ChartService';
import type { IconService } from '../services/IconService';
import type { SimulationController } from '../controllers/simulationController';
import type { DiceData } from './DiceData';

/**
 * Tab names in the application
 */
export type TabName = 'analysis' | 'combat' | 'faces' | 'explorer';

/**
 * Dice colors
 */
export type DiceColor = 'Red' | 'Orange' | 'Yellow' | 'Green' | 'Blue' | 'Black';

/**
 * Dice pool (color -> count mapping)
 */
export type DicePool = Record<DiceColor, number>;

/**
 * Shared services available to all tabs
 */
export interface SharedServices {
  storage: StorageService;
  charts: ChartService;
  icons: IconService;
  simulation: SimulationController;
  diceData: DiceData;
}

/**
 * Event handler type for generic events
 */
export type EventHandler<T = void> = (data: T) => void;

/**
 * State change listener
 */
export type StateChangeListener<T> = (state: T) => void;

