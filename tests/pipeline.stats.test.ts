import { describe, it, expect } from 'vitest';
import {
  DS,
  simulateDiceRoll,
  type FacesByColor,
  type Aggregate
} from '../src/domain/dice';
import { runAnalysis } from '../src/services/simulation';
import { Pipeline, AddSymbolsStep, ElitePromotionStep, SwitchSymbolsStep } from '../src/pipeline';

// Stub faces for testing
const facesByColorStub: FacesByColor = {
  RED: [
    [DS.HIT, DS.HIT],
    [DS.HIT],
    [DS.SPECIAL],
    [DS.BLOCK],
    [DS.HIT],
    [DS.HOLLOW_HIT],
    [DS.HOLLOW_BLOCK],
    [DS.HOLLOW_SPECIAL]
  ],
  BLUE: [
    [DS.BLOCK, DS.BLOCK],
    [DS.BLOCK],
    [DS.SPECIAL],
    [DS.HIT],
    [DS.BLOCK],
    [DS.HOLLOW_BLOCK],
    [DS.HOLLOW_HIT],
    [DS.HOLLOW_SPECIAL]
  ]
};

// Helper adapter for pipeline in analysis
function adapt(pipeline: Pipeline) {
  return (agg: Aggregate) => {
    const state = { dice: [], rollDetails: [], aggregate: { ...agg } };
    pipeline.applyPost(state);
    return state.aggregate;
  };
}

describe('Pipeline Statistical Verification (Monte Carlo)', () => {
  const SIMULATION_COUNT = 5000;
  // Use Math.random for actual statistical distribution
  const rng = Math.random;

  it('AddSymbolsStep shifts the mean by exactly the added amount', async () => {
    const pool = { Red: 2 };
    
    // Baseline
    const baseline = await runAnalysis({
      pool,
      facesByColor: facesByColorStub,
      simulationCount: SIMULATION_COUNT,
      rng,
      roll: simulateDiceRoll
    });

    // With AddSymbols(+1 Hit)
    const pipeline = new Pipeline([
      new AddSymbolsStep('add-hit', true, { hits: 1 })
    ]);

    const withAdd = await runAnalysis({
      pool,
      facesByColor: facesByColorStub,
      simulationCount: SIMULATION_COUNT,
      rng,
      roll: simulateDiceRoll,
      transformAggregate: adapt(pipeline)
    });

    // The difference in means should be very close to 1.0
    const diff = withAdd.expected.hits - baseline.expected.hits;
    // Allow small variance due to Monte Carlo noise in the two separate runs
    // (Though theoretically AddSymbols is deterministic post-process, so if we used the same seed it would be exact.
    // With independent runs, we compare means).
    // Actually, since AddSymbols is additive, Mean(X + 1) = Mean(X) + 1.
    // The sample means might differ due to sample noise.
    // Standard error of difference ~ sqrt(Var1/N + Var2/N).
    expect(diff).toBeGreaterThan(0.9);
    expect(diff).toBeLessThan(1.1);
  });

  it('ElitePromotionStep statistically increases filled symbols vs hollow', async () => {
    const pool = { Red: 3 }; // Red has hollow hits
    
    const baseline = await runAnalysis({
      pool,
      facesByColor: facesByColorStub,
      simulationCount: SIMULATION_COUNT,
      rng,
      roll: simulateDiceRoll
    });

    const pipeline = new Pipeline([
      new ElitePromotionStep('promo', true, ['hollowHits'], null) // promote all hollow hits
    ]);

    const withPromo = await runAnalysis({
      pool,
      facesByColor: facesByColorStub,
      simulationCount: SIMULATION_COUNT,
      rng,
      roll: simulateDiceRoll,
      transformAggregate: adapt(pipeline)
    });

    // Expect fewer hollow hits
    expect(withPromo.expected.hollowHits).toBeLessThan(baseline.expected.hollowHits);
    
    // Expect more filled hits
    expect(withPromo.expected.hits).toBeGreaterThan(baseline.expected.hits);

    // Total hits (filled + hollow) should be roughly conserved (ElitePromotion just moves them)
    const totalHitsBaseline = baseline.expected.hits + baseline.expected.hollowHits;
    const totalHitsPromo = withPromo.expected.hits + withPromo.expected.hollowHits;
    
    expect(Math.abs(totalHitsPromo - totalHitsBaseline)).toBeLessThan(0.1);
  });

  it('SwitchSymbolsStep shifts distribution from source to target', async () => {
    const pool = { Red: 3 }; // Red generates hits
    
    const baseline = await runAnalysis({
      pool,
      facesByColor: facesByColorStub,
      simulationCount: SIMULATION_COUNT,
      rng,
      roll: simulateDiceRoll
    });

    // Switch 1 Hit -> 1 Special
    const pipeline = new Pipeline([
      new SwitchSymbolsStep('switch', true, 'hits', 'specials', { x: 1, y: 1 }, null)
    ]);

    const withSwitch = await runAnalysis({
      pool,
      facesByColor: facesByColorStub,
      simulationCount: SIMULATION_COUNT,
      rng,
      roll: simulateDiceRoll,
      transformAggregate: adapt(pipeline)
    });

    // Hits should decrease
    expect(withSwitch.expected.hits).toBeLessThan(baseline.expected.hits);
    
    // Specials should increase
    expect(withSwitch.expected.specials).toBeGreaterThan(baseline.expected.specials);
  });
});

