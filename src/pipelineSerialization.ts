import { Pipeline, type PipelineStep, ElitePromotionStep, AddSymbolsStep, SwitchSymbolsStep, CombatSwitchStep, type SerializedPipelineStep } from './pipeline';
import type { Aggregate } from './domain/dice';

export function serializePipeline(pipeline: Pipeline): SerializedPipelineStep[] {
  return (pipeline.steps || []).map((s) => ({
    // common
    type: (s as any).type,
    id: (s as any).id,
    enabled: !!(s as any).enabled,
    // AddSymbols
    delta: (s as any).delta,
    // ElitePromotion
    symbols: (s as any).symbols,
    max: (s as any).max,
    // SwitchSymbols
    from: (s as any).from,
    fromParts: (s as any).fromParts,
    to: (s as any).to,
    ratio: (s as any).ratio,
    // CombatSwitch
    costSymbol: (s as any).costSymbol,
    costCount: (s as any).costCount,
    costParts: (s as any).costParts,
    selfDelta: (s as any).selfDelta,
    oppDelta: (s as any).oppDelta
  })) as SerializedPipelineStep[];
}

export function deserializeSteps(arr: SerializedPipelineStep[]): PipelineStep[] {
  const steps = arr.map((s) => {
    if (s.type === 'ElitePromotion') return Object.assign(new ElitePromotionStep(s.id, s.enabled, s.symbols, s.max), {});
    if (s.type === 'AddSymbols') return Object.assign(new AddSymbolsStep(s.id, s.enabled, s.delta || {}), {});
    if (s.type === 'SwitchSymbols') {
      const inst = new SwitchSymbolsStep(s.id, s.enabled, s.from, s.to, s.ratio, s.max);
      if (Array.isArray(s.fromParts) && s.fromParts.length) inst.fromParts = s.fromParts.slice(0,2).map((p) => ({ symbol: p.symbol, units: Math.max(1, (p.units|0)) }));
      return Object.assign(inst, {});
    }
    if (s.type === 'CombatSwitch') {
      const cfg = {
        costSymbol: ((s.costSymbol as keyof Aggregate) || 'specials') as keyof Aggregate,
        costCount: s.costCount || 1,
        selfDelta: s.selfDelta || {},
        oppDelta: s.oppDelta || {},
        max: s.max as number | null | undefined,
        costParts: Array.isArray(s.costParts) && s.costParts.length ? s.costParts.slice(0,2).map((p) => ({ symbol: p.symbol, units: Math.max(1, (p.units|0)) })) : undefined
      };
      return Object.assign(new CombatSwitchStep(s.id, s.enabled, cfg), {});
    }
    return null as any;
  }).filter(Boolean) as PipelineStep[];
  return steps;
}

export function buildPipelineFromSerialized(arr: SerializedPipelineStep[]): Pipeline {
  return new Pipeline(deserializeSteps(arr));
}


