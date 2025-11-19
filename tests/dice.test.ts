import { describe, it, expect } from 'vitest';
import { DS, countSymbolsFromFace, simulateDiceRoll, type FacesByColor } from '../src/domain/dice';

const fixedRng = () => 0.0; // always pick index 0

describe('countSymbolsFromFace', () => {
  it('counts filled and hollow correctly', () => {
    const agg = countSymbolsFromFace([DS.HIT, DS.SPECIAL, DS.HOLLOW_BLOCK]);
    expect(agg.hits).toBe(1);
    expect(agg.specials).toBe(1);
    expect(agg.hollowBlocks).toBe(1);
    expect(agg.blocks).toBe(0);
  });
});

describe('simulateDiceRoll', () => {
  const faces: FacesByColor = {
    RED: [[DS.HIT], [DS.HIT], [DS.HIT], [DS.HIT], [DS.HIT, DS.HIT], [DS.HIT, DS.HIT], [DS.SPECIAL, DS.HOLLOW_HIT], [DS.SPECIAL, DS.HIT]],
  };
  it('produces deterministic aggregate with injected RNG', () => {
    const pool = { Red: 3 };
    const agg = simulateDiceRoll(pool, faces, fixedRng);
    // fixedRng picks index 0 => face [HIT]
    expect(agg.hits).toBe(3);
    expect(agg.specials).toBe(0);
  });
});
