import { describe, it, expect } from 'vitest';
import { performCombatSimulationWithPipeline, type FacesByColor, DS } from '../src/dice';
import { Pipeline, AddSymbolsStep, CombatSwitchStep } from '../src/pipeline';
import { makeLinearRng } from './utils';

const facesByColorStub: FacesByColor = {
  RED: [ [DS.HIT], [DS.HIT], [DS.SPECIAL], [DS.HOLLOW_HIT], [DS.HIT], [DS.BLOCK], [DS.SPECIAL], [DS.HOLLOW_HIT] ],
  ORANGE: [ [DS.HIT], [DS.SPECIAL], [DS.HIT], [DS.SPECIAL], [DS.HOLLOW_HIT], [DS.HIT], [DS.BLOCK], [DS.SPECIAL] ],
  YELLOW: [ [DS.SPECIAL], [DS.SPECIAL], [DS.HOLLOW_HIT], [DS.SPECIAL], [DS.SPECIAL], [DS.SPECIAL], [DS.SPECIAL], [DS.SPECIAL] ],
  GREEN: [ [DS.BLOCK], [DS.BLOCK], [DS.HOLLOW_BLOCK], [DS.SPECIAL], [DS.BLOCK], [DS.BLOCK], [DS.HOLLOW_BLOCK], [DS.SPECIAL] ],
  BLUE: [ [DS.BLOCK], [DS.SPECIAL], [DS.BLOCK], [DS.SPECIAL], [DS.BLOCK], [DS.SPECIAL], [DS.HOLLOW_BLOCK], [DS.BLOCK] ],
  BLACK: [ [DS.SPECIAL], [DS.SPECIAL], [DS.HOLLOW_SPECIAL], [DS.SPECIAL], [DS.SPECIAL], [DS.SPECIAL], [DS.HOLLOW_SPECIAL], [DS.SPECIAL] ],
};

describe('combat simulation consistency', () => {
  it('attacker pipeline buffs increase expected hits vs no buffs', async () => {
    const rng = makeLinearRng(0.07, 0.233);
    const base = await performCombatSimulationWithPipeline(
      { Red: 2 }, { Blue: 2 }, facesByColorStub, 1200,
      new Pipeline([]), new Pipeline([]), rng
    );
    const buffed = await performCombatSimulationWithPipeline(
      { Red: 2 }, { Blue: 2 }, facesByColorStub, 1200,
      new Pipeline([ new AddSymbolsStep('a', true, { hits: 1 }), new CombatSwitchStep('c', true, { costSymbol: 'specials', costCount: 1, selfDelta: { hits: 1 }, max: 1 }) ]),
      new Pipeline([]), rng
    );
    expect(buffed.expected.attackerHits).toBeGreaterThanOrEqual(base.expected.attackerHits);
    // probabilities should be well-formed
    const sumA = Object.values(buffed.woundsAttacker).reduce((a,b)=>a+b,0);
    expect(Math.abs(sumA - 100)).toBeLessThanOrEqual(0.6);
  });
});


