import { Pipeline, type PipelineStep, ElitePromotionStep, AddSymbolsStep, SwitchSymbolsStep, CombatSwitchStep } from '../pipeline';
import type { Aggregate } from '../dice';

function friendlyStepTitle(type: string): string {
  switch (type) {
    case 'ElitePromotion': return 'Elite promotion';
    case 'AddSymbols': return 'Automatic symbols';
    case 'SwitchSymbols': return 'Switch symbols';
    case 'CombatSwitch': return 'Combat switch';
    default: return type;
  }
}

export function renderPipelineEditor(
  scope: 'analysis' | 'attacker' | 'defender',
  pipeline: Pipeline,
  iconSpan: (key: string, fallbackText?: string) => string,
  onChanged: (scope: 'analysis'|'attacker'|'defender') => void
): void {
  const list = document.getElementById(`${scope}-step-list`) as HTMLElement | null;
  if (!list) return;
  list.innerHTML = '';
  pipeline.steps.forEach((step: PipelineStep, index: number) => {
    const card = document.createElement('div');
    card.className = 'step-card';
    card.draggable = true;
    card.dataset.index = String(index);

    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.innerHTML = '⋮⋮';
    card.appendChild(handle);

    const header = document.createElement('div');
    header.className = 'step-header';
    const title = document.createElement('div');
    title.className = 'step-title';
    title.textContent = friendlyStepTitle(step.type);
    const toggle = document.createElement('label');
    toggle.className = 'step-switch';
    toggle.innerHTML = `<input type="checkbox" ${step.enabled ? 'checked' : ''}> <span>Enabled</span>`;
    header.appendChild(title);
    header.appendChild(toggle);
    card.appendChild(header);

    const actions = document.createElement('div');
    actions.className = 'step-actions';
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn--danger btn--sm';
    delBtn.textContent = 'Remove';
    actions.appendChild(delBtn);
    card.appendChild(actions);

    const options = document.createElement('div');
    options.className = 'step-options';
    if (step.type === 'AddSymbols') {
      const s = step as AddSymbolsStep;
      const icon = (k: string, fb?: string) => iconSpan(k, fb);
      options.innerHTML = `
        <label class="checkbox-label" title="Add Hits">
          ${icon('HIT','⚔️')}
          <input class="form-control form-control--sm" aria-label="Hits" type="number" data-opt="hits" value="${s.delta?.hits || 0}" min="0" step="1" style="width:90px;">
        </label>
        <label class="checkbox-label" title="Add Blocks">
          ${icon('BLOCK','🛡️')}
          <input class="form-control form-control--sm" aria-label="Blocks" type="number" data-opt="blocks" value="${s.delta?.blocks || 0}" min="0" step="1" style="width:90px;">
        </label>
        <label class="checkbox-label" title="Add Specials">
          ${icon('SPECIAL','⚡')}
          <input class="form-control form-control--sm" aria-label="Specials" type="number" data-opt="specials" value="${s.delta?.specials || 0}" min="0" step="1" style="width:90px;">
        </label>
      `;
    } else if (step.type === 'ElitePromotion') {
      const s = step as ElitePromotionStep;
      const icon = (k: string, fb?: string) => iconSpan(k, fb);
      options.innerHTML = `
        <label class="checkbox-label" title="Hollow Hits → Hits">${icon('HOLLOW_HIT','⭕')} → ${icon('HIT','⚔️')} <input type="checkbox" data-opt="hollowHits" ${s.symbols?.includes('hollowHits') ? 'checked' : ''}></label>
        <label class="checkbox-label" title="Hollow Blocks → Blocks">${icon('HOLLOW_BLOCK','⭕')} → ${icon('BLOCK','🛡️')} <input type="checkbox" data-opt="hollowBlocks" ${s.symbols?.includes('hollowBlocks') ? 'checked' : ''}></label>
        <label class="checkbox-label" title="Hollow Specials → Specials">${icon('HOLLOW_SPECIAL','⭕')} → ${icon('SPECIAL','⚡')} <input type="checkbox" data-opt="hollowSpecials" ${s.symbols?.includes('hollowSpecials') ? 'checked' : ''}></label>
      `;
    } else if (step.type === 'SwitchSymbols') {
      const s = step as SwitchSymbolsStep;
      const m = (window as unknown as { WARCROW_ICON_MAP?: Record<string, string> }).WARCROW_ICON_MAP || {};
      options.innerHTML = `
        <label class="checkbox-label">
          <input class="form-control form-control--sm" type="number" data-opt="ratioX" value="${s.ratio?.x || 1}" min="1" step="1" style="width:80px;">&nbsp;
          of
        </label>
        <label class="checkbox-label">
          <select class="form-control form-control--sm" data-opt="from" aria-label="From symbol" data-wc-symbols="true" style="font-family: 'WarcrowSymbols', var(--font-family-base);">
            <option ${s.from==='hits'?'selected':''} value="hits" title="Hits">${m.HIT || '⚔️'}</option>
            <option ${s.from==='blocks'?'selected':''} value="blocks" title="Blocks">${m.BLOCK || '🛡️'}</option>
            <option ${s.from==='specials'?'selected':''} value="specials" title="Specials">${m.SPECIAL || '⚡'}</option>
            <option ${s.from==='hollowHits'?'selected':''} value="hollowHits" title="Hollow Hits">${m.HOLLOW_HIT || '⭕'}</option>
            <option ${s.from==='hollowBlocks'?'selected':''} value="hollowBlocks" title="Hollow Blocks">${m.HOLLOW_BLOCK || '⭕'}</option>
            <option ${s.from==='hollowSpecials'?'selected':''} value="hollowSpecials" title="Hollow Specials">${m.HOLLOW_SPECIAL || '⭕'}</option>
            <option value="hits+hollowHits" title="Hits + Hollow Hits">${(m.HIT||'⚔️')} ${(m.HOLLOW_HIT||'⭕')}</option>
            <option value="blocks+hollowBlocks" title="Blocks + Hollow Blocks">${(m.BLOCK||'🛡️')} ${(m.HOLLOW_BLOCK||'⭕')}</option>
            <option value="specials+hollowSpecials" title="Specials + Hollow Specials">${(m.SPECIAL||'⚡')} ${(m.HOLLOW_SPECIAL||'⭕')}</option>
          </select>
        </label>
        <div class="checkbox-label">→</div>
        <label class="checkbox-label">
          <input class="form-control form-control--sm" type="number" data-opt="ratioY" value="${s.ratio?.y || 1}" min="0" step="1" style="width:80px;">&nbsp;
          of
        </label>
        <label class="checkbox-label">
          <select class="form-control form-control--sm" data-opt="to" aria-label="To symbol" data-wc-symbols="true" style="font-family: 'WarcrowSymbols', var(--font-family-base);">
            <option ${s.to==='hits'?'selected':''} value="hits" title="Hits">${m.HIT || '⚔️'}</option>
            <option ${s.to==='blocks'?'selected':''} value="blocks" title="Blocks">${m.BLOCK || '🛡️'}</option>
            <option ${s.to==='specials'?'selected':''} value="specials" title="Specials">${m.SPECIAL || '⚡'}</option>
          </select>
        </label>
        <label class="checkbox-label">Max groups
          <input class="form-control form-control--sm" type="number" data-opt="max" value="${s.max ?? ''}" min="0" step="1" style="width:100px;" placeholder="∞">
        </label>
      `;
    } else if (step.type === 'CombatSwitch') {
      const s = step as CombatSwitchStep;
      const icon = (k: string, fb?: string) => iconSpan(k, fb);
      const sd = s.selfDelta || {}; const od = s.oppDelta || {};
      const symbolOpts = (() => {
        const m = (window as unknown as { WARCROW_ICON_MAP?: Record<string, string> }).WARCROW_ICON_MAP || {};
        const opt = (val: string, key: string, title: string) => `<option ${s.costSymbol===val?'selected':''} value="${val}" title="${title}">${m[key] || ''}</option>`;
        return [
          opt('hits','HIT','Hits'),
          opt('blocks','BLOCK','Blocks'),
          opt('specials','SPECIAL','Specials'),
          opt('hollowHits','HOLLOW_HIT','Hollow Hits'),
          opt('hollowBlocks','HOLLOW_BLOCK','Hollow Blocks'),
          opt('hollowSpecials','HOLLOW_SPECIAL','Hollow Specials'),
          `<option value="hits+hollowHits" title="Hits + Hollow Hits">${(m.HIT||'⚔️')} ${(m.HOLLOW_HIT||'⭕')}</option>`,
          `<option value="blocks+hollowBlocks" title="Blocks + Hollow Blocks">${(m.BLOCK||'🛡️')} ${(m.HOLLOW_BLOCK||'⭕')}</option>`,
          `<option value="specials+hollowSpecials" title="Specials + Hollow Specials">${(m.SPECIAL||'⚡')} ${(m.HOLLOW_SPECIAL||'⭕')}</option>`
        ].join('');
      })();
      options.innerHTML = `
        <div class="checkbox-label" title="Cost per activation">Cost:</div>
        <label class="checkbox-label">
          <select class="form-control form-control--sm" data-opt="costSymbol" aria-label="Cost symbol" data-wc-symbols="true" style="font-family: 'WarcrowSymbols', var(--font-family-base); width: 120px;">
            ${symbolOpts}
          </select>
        </label>
        <label class="checkbox-label">× <input class="form-control form-control--sm" type="number" data-opt="costCount" value="${s.costCount||1}" min="1" step="1" style="width:80px;"></label>
        <label class="checkbox-label">Max groups <input class="form-control form-control--sm" type="number" data-opt="max" value="${s.max ?? ''}" min="0" step="1" style="width:100px;" placeholder="∞"></label>
        <div style="flex-basis:100%; height:0;"></div>
        <div style="width:100%;">
          <div class="checkbox-label" title="Your bonuses per activation">Self:</div>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            <label class="checkbox-label">${icon('HIT','⚔️')} <input class="form-control form-control--sm" type="number" data-opt="selfDelta.hits" value="${sd.hits||0}" min="0" step="1" style="width:80px;"></label>
            <label class="checkbox-label">${icon('BLOCK','🛡️')} <input class="form-control form-control--sm" type="number" data-opt="selfDelta.blocks" value="${sd.blocks||0}" min="0" step="1" style="width:80px;"></label>
            <label class="checkbox-label">${icon('SPECIAL','⚡')} <input class="form-control form-control--sm" type="number" data-opt="selfDelta.specials" value="${sd.specials||0}" min="0" step="1" style="width:80px;"></label>
          </div>
        </div>
        <div style="flex-basis:100%; height:0;"></div>
        <div style="width:100%;">
          <div class="checkbox-label" title="Subtract from opponent per activation">Opponent (subtract):</div>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            <label class="checkbox-label">${icon('HIT','⚔️')} <input class="form-control form-control--sm" type="number" data-opt="oppDelta.hits" value="${od.hits||0}" min="0" step="1" style="width:80px;"></label>
            <label class="checkbox-label">${icon('BLOCK','🛡️')} <input class="form-control form-control--sm" type="number" data-opt="oppDelta.blocks" value="${od.blocks||0}" min="0" step="1" style="width:80px;"></label>
            <label class="checkbox-label">${icon('SPECIAL','⚡')} <input class="form-control form-control--sm" type="number" data-opt="oppDelta.specials" value="${od.specials||0}" min="0" step="1" style="width:80px;"></label>
          </div>
        </div>
      `;
    }
    card.appendChild(options);

    toggle.querySelector('input')?.addEventListener('change', (e) => {
      const input = e.currentTarget as HTMLInputElement;
      (step as PipelineStep).enabled = !!input.checked;
      onChanged(scope);
    });
    delBtn.addEventListener('click', () => {
      const idx = pipeline.steps.indexOf(step);
      if (idx >= 0) pipeline.steps.splice(idx, 1);
      renderPipelineEditor(scope, pipeline, iconSpan, onChanged);
      onChanged(scope);
    });
    options.querySelectorAll('input,select').forEach(el => {
      el.addEventListener('input', () => {
        const elem = el as HTMLInputElement | HTMLSelectElement;
        const dsOpt = (elem as HTMLElement).dataset.opt as string | undefined;
        if (step.type === 'AddSymbols') {
          const s = step as AddSymbolsStep;
          s.delta = s.delta || {};
          if (dsOpt && (['hits','blocks','specials'] as const).includes(dsOpt as any)) {
            (s.delta as Record<'hits'|'blocks'|'specials', number>)[dsOpt as 'hits'|'blocks'|'specials'] = parseInt(elem.value || '0', 10) || 0;
          }
        } else if (step.type === 'ElitePromotion') {
          const s = step as ElitePromotionStep;
          const set = new Set<keyof Aggregate>(s.symbols || ['hollowHits','hollowBlocks','hollowSpecials']);
          const key = (dsOpt as keyof Aggregate | undefined);
          if (key) { if ((elem as HTMLInputElement).checked) set.add(key); else set.delete(key); }
          s.symbols = Array.from(set);
        } else if (step.type === 'SwitchSymbols') {
          const s = step as SwitchSymbolsStep;
          if (dsOpt === 'from' || dsOpt === 'to') (s as any)[dsOpt] = elem.value as any;
          if (dsOpt === 'ratioX') { s.ratio = s.ratio || { x: 1, y: 1 }; s.ratio.x = Math.max(1, parseInt(elem.value || '1', 10) || 1); }
          if (dsOpt === 'ratioY') { s.ratio = s.ratio || { x: 1, y: 1 }; s.ratio.y = Math.max(0, parseInt(elem.value || '1', 10) || 1); }
          if (dsOpt === 'max') s.max = elem.value === '' ? null : Math.max(0, parseInt(elem.value || '0', 10) || 0);
          if (dsOpt === 'from') {
            if (typeof elem.value === 'string' && elem.value.includes('+')) {
              const [a,b] = elem.value.split('+');
              s.fromParts = [ { symbol: a as keyof Aggregate, units: 1 }, { symbol: b as keyof Aggregate, units: 1 } ];
            } else {
              s.fromParts = null;
            }
          }
        } else if (step.type === 'CombatSwitch') {
          const s = step as CombatSwitchStep;
          const key = dsOpt;
          if (key === 'costSymbol') { 
            s.costSymbol = elem.value as keyof Aggregate; 
            if (typeof elem.value === 'string' && elem.value.includes('+')) {
              const [a,b] = elem.value.split('+');
              s.costParts = [ { symbol: a as keyof Aggregate, units: 1 }, { symbol: b as keyof Aggregate, units: 1 } ];
            } else {
              s.costParts = null;
            }
          }
          else if (key === 'costCount') { s.costCount = Math.max(1, parseInt(elem.value || '1', 10) || 1); }
          else if (key === 'max') { s.max = elem.value === '' ? null : Math.max(0, parseInt(elem.value || '0', 10) || 0); }
          else if (key && key.startsWith('selfDelta.')) {
            s.selfDelta = s.selfDelta || {};
            const sub = key.split('.')[1] as keyof typeof s.selfDelta;
            (s.selfDelta as Record<'hits'|'blocks'|'specials', number>)[sub as 'hits'|'blocks'|'specials'] = Math.max(0, parseInt(elem.value || '0', 10) || 0);
          } else if (key && key.startsWith('oppDelta.')) {
            s.oppDelta = s.oppDelta || {};
            const sub = key.split('.')[1] as keyof typeof s.oppDelta;
            (s.oppDelta as Record<'hits'|'blocks'|'specials', number>)[sub as 'hits'|'blocks'|'specials'] = Math.max(0, parseInt(elem.value || '0', 10) || 0);
          }
        }
        onChanged(scope);
      });
    });

    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      if ((e as DragEvent).dataTransfer) {
        (e as DragEvent).dataTransfer!.effectAllowed = 'move';
        (e as DragEvent).dataTransfer!.setData('text/plain', String(index));
      }
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      list.querySelectorAll('.step-card').forEach(c => c.classList.remove('over'));
    });
    list.appendChild(card);
  });

  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    const dragging = list.querySelector('.dragging') as HTMLElement | null;
    if (!dragging) return;
    let after: Element | null = null;
    Array.from(list.children).forEach(child => child.classList.remove('over'));
    for (const child of Array.from(list.children)) {
      const rect = (child as HTMLElement).getBoundingClientRect();
      if ((e as DragEvent).clientY < rect.top + rect.height / 2) { after = child; break; }
    }
    if (after) { list.insertBefore(dragging, after); (after as HTMLElement).classList.add('over'); }
    else { list.appendChild(dragging); }
  });
  list.addEventListener('drop', () => {
    const newSteps: PipelineStep[] = [];
    list.querySelectorAll<HTMLElement>('.step-card').forEach(card => {
      const oldIdx = parseInt(card.dataset.index || '0', 10);
      const step = pipeline.steps[oldIdx];
      if (step) newSteps.push(step);
    });
    pipeline.steps = newSteps;
    renderPipelineEditor(scope, pipeline, iconSpan, onChanged);
    onChanged(scope);
  });
}


