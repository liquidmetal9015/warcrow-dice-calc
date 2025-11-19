import { describe, it, expect } from 'vitest';
import { type FacesByColor, DS, type Aggregate, simulateDiceRoll } from '../src/domain/dice';
import { runCombat } from '../src/services/simulation';
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

function adapt(pipeline: Pipeline) {
  return (agg: Aggregate) => {
    const state = { dice: [], rollDetails: [], aggregate: { ...agg } };
    pipeline.applyPost(state);
    return state.aggregate;
  };
}

function adaptCombat(pipeline: Pipeline) {
  return {
    transformAggregate: adapt(pipeline),
    applyCombat: (self: Aggregate, opp: Aggregate, role: 'attacker' | 'defender') => {
        if (pipeline && typeof pipeline.applyCombat === 'function') {
            pipeline.applyCombat(self, opp, role);
        }
    }
  };
}

describe('combat simulation consistency', () => {
  it('attacker pipeline buffs increase expected hits vs no buffs', async () => {
    const rng = makeLinearRng(0.07, 0.233);
    const base = await runCombat({
      attackerPool: { Red: 2 },
      defenderPool: { Blue: 2 },
      facesByColor: facesByColorStub,
      simulationCount: 1200,
      rng,
      roll: simulateDiceRoll,
      transforms: {
        attacker: adaptCombat(new Pipeline([])),
        defender: adaptCombat(new Pipeline([]))
      }
    });

    const buffed = await runCombat({
      attackerPool: { Red: 2 },
      defenderPool: { Blue: 2 },
      facesByColor: facesByColorStub,
      simulationCount: 1200,
      rng,
      roll: simulateDiceRoll,
      transforms: {
        attacker: adaptCombat(new Pipeline([ new AddSymbolsStep('a', true, { hits: 1 }), new CombatSwitchStep('c', true, { costSymbol: 'specials', costCount: 1, selfDelta: { hits: 1 }, max: 1 }) ])),
        defender: adaptCombat(new Pipeline([]))
      }
    });

    expect(buffed.expected.attackerHits).toBeGreaterThanOrEqual(base.expected.attackerHits);
    // probabilities should be well-formed
    const sumA = Object.values(buffed.woundsAttacker).reduce((a,b)=>a+b,0);
    expect(Math.abs(sumA - 100)).toBeLessThanOrEqual(0.6);
  });
});
