import { describe, it, expect } from 'vitest';
import {
  DS,
  simulateDiceRoll,
  blankAggregate,
  normalizeColor,
  computeDieStats,
  type FacesByColor,
  type Aggregate
} from '../src/domain/dice';
import { runAnalysis } from '../src/services/simulation';
import { Pipeline, AddSymbolsStep, ElitePromotionStep, SwitchSymbolsStep } from '../src/pipeline';
import { makeDeterministicRng, makeLinearRng } from './utils';

const facesByColorStub: FacesByColor = {
  RED: [ [DS.HIT], [DS.HIT], [DS.SPECIAL], [DS.HOLLOW_HIT], [DS.HIT], [DS.BLOCK], [DS.SPECIAL], [DS.HOLLOW_HIT] ],
  ORANGE: [ [DS.HIT], [DS.SPECIAL], [DS.HIT], [DS.SPECIAL], [DS.HOLLOW_HIT], [DS.HIT], [DS.BLOCK], [DS.SPECIAL] ],
  YELLOW: [ [DS.SPECIAL], [DS.SPECIAL], [DS.HOLLOW_HIT], [DS.SPECIAL], [DS.SPECIAL], [DS.SPECIAL], [DS.SPECIAL], [DS.SPECIAL] ],
  GREEN: [ [DS.BLOCK], [DS.BLOCK], [DS.HOLLOW_BLOCK], [DS.SPECIAL], [DS.BLOCK], [DS.BLOCK], [DS.HOLLOW_BLOCK], [DS.SPECIAL] ],
  BLUE: [ [DS.BLOCK], [DS.SPECIAL], [DS.BLOCK], [DS.SPECIAL], [DS.BLOCK], [DS.SPECIAL], [DS.HOLLOW_BLOCK], [DS.BLOCK] ],
  BLACK: [ [DS.SPECIAL], [DS.SPECIAL], [DS.HOLLOW_SPECIAL], [DS.SPECIAL], [DS.SPECIAL], [DS.SPECIAL], [DS.HOLLOW_SPECIAL], [DS.SPECIAL] ],
};

function adapt(pipeline: Pipeline) {
  return (agg: Aggregate) => {
    const state = { dice: [], rollDetails: [], aggregate: { ...agg } };
    pipeline.applyPost(state);
    return state.aggregate;
  };
}

describe('dice: simulate and stats', () => {
  it('simulateDiceRoll aggregates symbols deterministically', () => {
    const rng = makeDeterministicRng([0.0, 0.1, 0.2, 0.3]);
    const agg = simulateDiceRoll({ Red: 2, Green: 1 }, facesByColorStub, rng);
    expect(agg.hits + agg.hollowHits + agg.blocks + agg.hollowBlocks + agg.specials + agg.hollowSpecials).toBeGreaterThan(0);
  });

  it('computeDieStats prefers primary symbol by color role', () => {
    const statsRed = computeDieStats(facesByColorStub.RED!, 'RED');
    expect(statsRed.primaryLabel).toBe('Hit');
    const statsBlue = computeDieStats(facesByColorStub.BLUE!, 'BLUE');
    expect(statsBlue.primaryLabel).toBe('Block');
  });
});

describe('monte carlo: normalization & expected/std sanity', () => {
  it('performMonteCarloSimulation produces distributions summing ~100%', async () => {
    const rng = makeLinearRng(0.05, 0.173);
    const res = await runAnalysis({
      pool: { Red: 1, Blue: 1 },
      facesByColor: facesByColorStub,
      simulationCount: 2000,
      rng,
      roll: simulateDiceRoll
    });
    const sum = Object.values(res.hits).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.5);
    // std should be non-negative
    expect(res.std.hits).toBeGreaterThanOrEqual(0);
  });

  it('with pipeline post-processing changes totals predictably', async () => {
    const rng = makeLinearRng(0.11, 0.271);
    const p = new Pipeline([
      new AddSymbolsStep('a1', true, { hits: 1 }),
      new ElitePromotionStep('e1', true, ['hollowHits'], null),
      new SwitchSymbolsStep('s1', true, 'hits', 'specials', { x: 2, y: 1 }, null)
    ]);
    const res = await runAnalysis({
      pool: { Red: 2 },
      facesByColor: facesByColorStub,
      simulationCount: 1500,
      rng,
      roll: simulateDiceRoll,
      transformAggregate: adapt(p)
    });
    // Totals should still sum ~100
    const sumHits = Object.values(res.hits).reduce((a, b) => a + b, 0);
    expect(Math.abs(sumHits - 100)).toBeLessThanOrEqual(0.6);
  });
});
