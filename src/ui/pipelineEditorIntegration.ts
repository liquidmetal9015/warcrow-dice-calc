/**
 * Pipeline Editor Integration
 * Bridges the existing pipelineEditor UI component with the new tab system
 */
import { renderPipelineEditor } from './pipelineEditor';
import type { Pipeline } from '../pipeline';
import { iconService } from '../services/IconService';
import { storageService } from '../services/StorageService';
import { ElitePromotionStep, AddSymbolsStep, SwitchSymbolsStep, CombatSwitchStep } from '../pipeline';
import type { SerializedPipelineStep } from '../pipeline';
import type { Aggregate } from '../domain/dice';

export type PipelineScope = 'analysis' | 'attacker' | 'defender';

/**
 * Initialize pipeline editor for a specific scope
 */
export function initializePipelineEditor(
  scope: PipelineScope,
  pipeline: Pipeline,
  onChange: (pipeline: Pipeline) => void
): void {
  // Load pipeline from storage if available
  loadPipelineFromStorage(scope, pipeline);

  // Render the editor
  renderPipelineEditor(
    scope,
    pipeline,
    (key, fallback) => iconService.renderIcon(key as any, fallback),
    (updatedScope) => {
      // Save to storage
      savePipelineToStorage(updatedScope, pipeline);
      // Notify tab controller
      onChange(pipeline);
    }
  );

  // Setup add button
  setupAddStepButton(scope, pipeline, onChange);
}

/**
 * Load pipeline from localStorage
 */
function loadPipelineFromStorage(scope: PipelineScope, pipeline: Pipeline): void {
  try {
    const raw = storageService.load<SerializedPipelineStep[]>(`pipeline:${scope}`);
    if (!raw) return;

    const steps = raw.map((s) => {
      if (s.type === 'ElitePromotion') {
        return Object.assign(new ElitePromotionStep(s.id, s.enabled, s.symbols, s.max), {});
      }
      if (s.type === 'AddSymbols') {
        return Object.assign(new AddSymbolsStep(s.id, s.enabled, s.delta || {}), {});
      }
      if (s.type === 'SwitchSymbols') {
        const inst = new SwitchSymbolsStep(s.id, s.enabled, s.from, s.to, s.ratio, s.max);
        if (Array.isArray(s.fromParts) && s.fromParts.length) {
          inst.fromParts = s.fromParts.slice(0, 2).map((p) => ({
            symbol: p.symbol,
            units: Math.max(1, (p.units | 0))
          }));
        }
        return Object.assign(inst, {});
      }
      if (s.type === 'CombatSwitch') {
        const cfg = {
          costSymbol: ((s.costSymbol as keyof Aggregate) || 'specials') as keyof Aggregate,
          costCount: s.costCount || 1,
          selfDelta: s.selfDelta || {},
          oppDelta: s.oppDelta || {},
          max: s.max as number | null | undefined,
          costParts: Array.isArray(s.costParts) && s.costParts.length
            ? s.costParts.slice(0, 2).map((p) => ({
                symbol: p.symbol,
                units: Math.max(1, (p.units | 0))
              }))
            : undefined
        };
        return Object.assign(new CombatSwitchStep(s.id, s.enabled, cfg), {});
      }
      return null;
    }).filter(Boolean);

    if (steps.length) {
      pipeline.steps = steps as any[];
    }
  } catch (e) {
    console.error(`Failed to load pipeline from storage (${scope})`, e);
  }
}

/**
 * Save pipeline to localStorage
 */
function savePipelineToStorage(scope: PipelineScope, pipeline: Pipeline): void {
  try {
    const serializable = pipeline.steps.map((s: any) => ({
      type: s.type,
      id: s.id,
      enabled: !!s.enabled,
      delta: s.delta,
      symbols: s.symbols,
      from: s.from,
      fromParts: s.fromParts,
      to: s.to,
      ratio: s.ratio,
      max: s.max,
      costSymbol: s.costSymbol,
      costCount: s.costCount,
      costParts: s.costParts,
      selfDelta: s.selfDelta,
      oppDelta: s.oppDelta
    }));
    storageService.save(`pipeline:${scope}`, serializable);
  } catch (e) {
    console.error(`Failed to persist pipeline (${scope})`, e);
  }
}

/**
 * Setup add step button
 */
function setupAddStepButton(
  scope: PipelineScope,
  pipeline: Pipeline,
  onChange: (pipeline: Pipeline) => void
): void {
  const select = document.getElementById(`${scope}-add-step`) as HTMLSelectElement | null;
  const btn = document.getElementById(`${scope}-add-step-btn`) as HTMLButtonElement | null;

  btn?.addEventListener('click', () => {
    const type = select?.value;
    if (!type) return;

    const id = `${type}-${Date.now()}`;
    if (type === 'ElitePromotion') {
      pipeline.steps.push(new ElitePromotionStep(id, true));
    }
    if (type === 'AddSymbols') {
      pipeline.steps.push(new AddSymbolsStep(id, true, { hits: 0, blocks: 0, specials: 0 }));
    }
    if (type === 'SwitchSymbols') {
      pipeline.steps.push(new SwitchSymbolsStep(id, true, 'specials', 'hits', { x: 1, y: 1 }));
    }
    if (type === 'CombatSwitch') {
      pipeline.steps.push(
        new CombatSwitchStep(id, true, {
          costSymbol: 'specials',
          costCount: 1,
          selfDelta: { hits: 0, blocks: 0, specials: 0 },
          oppDelta: { hits: 0, blocks: 0, specials: 0 },
          max: null
        })
      );
    }

    // Re-render and notify
    renderPipelineEditor(
      scope,
      pipeline,
      (key, fallback) => iconService.renderIcon(key as any, fallback),
      (updatedScope) => {
        savePipelineToStorage(updatedScope, pipeline);
        onChange(pipeline);
      }
    );
    onChange(pipeline);
  });
}

