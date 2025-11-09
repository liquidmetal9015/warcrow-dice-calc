/**
 * ExplorerUI - UI rendering and management for Explorer tab
 */
import type { SharedServices } from '../../core/types';
import type { ExplorerStateData } from './ExplorerState';
import { renderDieCard, renderAggregateAnalysis } from '../../ui/rerollExplorer';
import {
  normalizeColor,
  getWeightsForPriorityMode,
  computeColorExpectedValues,
  selectDiceToReroll,
  scoreDie,
  countSymbolsFromFace
} from '../../dice';
import type { Aggregate, Pool } from '../../dice';
import type { RepeatRollConfig, DieRoll } from '../../types/reroll';

export class ExplorerUI {
  private container: HTMLElement;
  private services: SharedServices;

  constructor(container: HTMLElement, services: SharedServices) {
    this.container = container;
    this.services = services;
  }

  /**
   * Render the explorer state
   */
  render(state: ExplorerStateData): void {
    const listEl = this.container.querySelector('#explorer-dice-list') as HTMLElement;
    const aggregateEl = this.container.querySelector('#explorer-aggregate-section') as HTMLElement;

    if (!listEl || !aggregateEl) return;

    if (state.diceStates.length === 0) {
      this.showEmptyState(listEl, aggregateEl);
      return;
    }

    this.renderDice(state, listEl, aggregateEl);
  }

  /**
   * Show empty state (no dice)
   */
  private showEmptyState(listEl: HTMLElement, aggregateEl: HTMLElement): void {
    listEl.innerHTML = '<p class="no-dice">Add dice to your pool to get started</p>';
    aggregateEl.style.display = 'none';
  }

  /**
   * Render dice and aggregate analysis
   */
  private renderDice(state: ExplorerStateData, listEl: HTMLElement, aggregateEl: HTMLElement): void {
    const facesByColor = this.services.diceData.getFaces();
    
    // Calculate aggregate and individual die data
    const { aggregate, dieRolls } = this.calculateAggregate(state, facesByColor);

    // Calculate reroll priorities
    const weights = getWeightsForPriorityMode(state.priorityMode, state.countHollowAsFilled);
    const colorExpectations = computeColorExpectedValues(facesByColor, weights);

    // Filter eligible dice (that can contribute to objective)
    const eligibleDiceIndices = dieRolls
      .map((die, idx) => ({ die, idx }))
      .filter(({ die }) => {
        const colorKey = normalizeColor(die.color);
        const expectedValue = colorExpectations[colorKey];
        return expectedValue !== undefined && expectedValue > 0;
      })
      .map(({ idx }) => idx);

    // Select dice for reroll
    const eligibleDieRolls = eligibleDiceIndices.map(idx => dieRolls[idx]!);
    const relativeRerollIndices = selectDiceToReroll(eligibleDieRolls, eligibleDieRolls.length, weights, facesByColor);
    const rerollIndicesArray = relativeRerollIndices.map(relativeIdx => eligibleDiceIndices[relativeIdx]!);

    // Create reroll priorities map
    const rerollPriorities = new Map<number, number>();
    rerollIndicesArray.forEach((dieIdx, priorityRank) => {
      rerollPriorities.set(dieIdx, priorityRank + 1);
    });

    // Render aggregate section
    const pool = this.convertPoolToStandardFormat(state.pool);
    const fakeRepeatRollConfig: RepeatRollConfig = {
      enabled: true,
      condition: {
        type: 'BelowExpected',
        symbol: state.priorityMode === 'blocks' ? 'blocks' : state.priorityMode === 'specials' ? 'specials' : 'hits'
      }
    };

    aggregateEl.innerHTML = renderAggregateAnalysis(aggregate, pool, facesByColor, fakeRepeatRollConfig);
    aggregateEl.style.display = 'block';

    // Render die cards
    const cardsHTML = state.diceStates.map((die, idx) => {
      const dieRoll = dieRolls[idx];
      if (!dieRoll) return '';

      const score = scoreDie(dieRoll, weights, colorExpectations);
      const colorKey = normalizeColor(die.color);
      const faces = facesByColor[colorKey];
      if (!faces) return '';

      return renderDieCard(
        { id: idx, color: die.color, faceIndex: die.faceIndex },
        faces,
        dieRoll,
        score,
        rerollPriorities.get(idx) || null,
        state.priorityMode,
        state.countHollowAsFilled,
        (newFaceIndex) => {
          this.container.dispatchEvent(new CustomEvent('setDieFace', {
            detail: { dieIndex: idx, faceIndex: newFaceIndex },
            bubbles: true
          }));
        },
        () => {
          this.container.dispatchEvent(new CustomEvent('rollDie', {
            detail: { dieIndex: idx },
            bubbles: true
          }));
        }
      );
    }).join('');

    listEl.innerHTML = cardsHTML;
  }

  /**
   * Calculate aggregate results from dice states
   */
  private calculateAggregate(state: ExplorerStateData, facesByColor: any): {
    aggregate: Aggregate;
    dieRolls: DieRoll[];
  } {
    const aggregate: Aggregate = {
      hits: 0, blocks: 0, specials: 0,
      hollowHits: 0, hollowBlocks: 0, hollowSpecials: 0
    };

    const dieRolls: DieRoll[] = [];

    state.diceStates.forEach(die => {
      const colorKey = normalizeColor(die.color);
      const faces = facesByColor[colorKey];
      if (!faces) return;

      const face = faces[die.faceIndex];
      if (!face) return;

      const symbols = countSymbolsFromFace(face);
      dieRolls.push({ color: colorKey, faceIndex: die.faceIndex, symbols });

      aggregate.hits += symbols.hits;
      aggregate.blocks += symbols.blocks;
      aggregate.specials += symbols.specials;
      aggregate.hollowHits += symbols.hollowHits;
      aggregate.hollowBlocks += symbols.hollowBlocks;
      aggregate.hollowSpecials += symbols.hollowSpecials;
    });

    return { aggregate, dieRolls };
  }

  /**
   * Convert DicePool to Pool format
   */
  private convertPoolToStandardFormat(pool: any): Pool {
    const result: Pool = {};
    for (const [color, count] of Object.entries(pool)) {
      if ((count as number) > 0) {
        result[color] = count as number;
      }
    }
    return result;
  }
}

