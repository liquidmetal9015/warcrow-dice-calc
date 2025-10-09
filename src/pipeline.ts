import type { Aggregate } from './dice';

export function blankCounts(): Aggregate {
  return { hits: 0, blocks: 0, specials: 0, hollowHits: 0, hollowBlocks: 0, hollowSpecials: 0 };
}

export interface PipelineStep {
  id: string;
  enabled: boolean;
  type: string;
  applyPre?(state: { dice: unknown[]; rollDetails: unknown[]; aggregate: Aggregate }, ctx?: unknown): void;
  applyPost?(state: { dice: unknown[]; rollDetails: unknown[]; aggregate: Aggregate }): void;
  applyCombat?(selfAggregate: Aggregate, opponentAggregate: Aggregate, role: 'attacker' | 'defender'): void;
}

export class Pipeline {
  steps: PipelineStep[];
  constructor(steps: PipelineStep[] = []) { this.steps = steps; }
  applyPre(state: { dice: unknown[]; rollDetails: unknown[]; aggregate: Aggregate }, ctx?: unknown) {
    for (const s of this.steps) if (s.enabled && typeof s.applyPre === 'function') s.applyPre(state, ctx);
  }
  applyPost(state: { dice: unknown[]; rollDetails: unknown[]; aggregate: Aggregate }) {
    for (const s of this.steps) if (s.enabled && typeof s.applyPost === 'function') s.applyPost(state);
  }
  applyCombat(selfAggregate: Aggregate, opponentAggregate: Aggregate, role: 'attacker' | 'defender') {
    for (const s of this.steps) if (s.enabled && typeof s.applyCombat === 'function') s.applyCombat(selfAggregate, opponentAggregate, role);
    const keys: (keyof Aggregate)[] = ['hits','blocks','specials','hollowHits','hollowBlocks','hollowSpecials'];
    for (const k of keys) {
      selfAggregate[k] = Math.max(0, selfAggregate[k] | 0);
      opponentAggregate[k] = Math.max(0, opponentAggregate[k] | 0);
    }
  }
}

export class ElitePromotionStep implements PipelineStep {
  id: string; enabled: boolean; type = 'ElitePromotion'; symbols: Array<keyof Aggregate>; max: number | null;
  constructor(id: string, enabled = true, symbols: Array<keyof Aggregate> = ['hollowHits','hollowBlocks','hollowSpecials'], max: number | null = null) {
    this.id = id; this.enabled = enabled; this.symbols = symbols; this.max = max;
  }
  applyPost(state: { aggregate: Aggregate }) {
    let remaining = (this.max == null ? Number.POSITIVE_INFINITY : this.max);
    const pairs: Array<[keyof Aggregate, keyof Aggregate]> = [ ['hollowHits','hits'], ['hollowBlocks','blocks'], ['hollowSpecials','specials'] ];
    for (const [hollow, filled] of pairs) {
      if (!this.symbols.includes(hollow)) continue;
      const take = Math.min(state.aggregate[hollow] || 0, remaining);
      if (take <= 0) continue;
      state.aggregate[hollow] -= take;
      state.aggregate[filled] = (state.aggregate[filled] || 0) + take;
      remaining -= take;
      if (remaining <= 0) break;
    }
  }
}

export class AddSymbolsStep implements PipelineStep {
  id: string; enabled: boolean; type = 'AddSymbols'; delta: Partial<Aggregate>;
  constructor(id: string, enabled = true, delta: Partial<Aggregate> = {}) { this.id = id; this.enabled = enabled; this.delta = delta; }
  applyPost(state: { aggregate: Aggregate }) {
    for (const [k, v] of Object.entries(this.delta)) {
      const key = k as keyof Aggregate; const val = (v as number) || 0;
      if (!val) continue;
      state.aggregate[key] = (state.aggregate[key] || 0) + val;
    }
  }
}

