import { describe, it, expect } from 'vitest';
import { DS, type FacesByColor, simulateDiceRoll } from '../src/domain/dice';
import { runAnalysis, runCombat } from '../src/services/simulation';

const rngFixed = () => 0.0; // always pick face index 0

const faces: FacesByColor = {
  RED: [[DS.HIT],[DS.HIT],[DS.HIT],[DS.HIT],[DS.HIT,DS.HIT],[DS.HIT,DS.HIT],[DS.SPECIAL,DS.HOLLOW_HIT],[DS.SPECIAL,DS.HIT]],
  BLUE: [[DS.SPECIAL],[DS.SPECIAL],[DS.HOLLOW_SPECIAL],[DS.BLOCK],[DS.BLOCK],[DS.SPECIAL,DS.BLOCK],[DS.SPECIAL,DS.HOLLOW_BLOCK],[DS.BLOCK,DS.HOLLOW_SPECIAL]]
};

describe('performMonteCarloSimulation', () => {
  it('produces expected means with fixed RNG', async () => {
    const pool = { Red: 2 };
    const res = await runAnalysis({
      pool,
      facesByColor: faces,
      simulationCount: 100,
      rng: rngFixed,
      roll: simulateDiceRoll
    });
    // rngFixed selects face 0 => [HIT]
    expect(res.expected.hits).toBeCloseTo(2, 3);
    expect(res.expected.blocks).toBeCloseTo(0, 3);
    expect(res.expected.specials).toBeCloseTo(0, 3);
  });
});

describe('performCombatSimulation', () => {
  it('computes wounds and win rates deterministically with fixed RNG', async () => {
    const attacker = { Red: 2 };
    const defender = { Blue: 2 };
    const res = await runCombat({
      attackerPool: attacker,
      defenderPool: defender,
      facesByColor: faces,
      simulationCount: 50,
      rng: rngFixed,
      roll: simulateDiceRoll
    });
    // Attacker rolls [HIT] twice => 2 hits; Defender rolls [SPECIAL] twice => 0 blocks
    // Wounds attacker->defender always 2
    expect(res.woundsAttacker[2]).toBe(100);
    expect(res.attackerWinRate).toBe(100);
  });
});
