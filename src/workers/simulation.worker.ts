/// <reference lib="webworker" />
import { runAnalysis, runCombat } from '../services/simulation';
import { simulateDiceRoll, type FacesByColor, type Pool, type RNG, type Aggregate } from '../dice';
import type { SerializedPipelineStep } from '../pipeline';
import { buildPipelineFromSerialized } from '../pipelineSerialization';
import type { RepeatRollConfig, RepeatDiceConfig } from '../types/reroll';

type AnalysisMsg = { 
  type: 'analysis'; 
  pool: Pool; 
  facesByColor: FacesByColor; 
  simulationCount: number; 
  pipeline?: SerializedPipelineStep[];
  repeatRollConfig?: RepeatRollConfig | null;
  repeatDiceConfig?: RepeatDiceConfig | null;
  disarmed?: boolean;
  vulnerable?: boolean;
};
type CombatMsg = { 
  type: 'combat'; 
  attackerPool: Pool; 
  defenderPool: Pool; 
  facesByColor: FacesByColor; 
  simulationCount: number; 
  attackerPipeline?: SerializedPipelineStep[]; 
  defenderPipeline?: SerializedPipelineStep[];
  attackerRepeatRollConfig?: RepeatRollConfig | null;
  attackerRepeatDiceConfig?: RepeatDiceConfig | null;
  defenderRepeatRollConfig?: RepeatRollConfig | null;
  defenderRepeatDiceConfig?: RepeatDiceConfig | null;
  attackerDisarmed?: boolean;
  defenderVulnerable?: boolean;
};
type InMsg = AnalysisMsg | CombatMsg;

const rngFromSeed = (seed: number): RNG => {
  let s = seed >>> 0;
  return () => {
    // xorshift32
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    const out = (s >>> 0) / 0xffffffff;
    return Math.min(0.999999, Math.max(0, out));
  };
};

self.onmessage = async (e: MessageEvent<InMsg & { requestId: string; seed?: number }>) => {
  const msg = e.data;
  const requestId = (msg as any).requestId;
  const seed = (msg as any).seed ?? Math.floor(Math.random() * 1e9);
  const rng = rngFromSeed(seed);
  try {
    if (msg.type === 'analysis') {
      const pipeline = Array.isArray(msg.pipeline) && msg.pipeline.length ? buildPipelineFromSerialized(msg.pipeline) : null;
      const res = await runAnalysis({
        pool: msg.pool,
        facesByColor: msg.facesByColor,
        simulationCount: msg.simulationCount,
        rng,
        roll: simulateDiceRoll,
        transformAggregate: pipeline ? (pre) => {
          const state = { dice: [], rollDetails: [], aggregate: { ...pre } } as any;
          pipeline.applyPost(state);
          return state.aggregate as Aggregate;
        } : undefined,
        repeatRollConfig: msg.repeatRollConfig || null,
        repeatDiceConfig: msg.repeatDiceConfig || null,
        disarmed: !!msg.disarmed,
        vulnerable: !!msg.vulnerable
      });
      (self as any).postMessage({ requestId, ok: true, data: res });
      return;
    }
    if (msg.type === 'combat') {
      const attackerPipeline = Array.isArray(msg.attackerPipeline) && msg.attackerPipeline.length ? buildPipelineFromSerialized(msg.attackerPipeline) : null;
      const defenderPipeline = Array.isArray(msg.defenderPipeline) && msg.defenderPipeline.length ? buildPipelineFromSerialized(msg.defenderPipeline) : null;
      const res = await runCombat({
        attackerPool: msg.attackerPool,
        defenderPool: msg.defenderPool,
        facesByColor: msg.facesByColor,
        simulationCount: msg.simulationCount,
        rng,
        roll: simulateDiceRoll,
        transforms: {
          attacker: attackerPipeline ? {
            transformAggregate: (pre) => {
              const state = { dice: [], rollDetails: [], aggregate: { ...pre } } as any;
              attackerPipeline.applyPost(state);
              return state.aggregate as Aggregate;
            },
            applyCombat: (self, opp) => attackerPipeline.applyCombat(self, opp, 'attacker')
          } : undefined,
          defender: defenderPipeline ? {
            transformAggregate: (pre) => {
              const state = { dice: [], rollDetails: [], aggregate: { ...pre } } as any;
              defenderPipeline.applyPost(state);
              return state.aggregate as Aggregate;
            },
            applyCombat: (self, opp) => defenderPipeline.applyCombat(self, opp, 'defender')
          } : undefined
        },
        attackerRepeatRollConfig: msg.attackerRepeatRollConfig || null,
        attackerRepeatDiceConfig: msg.attackerRepeatDiceConfig || null,
        defenderRepeatRollConfig: msg.defenderRepeatRollConfig || null,
        defenderRepeatDiceConfig: msg.defenderRepeatDiceConfig || null,
        attackerDisarmed: !!msg.attackerDisarmed,
        defenderVulnerable: !!msg.defenderVulnerable
      });
      (self as any).postMessage({ requestId, ok: true, data: res });
      return;
    }
  } catch (err) {
    (self as any).postMessage({ requestId, ok: false, error: String(err) });
  }
};