export class SwitchSymbolsStep implements PipelineStep {
  id: string; enabled: boolean; type = 'SwitchSymbols'; from: keyof Aggregate | string; to: keyof Aggregate; ratio: { x: number; y: number }; max: number | null; fromParts?: Array<{ symbol: keyof Aggregate; units: number }> | null;
  constructor(id: string, enabled: boolean, from: keyof Aggregate | string, to: keyof Aggregate, ratio: { x: number; y: number } = { x: 1, y: 1 }, max: number | null = null) {
    this.id = id; this.enabled = enabled; this.from = from; this.to = to; this.ratio = ratio; this.max = max; this.fromParts = this.fromParts;
  }
  applyPost(state: { aggregate: Aggregate }) {
    const ratioX = Math.max(1, (this.ratio && this.ratio.x) || 1);
    const ratioY = Math.max(0, (this.ratio && this.ratio.y) || 0);
    const hasParts = Array.isArray(this.fromParts) && this.fromParts.length > 0;
    if (hasParts) {
      const parts = this.fromParts!.slice(0, 2).map(p => ({ symbol: p.symbol, units: Math.max(1, p.units | 0) }));
      const groupsAvail = parts.map(p => Math.floor(Math.max(0, state.aggregate[p.symbol] | 0) / (p.units * ratioX)));
      let groups = groupsAvail.length ? Math.min(...groupsAvail) : 0;
      const maxGroups = (this.max == null ? groups : Math.min(groups, Math.max(0, this.max | 0)));
      groups = Math.max(0, maxGroups | 0);
      if (groups <= 0) return;
      for (const p of parts) state.aggregate[p.symbol] = Math.max(0, (state.aggregate[p.symbol] | 0) - groups * p.units * ratioX);
      state.aggregate[this.to] = (state.aggregate[this.to] || 0) + groups * ratioY;
      return;
    }
    const available = Math.floor((state.aggregate[this.from as keyof Aggregate] || 0) / ratioX);
    const groups = Math.min(available, this.max == null ? available : this.max);
    if (groups <= 0) return;
    state.aggregate[this.from as keyof Aggregate] = (state.aggregate[this.from as keyof Aggregate] || 0) - groups * ratioX;
    state.aggregate[this.to] = (state.aggregate[this.to] || 0) + groups * ratioY;
  }
}

export class CombatSwitchStep implements PipelineStep {
  id: string; enabled: boolean; type = 'CombatSwitch';
  costSymbol: keyof Aggregate; costCount: number; selfDelta: Partial<Aggregate>; oppDelta: Partial<Aggregate>; max: number | null; costParts: Array<{ symbol: keyof Aggregate; units: number }> | null;
  constructor(id: string, enabled = true, config: { costSymbol?: keyof Aggregate; costCount?: number; selfDelta?: Partial<Aggregate>; oppDelta?: Partial<Aggregate>; max?: number | null; costParts?: Array<{ symbol: keyof Aggregate; units: number }> } = {}) {
    this.id = id; this.enabled = enabled;
    this.costSymbol = (['hits','blocks','specials','hollowHits','hollowBlocks','hollowSpecials'] as Array<keyof Aggregate>).includes((config.costSymbol as keyof Aggregate)) ? (config.costSymbol as keyof Aggregate) : 'specials';
    this.costCount = Math.max(1, (config.costCount as number | undefined | 0) || 1);
    this.selfDelta = Object.assign({ hits: 0, blocks: 0, specials: 0 }, config.selfDelta || {});
    this.oppDelta = Object.assign({ hits: 0, blocks: 0, specials: 0 }, config.oppDelta || {});
    this.max = (config.max == null ? null : Math.max(0, (config.max as number) | 0));
    this.costParts = Array.isArray(config.costParts) ? config.costParts
      .filter(p => p && (['hits','blocks','specials','hollowHits','hollowBlocks','hollowSpecials'] as Array<keyof Aggregate>).includes(p.symbol))
      .slice(0, 2)
      .map(p => ({ symbol: p.symbol, units: Math.max(1, p.units | 0) })) : null;
  }
  applyCombat(selfAgg: Aggregate, oppAgg: Aggregate) {
    const parts = Array.isArray(this.costParts) && this.costParts.length ? this.costParts : [{ symbol: this.costSymbol, units: 1 }];
    const perActUnits = parts.map(p => ({ symbol: p.symbol, units: Math.max(1, p.units) * Math.max(1, this.costCount) }));
    let groups = Math.min(...perActUnits.map(req => Math.floor(Math.max(0, selfAgg[req.symbol] | 0) / req.units)));
    if (this.max != null) groups = Math.min(groups, this.max);
    if (groups <= 0) return;
    for (const req of perActUnits) selfAgg[req.symbol] = Math.max(0, (selfAgg[req.symbol] | 0) - groups * req.units);
    for (const k of Object.keys(this.selfDelta) as Array<keyof Aggregate>) {
      const v = Math.max(0, (this.selfDelta[k] as number) | 0); if (!v) continue; selfAgg[k] = (selfAgg[k] | 0) + v * groups;
    }
    for (const k of Object.keys(this.oppDelta) as Array<keyof Aggregate>) {
      const v = Math.max(0, (this.oppDelta[k] as number) | 0); if (!v) continue; oppAgg[k] = Math.max(0, (oppAgg[k] | 0) - v * groups);
    }
  }
}


