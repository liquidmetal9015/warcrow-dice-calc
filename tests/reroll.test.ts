import { describe, it, expect } from 'vitest';
import {
  simulateDiceRollWithRerolls,
  shouldRerollAggregate,
  computePoolExpectedValue,
  selectDiceToReroll,
  scoreDie,
  computeColorExpectedValues,
  getWeightsForPriorityMode,
  simulateDiceRollDetailed,
  DS
} from '../src/dice';
import type { Pool, FacesByColor, Aggregate } from '../src/dice';
import type { RepeatRollConfig, RepeatDiceConfig, DieRoll } from '../src/types/reroll';
import { makeLinearRng } from './utils';

// Test dice faces stub (simplified but realistic)
const facesByColor: FacesByColor = {
  RED: [ 
    [DS.HIT, DS.HIT],        // 0: Great roll (2 hits)
    [DS.HIT],                // 1: Good roll (1 hit)
    [DS.HIT, DS.SPECIAL],    // 2: Good roll (1 hit + special)
    [DS.HOLLOW_HIT],         // 3: Mediocre
    [DS.HIT],                // 4: Good roll
    [DS.SPECIAL],            // 5: No hits
    [DS.SPECIAL],            // 6: No hits
    [DS.HOLLOW_HIT]          // 7: Mediocre
  ],
  YELLOW: [ 
    [DS.SPECIAL],            // 0: No hits
    [DS.SPECIAL],            // 1: No hits
    [DS.HOLLOW_HIT],         // 2: Mediocre
    [DS.SPECIAL],            // 3: No hits
    [DS.SPECIAL],            // 4: No hits
    [DS.SPECIAL],            // 5: No hits
    [DS.HIT],                // 6: Some hits
    [DS.SPECIAL]             // 7: No hits
  ],
  GREEN: [ 
    [DS.BLOCK],              
    [DS.BLOCK],              
    [DS.HOLLOW_BLOCK],       
    [DS.SPECIAL],            
    [DS.BLOCK],              
    [DS.BLOCK],              
    [DS.HOLLOW_BLOCK],       
    [DS.SPECIAL]             
  ],
  BLUE: [ 
    [DS.BLOCK],              
    [DS.SPECIAL],            
    [DS.BLOCK],              
    [DS.SPECIAL],            
    [DS.BLOCK],              
    [DS.SPECIAL],            
    [DS.HOLLOW_BLOCK],       
    [DS.BLOCK]               
  ]
};

