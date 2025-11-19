import { describe, it, expect } from 'vitest';
import {
  DS,
  type FacesByColor,
  performMonteCarloSimulationWithPipeline
} from '../src/dice';
import { Pipeline } from '../src/pipeline';
import { makeLinearRng } from './utils';

const facesByColorStub: FacesByColor = {
  RED: [
    [DS.HIT, DS.HIT],                // strong hit face
    [DS.HIT],
    [DS.SPECIAL],
    [DS.BLOCK],
    [DS.HIT],
    [DS.HOLLOW_HIT],
    [DS.HOLLOW_BLOCK],
    [DS.HOLLOW_SPECIAL]
  ],
  BLUE: [
    [DS.BLOCK, DS.BLOCK],           // strong block face
    [DS.BLOCK],
    [DS.SPECIAL],
    [DS.HIT],
    [DS.BLOCK],
    [DS.HOLLOW_BLOCK],
    [DS.HOLLOW_HIT],
    [DS.HOLLOW_SPECIAL]
  ]
};

describe('analysis states - Disarmed & Vulnerable', () => {
  it('Disarmed reduces expected hits in analysis simulation', async () => {
    const rng = makeLinearRng(0.03, 0.211);
    const baseline = await performMonteCarloSimulationWithPipeline(
      { Red: 3 },
      facesByColorStub,
      800,
      new Pipeline([]),
      rng
    );

    const withDisarmed = await performMonteCarloSimulationWithPipeline(
      { Red: 3 },
      facesByColorStub,
      800,
      new Pipeline([]),
      rng,
      null,
      null,
      true,
      false
    );

    expect(withDisarmed.expected.hits).toBeLessThanOrEqual(baseline.expected.hits);
  });

  it('Vulnerable reduces expected blocks in analysis simulation', async () => {
    const rng = makeLinearRng(0.07, 0.193);
    const baseline = await performMonteCarloSimulationWithPipeline(
      { Blue: 3 },
      facesByColorStub,
      800,
      new Pipeline([]),
      rng
    );

    const withVulnerable = await performMonteCarloSimulationWithPipeline(
      { Blue: 3 },
      facesByColorStub,
      800,
      new Pipeline([]),
      rng,
      null,
      null,
      false,
      true
    );

    expect(withVulnerable.expected.blocks).toBeLessThanOrEqual(baseline.expected.blocks);
  });
});

