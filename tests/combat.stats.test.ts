import { describe, it, expect } from 'vitest';
import {
  DS,
  simulateDiceRoll,
  type FacesByColor
} from '../src/domain/dice';
import { runCombat } from '../src/services/simulation';

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

describe('Combat Statistical Verification (Monte Carlo)', () => {
  const SIMULATION_COUNT = 5000;
  const rng = Math.random;

  it('High attack pool statistically overcomes low defense pool', async () => {
    const results = await runCombat({
      attackerPool: { Red: 3 },
      defenderPool: { Blue: 1 },
      facesByColor: facesByColorStub,
      simulationCount: SIMULATION_COUNT,
      rng,
      roll: simulateDiceRoll
    });

    // Attacker should have a high win rate (> 50%)
    expect(results.attackerWinRate).toBeGreaterThan(50);
    expect(results.expected.woundsAttacker).toBeGreaterThan(results.expected.woundsDefender);
  });

  it('High defense pool statistically defends against low attack pool', async () => {
    const results = await runCombat({
      attackerPool: { Red: 1 },
      defenderPool: { Blue: 3 },
      facesByColor: facesByColorStub,
      simulationCount: SIMULATION_COUNT,
      rng,
      roll: simulateDiceRoll
    });

    // Attacker should have a low win rate (< 50%)
    // Or rather, attacker inflicting wounds should be low.
    // Win rate is defined as woundsA > woundsD.
    // Defender "winning" usually means preventing wounds, but here win rate logic is simple comparison.
    
    expect(results.attackerWinRate).toBeLessThan(50);
    
    // Defender should be dealing more wounds (or taking 0)
    // Actually with 1 Red vs 3 Blue, Red might deal 0 wounds often.
    expect(results.expected.woundsAttacker).toBeLessThan(1.0);
  });

  it('Disarmed attacker deals less damage than baseline', async () => {
    // Baseline
    const baseline = await runCombat({
      attackerPool: { Red: 3 },
      defenderPool: { Blue: 2 },
      facesByColor: facesByColorStub,
      simulationCount: SIMULATION_COUNT,
      rng,
      roll: simulateDiceRoll
    });

    // Disarmed
    const disarmed = await runCombat({
      attackerPool: { Red: 3 },
      defenderPool: { Blue: 2 },
      facesByColor: facesByColorStub,
      simulationCount: SIMULATION_COUNT,
      rng,
      roll: simulateDiceRoll,
      attackerDisarmed: true
    });

    expect(disarmed.expected.woundsAttacker).toBeLessThan(baseline.expected.woundsAttacker);
    expect(disarmed.attackerWinRate).toBeLessThan(baseline.attackerWinRate);
  });

  it('Vulnerable defender takes more damage than baseline', async () => {
    // Baseline
    const baseline = await runCombat({
      attackerPool: { Red: 3 },
      defenderPool: { Blue: 2 },
      facesByColor: facesByColorStub,
      simulationCount: SIMULATION_COUNT,
      rng,
      roll: simulateDiceRoll
    });

    // Vulnerable
    const vulnerable = await runCombat({
      attackerPool: { Red: 3 },
      defenderPool: { Blue: 2 },
      facesByColor: facesByColorStub,
      simulationCount: SIMULATION_COUNT,
      rng,
      roll: simulateDiceRoll,
      defenderVulnerable: true
    });

    expect(vulnerable.expected.woundsAttacker).toBeGreaterThan(baseline.expected.woundsAttacker);
    // Attacker win rate should go up because they deal more wounds
    expect(vulnerable.attackerWinRate).toBeGreaterThan(baseline.attackerWinRate);
  });
});