describe('Reroll Functionality', () => {

  describe('computePoolExpectedValue', () => {
    it('calculates expected hits for a single red die', () => {
      const pool: Pool = { RED: 1 };
      const expected = computePoolExpectedValue(pool, facesByColor, 'hits');
      
      // Red die should have higher expected hits
      expect(expected).toBeGreaterThan(0);
      expect(expected).toBeLessThan(3); // Reasonable range
    });

    it('calculates expected value for multiple dice', () => {
      const pool: Pool = { RED: 2, YELLOW: 1 };
      const expected = computePoolExpectedValue(pool, facesByColor, 'hits');
      
      // Should be sum of individual expectations
      expect(expected).toBeGreaterThan(0);
    });
  });

  describe('shouldRerollAggregate', () => {
    it('returns true when below expected', () => {
      const pool: Pool = { RED: 2 };
      const agg: Aggregate = {
        hits: 0,
        blocks: 0,
        specials: 0,
        hollowHits: 0,
        hollowBlocks: 0,
        hollowSpecials: 0
      };
      const condition = { type: 'BelowExpected' as const, symbol: 'hits' as const };
      
      const shouldReroll = shouldRerollAggregate(agg, condition, pool, facesByColor);
      expect(shouldReroll).toBe(true);
    });

    it('returns false when at or above expected', () => {
      const pool: Pool = { YELLOW: 1 };
      const agg: Aggregate = {
        hits: 10,
        blocks: 0,
        specials: 0,
        hollowHits: 0,
        hollowBlocks: 0,
        hollowSpecials: 0
      };
      const condition = { type: 'BelowExpected' as const, symbol: 'hits' as const };
      
      const shouldReroll = shouldRerollAggregate(agg, condition, pool, facesByColor);
      expect(shouldReroll).toBe(false);
    });

    it('handles NoSymbol condition', () => {
      const pool: Pool = { RED: 1 };
      const agg: Aggregate = {
        hits: 0,
        blocks: 1,
        specials: 0,
        hollowHits: 0,
        hollowBlocks: 0,
        hollowSpecials: 0
      };
      const condition = { type: 'NoSymbol' as const, symbol: 'hits' as const };
      
      const shouldReroll = shouldRerollAggregate(agg, condition, pool, facesByColor);
      expect(shouldReroll).toBe(true);
    });
  });

  describe('scoreDie', () => {
    it('returns negative score for underperforming die', () => {
      const die: DieRoll = {
        color: 'RED',
        faceIndex: 0,
        symbols: {
          hits: 0,
          blocks: 0,
          specials: 0,
          hollowHits: 0,
          hollowBlocks: 0,
          hollowSpecials: 0
        }
      };
      
      const weights = getWeightsForPriorityMode('hits', false);
      const expectations = computeColorExpectedValues(facesByColor, weights);
      const score = scoreDie(die, weights, expectations);
      
      expect(score).toBeLessThan(0); // Underperformed
    });

    it('prioritizes red die over yellow die with same result', () => {
      const redDie: DieRoll = {
        color: 'RED',
        faceIndex: 0,
        symbols: {
          hits: 0,
          blocks: 0,
          specials: 0,
          hollowHits: 0,
          hollowBlocks: 0,
          hollowSpecials: 0
        }
      };

      const yellowDie: DieRoll = {
        color: 'YELLOW',
        faceIndex: 0,
        symbols: {
          hits: 0,
          blocks: 0,
          specials: 0,
          hollowHits: 0,
          hollowBlocks: 0,
          hollowSpecials: 0
        }
      };
      
      const weights = getWeightsForPriorityMode('hits', false);
      const expectations = computeColorExpectedValues(facesByColor, weights);
      
      const redScore = scoreDie(redDie, weights, expectations);
      const yellowScore = scoreDie(yellowDie, weights, expectations);
      
      // Red should have more negative score (worse relative to expectation)
      expect(redScore).toBeLessThan(yellowScore);
    });
  });

  describe('selectDiceToReroll', () => {
    it('selects worst-performing dice', () => {
      const dice: DieRoll[] = [
        {
          color: 'RED',
          faceIndex: 0,
          symbols: { hits: 0, blocks: 0, specials: 0, hollowHits: 0, hollowBlocks: 0, hollowSpecials: 0 }
        },
        {
          color: 'RED',
          faceIndex: 7,
          symbols: { hits: 2, blocks: 0, specials: 1, hollowHits: 0, hollowBlocks: 0, hollowSpecials: 0 }
        }
      ];
      
      const weights = getWeightsForPriorityMode('hits', false);
      const toReroll = selectDiceToReroll(dice, 1, weights, facesByColor);
      
      expect(toReroll).toEqual([0]); // First die (0 hits) should be selected
    });

    it('respects maxDiceToReroll limit', () => {
      const dice: DieRoll[] = [
        { color: 'RED', faceIndex: 0, symbols: { hits: 0, blocks: 0, specials: 0, hollowHits: 0, hollowBlocks: 0, hollowSpecials: 0 } },
        { color: 'RED', faceIndex: 0, symbols: { hits: 0, blocks: 0, specials: 0, hollowHits: 0, hollowBlocks: 0, hollowSpecials: 0 } },
        { color: 'RED', faceIndex: 0, symbols: { hits: 0, blocks: 0, specials: 0, hollowHits: 0, hollowBlocks: 0, hollowSpecials: 0 } }
      ];
      
      const weights = getWeightsForPriorityMode('hits', false);
      const toReroll = selectDiceToReroll(dice, 2, weights, facesByColor);
      
      expect(toReroll.length).toBe(2);
    });

    it('only rerolls dice below expected value', () => {
      // RED die with 2 hits (above expected), 1 hit (at/above expected), and hollow hit (below expected)
      const dice: DieRoll[] = [
        { color: 'RED', faceIndex: 0, symbols: { hits: 2, blocks: 0, specials: 0, hollowHits: 0, hollowBlocks: 0, hollowSpecials: 0 } }, // Great roll
        { color: 'RED', faceIndex: 1, symbols: { hits: 1, blocks: 0, specials: 0, hollowHits: 0, hollowBlocks: 0, hollowSpecials: 0 } }, // Good roll
        { color: 'RED', faceIndex: 3, symbols: { hits: 0, blocks: 0, specials: 0, hollowHits: 1, hollowBlocks: 0, hollowSpecials: 0 } }  // Bad (hollow doesn't count)
      ];
      
      const weights = getWeightsForPriorityMode('hits', false);
      const toReroll = selectDiceToReroll(dice, 10, weights, facesByColor); // Max of 10, but should only reroll underperformers
      
      // Should only reroll die 2 (hollow hit), NOT the ones with actual hits
      expect(toReroll.length).toBe(1);
      expect(toReroll).not.toContain(0); // First die should NOT be rerolled (2 hits)
      expect(toReroll).not.toContain(1); // Second die should NOT be rerolled (1 hit)
      expect(toReroll).toContain(2); // Third die SHOULD be rerolled (only hollow hit)
    });
  });

  describe('simulateDiceRollWithRerolls', () => {
    it('performs full reroll exactly once when condition met', () => {
      const pool: Pool = { RED: 1 };
      let rollCount = 0;
      
      const rng = () => {
        const faceIndex = rollCount === 0 ? 5 : 0; // First bad (face 5 = no hits), then good (face 0 = 2 hits)
        rollCount++;
        return (faceIndex + 0.1) / 8; // Convert face index to RNG value
      };
      
      const repeatRollConfig: RepeatRollConfig = {
        enabled: true,
        condition: { type: 'BelowExpected', symbol: 'hits' }
      };
      
      const result = simulateDiceRollWithRerolls(
        pool,
        facesByColor,
        repeatRollConfig,
        null,
        rng
      );
      
      // Should roll dice twice: initial roll + one reroll (because below expected)
      expect(rollCount).toBe(2);
      expect(result.aggregate.hits).toBeGreaterThanOrEqual(0);
      expect(result.stats.fullRerollsOccurred).toBe(1);
    });

    it('does not reroll when condition not met', () => {
      const pool: Pool = { RED: 1 };
      let rollCount = 0;
      
      const rng = () => {
        rollCount++;
        return 0.01; // Always face 0 (2 hits - good result, above expected)
      };
      
      const repeatRollConfig: RepeatRollConfig = {
        enabled: true,
        condition: { type: 'BelowExpected', symbol: 'hits' }
      };
      
      const result = simulateDiceRollWithRerolls(
        pool,
        facesByColor,
        repeatRollConfig,
        null,
        rng
      );
      
      // Should roll once: initial only (no reroll because above expected)
      expect(rollCount).toBe(1);
      expect(result.aggregate.hits).toBeGreaterThanOrEqual(0);
      expect(result.stats.fullRerollsOccurred).toBe(0);
    });

    it('performs selective rerolls on worst dice', () => {
      const pool: Pool = { RED: 2 };
      
      // Create deterministic sequence: both dice roll poorly, then one rerolls better
      const rng = makeLinearRng(0, 0.4);
      
      const repeatDiceConfig: RepeatDiceConfig = {
        enabled: true,
        maxDiceToReroll: 1,
        priorityMode: 'hits',
        countHollowAsFilled: false
      };
      
      const result = simulateDiceRollWithRerolls(
        pool,
        facesByColor,
        null,
        repeatDiceConfig,
        rng
      );
      
      expect(result.aggregate.hits).toBeGreaterThanOrEqual(0);
      expect(result.stats.diceRerolledCount).toBeGreaterThan(0);
    });

    it('applies both rerolls sequentially', () => {
      const pool: Pool = { RED: 1 };
      let rollCount = 0;
      
      const rng = () => {
        rollCount++;
        // Roll 1: Bad (face 5 = no hits, triggers full reroll)
        // Roll 2: Full reroll (face 3 = hollow hit, still below expected, triggers selective reroll)
        // Roll 3: Selective reroll (face 0 = 2 hits, good)
        const faceIndices = [5, 3, 0];
        const faceIndex = faceIndices[rollCount - 1] || 0;
        return (faceIndex + 0.1) / 8;
      };
      
      const repeatRollConfig: RepeatRollConfig = {
        enabled: true,
        condition: { type: 'BelowExpected', symbol: 'hits' }
      };
      
      const repeatDiceConfig: RepeatDiceConfig = {
        enabled: true,
        maxDiceToReroll: 1,
        priorityMode: 'hits',
        countHollowAsFilled: false
      };
      
      const result = simulateDiceRollWithRerolls(
        pool,
        facesByColor,
        repeatRollConfig,
        repeatDiceConfig,
        rng
      );
      
      // Should perform both types of rerolls:
      // Roll 1: Initial (face 5 = special, below expected for hits)
      // Roll 2: Full reroll (face 3 = hollow hit, still below expected)
      // Roll 3: Selective reroll (face 0 = 2 hits)
      expect(rollCount).toBe(3);
      expect(result.stats.fullRerollsOccurred).toBe(1);
      expect(result.stats.diceRerolledCount).toBe(1);
    });

    it('rerolling increases average hits (Monte Carlo)', () => {
      const pool: Pool = { RED: 3, YELLOW: 2 };
      const iterations = 1000;
      
      // Without rerolls
      let totalHitsWithoutReroll = 0;
      for (let i = 0; i < iterations; i++) {
        const result = simulateDiceRollWithRerolls(
          pool,
          facesByColor,
          null,
          null,
          Math.random
        );
        totalHitsWithoutReroll += result.aggregate.hits;
      }
      const avgWithoutReroll = totalHitsWithoutReroll / iterations;
      
      // With selective dice reroll
      let totalHitsWithReroll = 0;
      const repeatDiceConfig: RepeatDiceConfig = {
        enabled: true,
        maxDiceToReroll: 2,
        priorityMode: 'hits',
        countHollowAsFilled: false
      };
      
      for (let i = 0; i < iterations; i++) {
        const result = simulateDiceRollWithRerolls(
          pool,
          facesByColor,
          null,
          repeatDiceConfig,
          Math.random
        );
        totalHitsWithReroll += result.aggregate.hits;
      }
      const avgWithReroll = totalHitsWithReroll / iterations;
      
      console.log(`Without reroll: ${avgWithoutReroll.toFixed(3)} avg hits`);
      console.log(`With reroll: ${avgWithReroll.toFixed(3)} avg hits`);
      console.log(`Improvement: ${((avgWithReroll - avgWithoutReroll) / avgWithoutReroll * 100).toFixed(1)}%`);
      
      // Rerolling should improve average (with high confidence)
      expect(avgWithReroll).toBeGreaterThan(avgWithoutReroll);
      
      // The improvement should be meaningful (at least 5%)
      const improvement = (avgWithReroll - avgWithoutReroll) / avgWithoutReroll;
      expect(improvement).toBeGreaterThan(0.05);
    });

    it('rerolling with full reroll also increases average hits', () => {
      const pool: Pool = { RED: 2, YELLOW: 1 };
      const iterations = 1000;
      
      // Without rerolls
      let totalHitsWithoutReroll = 0;
      for (let i = 0; i < iterations; i++) {
        const result = simulateDiceRollWithRerolls(
          pool,
          facesByColor,
          null,
          null,
          Math.random
        );
        totalHitsWithoutReroll += result.aggregate.hits;
      }
      const avgWithoutReroll = totalHitsWithoutReroll / iterations;
      
      // With full reroll (below expected)
      let totalHitsWithReroll = 0;
      const repeatRollConfig: RepeatRollConfig = {
        enabled: true,
        condition: { type: 'BelowExpected', symbol: 'hits' }
      };
      
      for (let i = 0; i < iterations; i++) {
        const result = simulateDiceRollWithRerolls(
          pool,
          facesByColor,
          repeatRollConfig,
          null,
          Math.random
        );
        totalHitsWithReroll += result.aggregate.hits;
      }
      const avgWithReroll = totalHitsWithReroll / iterations;
      
      console.log(`Without full reroll: ${avgWithoutReroll.toFixed(3)} avg hits`);
      console.log(`With full reroll: ${avgWithReroll.toFixed(3)} avg hits`);
      console.log(`Improvement: ${((avgWithReroll - avgWithoutReroll) / avgWithoutReroll * 100).toFixed(1)}%`);
      
      // Rerolling below-expected results should improve average
      expect(avgWithReroll).toBeGreaterThan(avgWithoutReroll);
    });
  });
});

