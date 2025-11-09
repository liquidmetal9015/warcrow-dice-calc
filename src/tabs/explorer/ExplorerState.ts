/**
 * ExplorerState - State management for the Explorer tab
 * Manages manual dice rolling and reroll priority analysis
 */
import { TabState } from '../base/TabState';
import type { DicePool, DiceColor } from '../../core/types';

export interface DieState {
  color: DiceColor;
  faceIndex: number;
}

export type PriorityMode = 'hits' | 'blocks' | 'specials';

export interface ExplorerStateData {
  pool: DicePool;
  diceStates: DieState[];
  priorityMode: PriorityMode;
  countHollowAsFilled: boolean;
}

export class ExplorerState extends TabState<ExplorerStateData> {
  constructor() {
    super({
      pool: { Red: 0, Orange: 0, Yellow: 0, Green: 0, Blue: 0, Black: 0 },
      diceStates: [],
      priorityMode: 'hits',
      countHollowAsFilled: false
    });
  }

  // Pool management
  getPool(): DicePool {
    return { ...this.state.pool };
  }

  setDiceCount(color: keyof DicePool, count: number): void {
    const newCount = Math.max(0, Math.min(10, count)); // Limit to 0-10
    this.updateState({
      pool: { ...this.state.pool, [color]: newCount }
    });
    
    // Update dice states to match new pool
    this.rebuildDiceStates();
  }

  clearPool(): void {
    this.updateState({
      pool: { Red: 0, Orange: 0, Yellow: 0, Green: 0, Blue: 0, Black: 0 },
      diceStates: []
    });
  }

  getTotalDice(): number {
    return Object.values(this.state.pool).reduce((s, c) => s + c, 0);
  }

  // Dice states management
  getDiceStates(): DieState[] {
    return [...this.state.diceStates];
  }

  setDieFaceIndex(dieIndex: number, faceIndex: number): void {
    const newStates = [...this.state.diceStates];
    if (newStates[dieIndex]) {
      newStates[dieIndex] = { ...newStates[dieIndex], faceIndex };
      this.updateState({ diceStates: newStates });
    }
  }

  rollAllDice(): void {
    const newStates = this.state.diceStates.map(die => ({
      ...die,
      faceIndex: Math.floor(Math.random() * 8)
    }));
    this.updateState({ diceStates: newStates });
  }

  rollSingleDie(dieIndex: number): void {
    const newStates = [...this.state.diceStates];
    if (newStates[dieIndex]) {
      newStates[dieIndex] = {
        ...newStates[dieIndex],
        faceIndex: Math.floor(Math.random() * 8)
      };
      this.updateState({ diceStates: newStates });
    }
  }

  /**
   * Rebuild dice states to match current pool
   */
  private rebuildDiceStates(): void {
    const newStates: DieState[] = [];
    let id = 0;

    for (const [color, count] of Object.entries(this.state.pool)) {
      for (let i = 0; i < count; i++) {
        const existing = this.state.diceStates[id];
        newStates.push({
          color: color as DiceColor,
          faceIndex: existing?.faceIndex ?? Math.floor(Math.random() * 8)
        });
        id++;
      }
    }

    this.updateState({ diceStates: newStates });
  }

  // Priority mode
  getPriorityMode(): PriorityMode {
    return this.state.priorityMode;
  }

  setPriorityMode(mode: PriorityMode): void {
    this.updateState({ priorityMode: mode });
  }

  // Hollow as filled setting
  getCountHollowAsFilled(): boolean {
    return this.state.countHollowAsFilled;
  }

  setCountHollowAsFilled(value: boolean): void {
    this.updateState({ countHollowAsFilled: value });
  }
}

