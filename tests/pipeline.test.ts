import { describe, it, expect } from 'vitest';
import { Pipeline, ElitePromotionStep, AddSymbolsStep, SwitchSymbolsStep, CombatSwitchStep } from '../src/pipeline';

function agg(h = 0, b = 0, s = 0, hh = 0, hb = 0, hs = 0) {
  return { hits: h, blocks: b, specials: s, hollowHits: hh, hollowBlocks: hb, hollowSpecials: hs };
}

describe('Pipeline steps', () => {
  it('ElitePromotion converts hollows to filled up to max', () => {
    const p = new Pipeline([new ElitePromotionStep('e', true, ['hollowHits', 'hollowBlocks', 'hollowSpecials'], 2)]);
    const state = { dice: [], rollDetails: [], aggregate: agg(1, 1, 1, 3, 0, 0) };
    p.applyPost(state);
    expect(state.aggregate.hollowHits).toBe(1);
    expect(state.aggregate.hits).toBe(3);
  });

  it('AddSymbolsStep adds deltas', () => {
    const p = new Pipeline([new AddSymbolsStep('a', true, { hits: 2, specials: 1 })]);
    const state = { dice: [], rollDetails: [], aggregate: agg(1, 0, 0, 0, 0, 0) };
    p.applyPost(state);
    expect(state.aggregate.hits).toBe(3);
    expect(state.aggregate.specials).toBe(1);
  });

  it('SwitchSymbolsStep converts based on ratio and max', () => {
    const p = new Pipeline([new SwitchSymbolsStep('s', true, 'hits', 'specials', { x: 2, y: 1 }, 1)]);
    const state = { dice: [], rollDetails: [], aggregate: agg(5, 0, 0, 0, 0, 0) };
    p.applyPost(state);
    // consume 2 hits -> +1 specials, max=1 group
    expect(state.aggregate.hits).toBe(3);
    expect(state.aggregate.specials).toBe(1);
  });

  it('CombatSwitchStep pays cost and applies deltas', () => {
    const p = new Pipeline([new CombatSwitchStep('c', true, { costSymbol: 'specials', costCount: 2, selfDelta: { hits: 1 }, oppDelta: { blocks: 1 }, max: 2 })]);
    const self = agg(0, 0, 5, 0, 0, 0);
    const opp = agg(0, 3, 0, 0, 0, 0);
    p.applyCombat(self, opp, 'attacker');
    // groups = floor(5 / 2) = 2; hits +2, opp blocks -2
    expect(self.hits).toBe(2);
    expect(self.specials).toBe(1);
    expect(opp.blocks).toBe(1);
  });
});


