import { describe, it, expect } from 'vitest';
import { runAnalysis, runCombat } from '../src/services/simulation';
import { simulateDiceRoll } from '../src/dice';
import type { FacesByColor, Pool, RNG, Aggregate } from '../src/dice';

const faces: FacesByColor = {
  RED: [["HIT"],["HIT"],["HIT"],["HIT"],["HIT","HIT"],["HIT","HIT"],["SPECIAL","HOLLOW_HIT"],["SPECIAL","HIT"]] as any,
};

const fixed: RNG = () => 0.0;

function roll(pool: Pool, f: FacesByColor, rng: RNG): Aggregate {
  return simulateDiceRoll(pool, f, rng);
}

describe('SimulationService', () => {
  it('runAnalysis normalizes to ~100%', async () => {
    const res = await runAnalysis({ pool: { Red: 1 }, facesByColor: faces, simulationCount: 500, rng: fixed, roll });
    const sum = Object.values(res.hits).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.01);
  });

  it('runCombat produces deterministic wounds with fixed RNG', async () => {
    const res = await runCombat({ attackerPool: { Red: 2 }, defenderPool: { Red: 0 }, facesByColor: faces, simulationCount: 10, rng: fixed, roll });
    expect(res.woundsAttacker[2]).toBe(100);
  });
});
