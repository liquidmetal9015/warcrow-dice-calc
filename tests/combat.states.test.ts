import { describe, it, expect } from 'vitest';
import {
  DS,
  type FacesByColor,
  type Pool,
  simulateDiceRollWithRerollsAndStates
} from '../src/dice';

const faces: FacesByColor = {
  RED: [
    [DS.HIT, DS.HIT],                // index 0: 2 hits
    [DS.HIT],                        // index 1: 1 hit
    [DS.BLOCK],                      // index 2: 1 block
    [DS.BLOCK, DS.BLOCK],            // index 3: 2 blocks
    [DS.SPECIAL],                    // index 4: special
    [DS.HOLLOW_HIT],                 // index 5: hollow hit
    [DS.HOLLOW_BLOCK],               // index 6: hollow block
    [DS.HOLLOW_SPECIAL]              // index 7: hollow special
  ] as any
};

const fixedRng = () => 0.0; // always picks face index 0

describe('combat states - Disarmed & Vulnerable', () => {
  it('Disarmed cancels the best hit die for attacker', () => {
    const pool: Pool = { Red: 1 } as any;
    const res = simulateDiceRollWithRerollsAndStates(
      pool,
      faces,
      null,
      null,
      { disarmed: true, vulnerable: false },
      fixedRng
    );

    // Face index 0 has 2 hits; Disarmed should cancel that die entirely
    expect(res.aggregate.hits).toBe(0);
    expect(res.aggregate.blocks).toBe(0);
    expect(res.aggregate.specials).toBe(0);
  });

  it('Vulnerable cancels the best block die for defender', () => {
    const pool: Pool = { Red: 1 } as any;
    const res = simulateDiceRollWithRerollsAndStates(
      pool,
      faces,
      null,
      null,
      { disarmed: false, vulnerable: true },
      fixedRng
    );

    // Face index 0 has only hits, no blocks; Vulnerable should have nothing to cancel
    expect(res.aggregate.hits).toBe(2);
    expect(res.aggregate.blocks).toBe(0);
  });
});

