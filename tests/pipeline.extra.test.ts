import { describe, it, expect } from 'vitest';
import { Pipeline, AddSymbolsStep, ElitePromotionStep, SwitchSymbolsStep, CombatSwitchStep } from '../src/pipeline';
import type { Aggregate } from '../src/dice';

function agg(values: Partial<Aggregate>): Aggregate {
  return Object.assign({ hits: 0, blocks: 0, specials: 0, hollowHits: 0, hollowBlocks: 0, hollowSpecials: 0 }, values);
}

describe('pipeline steps: edge cases', () => {
  it('AddSymbolsStep adds only positive values', () => {
    const step = new AddSymbolsStep('a', true, { hits: 2, blocks: 0, specials: 3 });
    const state = { dice: [], rollDetails: [], aggregate: agg({}) } as any;
    step.applyPost(state);
    expect(state.aggregate.hits).toBe(2);
    expect(state.aggregate.specials).toBe(3);
  });

  it('ElitePromotionStep promotes hollow to filled with max limit', () => {
    const step = new ElitePromotionStep('e', true, ['hollowHits','hollowBlocks','hollowSpecials'], 2);
    const state = { dice: [], rollDetails: [], aggregate: agg({ hollowHits: 5, hits: 1 }) } as any;
    step.applyPost(state);
    expect(state.aggregate.hollowHits).toBe(3);
    expect(state.aggregate.hits).toBe(3);
  });

  it('SwitchSymbolsStep swaps groups with ratio and max', () => {
    const step = new SwitchSymbolsStep('s', true, 'hits', 'specials', { x: 2, y: 1 }, 1);
    const state = { dice: [], rollDetails: [], aggregate: agg({ hits: 5, specials: 0 }) } as any;
    step.applyPost(state);
    expect(state.aggregate.hits).toBe(3);
    expect(state.aggregate.specials).toBe(1);
  });

  it('SwitchSymbolsStep supports fromParts combination', () => {
    const step = new SwitchSymbolsStep('s', true, 'hits', 'specials', { x: 1, y: 2 }, null);
    (step as any).fromParts = [ { symbol: 'hits', units: 1 }, { symbol: 'hollowHits', units: 1 } ];
    const state = { dice: [], rollDetails: [], aggregate: agg({ hits: 2, hollowHits: 3, specials: 0 }) } as any;
    step.applyPost(state);
    // groups = min(2/1, 3/1) = 2, specials += 2*2
    expect(state.aggregate.hits).toBe(0);
    expect(state.aggregate.hollowHits).toBe(1);
    expect(state.aggregate.specials).toBe(4);
  });

  it('CombatSwitchStep applies cost and deltas to self and opp', () => {
    const step = new CombatSwitchStep('c', true, { costSymbol: 'specials', costCount: 1, selfDelta: { hits: 1 }, oppDelta: { blocks: 1 }, max: 2 });
    const self = agg({ specials: 5, hits: 0 });
    const opp = agg({ blocks: 3 });
    step.applyCombat(self, opp);
    // cost: 2*1 specials, self +2 hits, opp -2 blocks
    expect(self.specials).toBe(3);
    expect(self.hits).toBe(2);
    expect(opp.blocks).toBe(1);
  });
});


