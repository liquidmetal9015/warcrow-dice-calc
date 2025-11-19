import type { FacesByColor, Pool, RNG, MonteCarloResults, CombatResults, Aggregate } from '../dice';
import { performMonteCarloSimulationWithPipeline, performCombatSimulationWithPipeline } from '../dice';
import type { Pipeline } from '../pipeline';
import { serializePipeline } from '../pipelineSerialization';
import type { RepeatRollConfig, RepeatDiceConfig } from '../types/reroll';

type WorkerRequest = { resolve: (v: any) => void; reject: (e: any) => void };

export class SimulationController {
  private worker: Worker | null;
  private pending: Map<string, WorkerRequest>;

  constructor() {
    this.worker = null;
    this.pending = new Map();
    this.initWorker();
  }

  private initWorker(): void {
    try {
      this.worker = new Worker(new URL('../workers/simulation.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent) => {
        const data = (e as any).data;
        const req = this.pending.get(String(data?.requestId));
        if (!req) return;
        this.pending.delete(String(data.requestId));
        if (data && data.ok) req.resolve(data.data);
        else req.reject(new Error(String(data?.error || 'Worker error')));
      };
      this.worker.onerror = (err: Event) => { console.error('Simulation worker error', err); };
    } catch (e) {
      console.warn('Failed to initialize simulation worker; using main-thread simulation.', e);
      this.worker = null;
    }
  }

  private callWorker(message: any): Promise<any> {
    if (!this.worker) return Promise.reject(new Error('Worker not initialized'));
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = Object.assign({}, message, { requestId });
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      (this.worker as Worker).postMessage(payload);
    });
  }

  async runAnalysisWithPipeline(
    pool: Pool,
    facesByColor: FacesByColor,
    simulationCount: number,
    pipeline: Pipeline,
    repeatRollConfig?: RepeatRollConfig | null,
    repeatDiceConfig?: RepeatDiceConfig | null,
    disarmed: boolean = false,
    vulnerable: boolean = false,
    rng: RNG = Math.random
  ): Promise<MonteCarloResults> {
    if (this.worker) {
      const pipelineSerialized = serializePipeline(pipeline);
      return await this.callWorker({ 
        type: 'analysis', 
        pool, 
        facesByColor, 
        simulationCount, 
        pipeline: pipelineSerialized,
        repeatRollConfig: repeatRollConfig || null,
        repeatDiceConfig: repeatDiceConfig || null,
        disarmed,
        vulnerable
      });
    }
    return await performMonteCarloSimulationWithPipeline(
      pool,
      facesByColor,
      simulationCount,
      pipeline,
      rng,
      repeatRollConfig,
      repeatDiceConfig,
      disarmed,
      vulnerable
    );
  }

  async runCombatWithPipeline(
    attackerPool: Pool,
    defenderPool: Pool,
    facesByColor: FacesByColor,
    simulationCount: number,
    attackerPipeline: Pipeline,
    defenderPipeline: Pipeline,
    attackerRepeatRollConfig?: RepeatRollConfig | null,
    attackerRepeatDiceConfig?: RepeatDiceConfig | null,
    defenderRepeatRollConfig?: RepeatRollConfig | null,
    defenderRepeatDiceConfig?: RepeatDiceConfig | null,
    attackerDisarmed: boolean = false,
    defenderVulnerable: boolean = false,
    rng: RNG = Math.random
  ): Promise<CombatResults> {
    if (this.worker) {
      const attackerSer = serializePipeline(attackerPipeline);
      const defenderSer = serializePipeline(defenderPipeline);
      return await this.callWorker({ 
        type: 'combat', 
        attackerPool, 
        defenderPool, 
        facesByColor, 
        simulationCount, 
        attackerPipeline: attackerSer, 
        defenderPipeline: defenderSer,
        attackerRepeatRollConfig: attackerRepeatRollConfig || null,
        attackerRepeatDiceConfig: attackerRepeatDiceConfig || null,
        defenderRepeatRollConfig: defenderRepeatRollConfig || null,
        defenderRepeatDiceConfig: defenderRepeatDiceConfig || null,
        attackerDisarmed,
        defenderVulnerable
      });
    }
    return await performCombatSimulationWithPipeline(
      attackerPool, 
      defenderPool, 
      facesByColor, 
      simulationCount, 
      attackerPipeline, 
      defenderPipeline, 
      attackerRepeatRollConfig || null,
      attackerRepeatDiceConfig || null,
      defenderRepeatRollConfig || null,
      defenderRepeatDiceConfig || null,
      rng,
      attackerDisarmed,
      defenderVulnerable
    );
  }
}


