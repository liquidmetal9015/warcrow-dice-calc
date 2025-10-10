// Enhanced Warcrow Monte Carlo Calculator (TypeScript entry, UI logic)
import { loadDiceFaces, performMonteCarloSimulationWithPipeline, performCombatSimulationWithPipeline, computeDieStats, normalizeColor, isAttackColor } from './dice';
import type { FacesByColor, MonteCarloResults, CombatResults, Aggregate } from './dice';
import { Pipeline, ElitePromotionStep, AddSymbolsStep, SwitchSymbolsStep, CombatSwitchStep } from './pipeline';
import type { PipelineStep, SerializedPipelineStep } from './pipeline';
import { serializePipeline } from './pipelineSerialization';
import { renderPipelineEditor as renderPipelineEditorUI } from './ui/pipelineEditor';
import { SimulationController } from './controllers/simulationController';
import { DEFAULT_SIMULATION_COUNT, DEFAULT_DEBOUNCE_MS, STORAGE_KEYS } from './constants';

type StepUnion = AddSymbolsStep | ElitePromotionStep | SwitchSymbolsStep | CombatSwitchStep;

type TabName = 'analysis' | 'combat' | 'faces';
type PoolColor = 'Red' | 'Orange' | 'Yellow' | 'Green' | 'Blue' | 'Black';
type DicePool = Record<PoolColor, number>;

class WarcrowCalculator {
    PRESETS: Record<string, DicePool>;
    currentTab: TabName;
    analysisPool: DicePool;
    attackerPool: DicePool;
    defenderPool: DicePool;
    isSimulating: boolean;
    isCombatSimulating: boolean;
    lastSimulationData: MonteCarloResults | null;
    lastCombatSimulationData: CombatResults | null;
    resultsOutdated: boolean;
    combatResultsOutdated: boolean;
    activeCharts: Record<string, any>;
    combatChart: any;
    combatWoundsDefChart: any;
    combatSpecialsChartAttacker: any;
    combatSpecialsChartDefender: any;
    facesByColor: FacesByColor | null;
    DEFAULT_SIMULATION_COUNT: number;
    debounceMs: number;
    analysisDebounceTimeout: number | null;
    combatDebounceTimeout: number | null;
    pendingAnalysisRun: boolean;
    pendingCombatRun: boolean;
    _missingIconLogged: Set<string>;
    analysisPipeline: Pipeline;
    attackerPipeline: Pipeline;
    defenderPipeline: Pipeline;
    pipelines: Record<'analysis'|'attacker'|'defender', Pipeline>;
    sim: SimulationController;
    constructor() {
        this.PRESETS = {
            "basic_attack": {"Red": 1, "Orange": 0, "Yellow": 0, "Green": 0, "Blue": 0, "Black": 0},
            "strong_attack": {"Red": 2, "Orange": 1, "Yellow": 0, "Green": 0, "Blue": 0, "Black": 0},
            "special_attack": {"Red": 0, "Orange": 1, "Yellow": 2, "Green": 0, "Blue": 0, "Black": 0},
            "basic_defense": {"Red": 0, "Orange": 0, "Yellow": 0, "Green": 1, "Blue": 0, "Black": 0}
        };

        this.currentTab = 'analysis';
        this.analysisPool = { Red: 0, Orange: 0, Yellow: 0, Green: 0, Blue: 0, Black: 0 };
        this.attackerPool = { Red: 0, Orange: 0, Yellow: 0, Green: 0, Blue: 0, Black: 0 };
        this.defenderPool = { Red: 0, Orange: 0, Yellow: 0, Green: 0, Blue: 0, Black: 0 };
        this.isSimulating = false;
        this.isCombatSimulating = false;
        this.lastSimulationData = null;
        this.lastCombatSimulationData = null;
        this.resultsOutdated = false;
        this.combatResultsOutdated = false;
        this.activeCharts = {};
        this.combatChart = null;
        this.facesByColor = null;
        this.DEFAULT_SIMULATION_COUNT = DEFAULT_SIMULATION_COUNT;
        this.debounceMs = DEFAULT_DEBOUNCE_MS;
        this.analysisDebounceTimeout = null;
        this.combatDebounceTimeout = null;
        this.pendingAnalysisRun = false;
        this.pendingCombatRun = false;
        this._missingIconLogged = new Set();

        // Pipelines (initially empty/default)
        this.analysisPipeline = new Pipeline([]);
        this.attackerPipeline = new Pipeline([]);
        this.defenderPipeline = new Pipeline([]);

        this.pipelines = { analysis: this.analysisPipeline, attacker: this.attackerPipeline, defender: this.defenderPipeline };
        this.sim = new SimulationController();

        this.init();
    }

    async init(): Promise<void> {
        try {
            this.facesByColor = await loadDiceFaces();
        } catch (e) {
            console.error(e);
            alert('Failed to load dice faces.');
            return;
        }
        this.initializeEventListeners();
        const activeBtn = document.querySelector('.tab-btn.active') as HTMLElement | null;
        const initialTab = (activeBtn?.dataset?.tab as TabName) || 'analysis';
        this.switchTab(initialTab);
        const tabSelector = document.querySelector('.tab-selector') as HTMLElement | null;
        if (tabSelector) tabSelector.style.visibility = 'visible';
        this.updateFaceStatsUI();
        this.updateStaticDiceIcons();
        this.updateDisplay();
        this.resetResultsDisplay();

        this.initPostProcessingUI();
        this.loadPipelinesFromStorage();
        this.renderPipelineEditor('analysis', this.analysisPipeline);
        this.renderPipelineEditor('attacker', this.attackerPipeline);
        this.renderPipelineEditor('defender', this.defenderPipeline);
    }

    

    initializeEventListeners(): void {
        document.querySelectorAll<HTMLElement>('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab((btn.dataset?.tab as TabName) || 'analysis'));
        });

        document.getElementById('reset-pool')?.addEventListener('click', () => {
            this.analysisPool = { Red: 0, Orange: 0, Yellow: 0, Green: 0, Blue: 0, Black: 0 };
            this.syncCountsFromState();
            this.hideResults();
            if (this.isSimulating) {
                this.pendingAnalysisRun = true;
            } else {
                this.scheduleAnalysisRun();
            }
            this.updateRunButtonsAvailability();
        });

        document.getElementById('reset-combat')?.addEventListener('click', () => {
            this.attackerPool = { Red: 0, Orange: 0, Yellow: 0, Green: 0, Blue: 0, Black: 0 };
            this.defenderPool = { Red: 0, Orange: 0, Yellow: 0, Green: 0, Blue: 0, Black: 0 };
            this.syncCountsFromState();
            this.hideCombatResults();
            if (this.isCombatSimulating) {
                this.pendingCombatRun = true;
            } else {
                this.scheduleCombatRun();
            }
            this.updateRunButtonsAvailability();
        });

        document.querySelectorAll<HTMLElement>('.dice-btn-plus, .dice-btn-minus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement | null;
                if (!target) return;
                this.handleDiceAdjust(target);
            });
        });

        ['analysis-mode-hits', 'analysis-mode-blocks', 'analysis-mode-specials'].forEach(name => {
            document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`).forEach(r => {
                r.addEventListener('change', () => this.updateChartDisplay());
            });
        });
        ['analysis-mode-hs', 'analysis-mode-bs'].forEach(name => {
            document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`).forEach(r => {
                r.addEventListener('change', () => this.updateBivariateDisplay());
            });
        });

        const bindAdd = (scope: 'analysis'|'attacker'|'defender', pipeline: Pipeline) => {
            const select = document.getElementById(`${scope}-add-step`) as HTMLSelectElement | null;
            const btn = document.getElementById(`${scope}-add-step-btn`) as HTMLButtonElement | null;
            btn?.addEventListener('click', () => {
                const type = select?.value as string | undefined;
                if (!type) return;
                const id = `${type}-${Date.now()}`;
                if (type === 'ElitePromotion') pipeline.steps.push(new ElitePromotionStep(id, true));
                if (type === 'AddSymbols') pipeline.steps.push(new AddSymbolsStep(id, true, { hits: 0, blocks: 0, specials: 0 }));
                if (type === 'SwitchSymbols') pipeline.steps.push(new SwitchSymbolsStep(id, true, 'specials', 'hits', { x: 1, y: 1 }));
                if (type === 'CombatSwitch') pipeline.steps.push(new CombatSwitchStep(id, true, { costSymbol: 'specials', costCount: 1, selfDelta: { hits: 0, blocks: 0, specials: 0 }, oppDelta: { hits: 0, blocks: 0, specials: 0 }, max: null }));
                this.renderPipelineEditor(scope, pipeline);
                this.onPipelineChanged(scope);
            });
        };
        bindAdd('analysis', this.analysisPipeline);
        bindAdd('attacker', this.attackerPipeline);
        bindAdd('defender', this.defenderPipeline);
    }

    handleDiceAdjust(button: HTMLElement) {
        const parent = button.closest('.dice-type');
        const label = (parent?.querySelector('.dice-label') as HTMLElement).textContent!.trim() as PoolColor;
        const poolName = (parent as HTMLElement)?.dataset.pool || 'analysis';
        const isPlus = button.classList.contains('dice-btn-plus');
        const pool: DicePool = (poolName === 'attacker' ? this.attackerPool : (poolName === 'defender' ? this.defenderPool : this.analysisPool));
        const newVal = Math.max(0, (pool[label] || 0) + (isPlus ? 1 : -1));
        pool[label] = newVal;
        (parent?.querySelector('.dice-count') as HTMLElement).textContent = String(newVal);
        if (poolName === 'analysis') {
            this.hideResults();
            if (this.isSimulating) {
                this.pendingAnalysisRun = true;
            } else {
                this.scheduleAnalysisRun();
            }
        } else {
            this.hideCombatResults();
            if (this.isCombatSimulating) {
                this.pendingCombatRun = true;
            } else {
                this.scheduleCombatRun();
            }
        }
        this.updateRunButtonsAvailability?.();
    }

    syncCountsFromState(): void {
        document.querySelectorAll('.dice-type').forEach(el => {
            const label = (el.querySelector('.dice-label') as HTMLElement).textContent!.trim() as PoolColor;
            const poolName = (el as HTMLElement).dataset.pool || 'analysis';
            const pool: DicePool = poolName === 'attacker' ? this.attackerPool : poolName === 'defender' ? this.defenderPool : this.analysisPool;
            (el.querySelector('.dice-count') as HTMLElement).textContent = String(pool[label] || 0);
        });
    }

    switchTab(tab: TabName): void {
        this.currentTab = tab;
        document.querySelectorAll<HTMLElement>('.tab-btn').forEach(b => {
            const isActive = b.dataset?.tab === tab;
            b.classList.toggle('active', isActive);
            b.classList.toggle('btn--primary', isActive);
            b.classList.toggle('btn--outline', !isActive);
        });
        const analysisTab = document.getElementById('analysis-tab') as HTMLElement | null;
        const combatTab = document.getElementById('combat-tab') as HTMLElement | null;
        const facesTab = document.getElementById('faces-tab') as HTMLElement | null;
        if (analysisTab) analysisTab.classList.toggle('hidden', tab !== 'analysis');
        if (combatTab) combatTab.classList.toggle('hidden', tab !== 'combat');
        if (facesTab) facesTab.classList.toggle('hidden', tab !== 'faces');
        this.updateStaticDiceIcons?.();
        this.updateDisplay();
    }

    updateDisplay(): void {
        this.updateStatus();
    }

    iconSpan(key: string, fallbackText?: string): string {
        const map = (window as any).WARCROW_ICON_MAP as Record<string, string> | undefined;
        const glyph = map && map[key];
        if (glyph) return `<span class="wc-icon">${glyph}</span>`;
        this.logMissingIcon(key);
        if (typeof fallbackText === 'string' && fallbackText.length > 0) {
            return `<span class="wc-fallback">${fallbackText}</span>`;
        }
        return `<span class="wc-fallback">${key}</span>`;
    }

    logMissingIcon(key: string): void {
        try {
            if (!this._missingIconLogged) this._missingIconLogged = new Set();
            if (!this._missingIconLogged.has(key)) {
                console.warn(`[Warcrow] Missing glyph for ${key}; using fallback.`);
                this._missingIconLogged.add(key);
            }
        } catch (e) { console.warn('Failed to log missing icon', e); }
    }

    ensureAddSymbolsStep(pipeline: Pipeline, id: string) {
        let step = pipeline.steps.find(s => s.type === 'AddSymbols' && s.id === id);
        if (!step) {
            step = new AddSymbolsStep(id, false, { hits: 0, blocks: 0, specials: 0 });
            pipeline.steps.push(step);
        }
        return step;
    }

    initPostProcessingUI() {}

    loadPipelinesFromStorage(): void {
        try {
            const load = (scope: 'analysis'|'attacker'|'defender', pipeline: Pipeline) => {
                const raw = localStorage.getItem(`pipeline:${scope}`);
                if (!raw) return;
                const arr = JSON.parse(raw) as SerializedPipelineStep[];
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
                if (steps.length) pipeline.steps = steps as PipelineStep[];
            };
            load('analysis', this.analysisPipeline);
            load('attacker', this.attackerPipeline);
            load('defender', this.defenderPipeline);
        } catch (e) { console.error('Failed to load pipelines from storage', e); }
    }

    renderPipelineEditor(scope: 'analysis'|'attacker'|'defender', pipeline: Pipeline): void {
        renderPipelineEditorUI(scope, pipeline, (k, fb) => this.iconSpan(k, fb), (sc) => this.onPipelineChanged(sc));
    }

    friendlyStepTitle(type: string): string {
        switch (type) {
            case 'ElitePromotion': return 'Elite promotion';
            case 'AddSymbols': return 'Automatic symbols';
            case 'SwitchSymbols': return 'Switch symbols';
            case 'CombatSwitch': return 'Combat switch';
            default: return type;
        }
    }

    onPipelineChanged(scope: 'analysis'|'attacker'|'defender'): void {
        try {
            const key = `pipeline:${scope}`;
            const serializable = (this.pipelines[scope].steps as StepUnion[]).map((s) => ({
                type: s.type,
                id: s.id,
                enabled: !!s.enabled,
                delta: (s as any).delta,
                symbols: (s as any).symbols,
                from: (s as any).from,
                fromParts: (s as any).fromParts,
                to: (s as any).to,
                ratio: (s as any).ratio,
                max: (s as any).max,
                costSymbol: (s as any).costSymbol,
                costCount: (s as any).costCount,
                costParts: (s as any).costParts,
                selfDelta: (s as any).selfDelta,
                oppDelta: (s as any).oppDelta
            }));
            localStorage.setItem(key, JSON.stringify(serializable));
        } catch (e) { console.error('Failed to persist pipeline', e); }

        if (scope === 'analysis') { this.hideResults(); this.scheduleAnalysisRun(); }
        else { this.hideCombatResults(); this.scheduleCombatRun(); }
    }

    markResultsOutdated(): void { this.resultsOutdated = true; this.hideResults(); }
    markCombatResultsOutdated(): void { this.combatResultsOutdated = true; this.hideCombatResults(); }

    updateStatus(): void {
        const simStatus = document.getElementById('sim-status') as HTMLElement | null;
        if (simStatus) {
            simStatus.className = 'status ' + (this.isSimulating ? 'status--info' : 'status--success');
            simStatus.textContent = this.isSimulating ? 'Running…' : 'Ready';
        }
        const combatStatus = document.getElementById('combat-status') as HTMLElement | null;
        if (combatStatus) {
            combatStatus.className = 'status ' + (this.isCombatSimulating ? 'status--info' : 'status--success');
            combatStatus.textContent = this.isCombatSimulating ? 'Running…' : 'Ready';
        }
        this.updateRunButtonsAvailability?.();
    }

    hideResults(): void {
        const totalDice = Object.values(this.analysisPool).reduce((s, c) => s + c, 0);
        if (totalDice === 0) { this.showEmptyAnalysisState(); return; }
        this.setAnalysisResultsVisibility(true);
        const ss = document.getElementById('symbol-summary') as HTMLElement | null;
        if (ss) ss.innerHTML = `<div class="loading-placeholder"><div class="skeleton-card"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div></div>`;
    }

    hideCombatResults(): void {
        const attackerTotal = Object.values(this.attackerPool).reduce((s, c) => s + c, 0);
        const defenderTotal = Object.values(this.defenderPool).reduce((s, c) => s + c, 0);
        if (attackerTotal === 0 && defenderTotal === 0) { this.showEmptyCombatState(); return; }
        this.setCombatResultsVisibility(true);
        const cs = document.getElementById('combat-summary') as HTMLElement | null;
        if (cs) cs.innerHTML = `<div class="loading-placeholder"><div class="skeleton-card"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div></div>`;
    }

    showResultsWarning(show: boolean): void { const el = document.getElementById('results-warning'); if (el) el.classList.toggle('hidden', !show); }
    showCombatResultsWarning(show: boolean): void { const el = document.getElementById('combat-results-warning'); if (el) el.classList.toggle('hidden', !show); }

    updateButtonState(buttonId: string, isLoading: boolean): void {
        const button = document.getElementById(buttonId) as HTMLElement | null;
        const btnText = button?.querySelector('.btn-text') as HTMLElement | null;
        const btnLoading = button?.querySelector('.btn-loading') as HTMLElement | null;
        if (!button || !btnText || !btnLoading) return;
        if (isLoading) { button.setAttribute('disabled', 'true'); btnText.style.opacity = '0'; btnLoading.classList.remove('hidden'); }
        else { button.removeAttribute('disabled'); btnText.style.opacity = '1'; btnLoading.classList.add('hidden'); }
    }

    maybeAutoRunAnalysis() {
        const totalDice = Object.values(this.analysisPool).reduce((s, c) => s + c, 0);
        if (totalDice > 0 && !this.isSimulating) this.runSimulation();
        else if (totalDice === 0) this.showEmptyAnalysisState();
    }
    scheduleAnalysisRun(): void { if (this.analysisDebounceTimeout) clearTimeout(this.analysisDebounceTimeout); this.analysisDebounceTimeout = window.setTimeout(() => this.maybeAutoRunAnalysis(), this.debounceMs); }

    maybeAutoRunCombat() {
        const attackerTotal = Object.values(this.attackerPool).reduce((s, c) => s + c, 0);
        const defenderTotal = Object.values(this.defenderPool).reduce((s, c) => s + c, 0);
        if ((attackerTotal > 0 || defenderTotal > 0) && !this.isCombatSimulating) this.runCombatSimulation();
        else if (attackerTotal === 0 && defenderTotal === 0) this.showEmptyCombatState();
    }
    scheduleCombatRun(): void { if (this.combatDebounceTimeout) clearTimeout(this.combatDebounceTimeout); this.combatDebounceTimeout = window.setTimeout(() => this.maybeAutoRunCombat(), this.debounceMs); }

    resetResultsDisplay(): void {
        this.resultsOutdated = false;
        this.combatResultsOutdated = false;
        const rw = document.getElementById('results-warning');
        const crw = document.getElementById('combat-results-warning');
        if (rw) rw.classList.add('hidden');
        if (crw) crw.classList.add('hidden');
        this.hideResults();
        this.hideCombatResults();
    }

    async runSimulation(): Promise<void> {
        if (this.isSimulating) return;
        const totalDice = Object.values(this.analysisPool).reduce((sum, count) => sum + count, 0);
        if (totalDice === 0) { this.showEmptyAnalysisState(); return; }
        this.isSimulating = true;
        this.hideResults();
        this.updateStatus();
        try {
            await new Promise(r => setTimeout(r, 150));
            const simulationCount = this.DEFAULT_SIMULATION_COUNT;
            const results = await this.sim.runAnalysisWithPipeline(this.analysisPool, this.facesByColor as FacesByColor, simulationCount, this.analysisPipeline);
            this.lastSimulationData = results;
            this.resultsOutdated = false;
            this.showResults(results);
            this.renderAnalysisCharts();
        } catch (e) {
            console.error('Simulation error:', e);
        } finally {
            this.isSimulating = false;
            this.updateStatus();
            if (this.pendingAnalysisRun) { this.pendingAnalysisRun = false; this.scheduleAnalysisRun(); }
        }
    }

    async runCombatSimulation(): Promise<void> {
        if (this.isCombatSimulating) return;
        const attackerTotal = Object.values(this.attackerPool).reduce((sum, count) => sum + count, 0);
        const defenderTotal = Object.values(this.defenderPool).reduce((sum, count) => sum + count, 0);
        if (attackerTotal === 0 && defenderTotal === 0) { this.showEmptyCombatState(); return; }
        this.isCombatSimulating = true;
        this.hideCombatResults();
        this.updateStatus();
        try {
            await new Promise(r => setTimeout(r, 150));
            const simulationCount = this.DEFAULT_SIMULATION_COUNT;
            const results = await this.sim.runCombatWithPipeline(this.attackerPool, this.defenderPool, this.facesByColor as FacesByColor, simulationCount, this.attackerPipeline, this.defenderPipeline);
            this.lastCombatSimulationData = results;
            this.combatResultsOutdated = false;
            this.showCombatResults(results);
            this.showCombatChart(results);
            this.showCombatSpecialsCharts(results);
        } catch (e) {
            console.error('Combat simulation error:', e);
        } finally {
            this.isCombatSimulating = false;
            this.updateStatus();
            if (this.pendingCombatRun) { this.pendingCombatRun = false; this.scheduleCombatRun(); }
        }
    }

    showResults(results: MonteCarloResults): void {
        this.setAnalysisResultsVisibility(true);
        const summary = document.getElementById('symbol-summary') as HTMLElement | null;
        if (!summary) return;
        const ex = results?.expected || {};
        const sd = results?.std || {};
        const safe = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
        const minMax = this.computeMinMax(results);
        const icon = (key: string, fallback?: string) => this.iconSpan(key, fallback);
        summary.innerHTML = `
            <div class="symbol-group">
                <h3>${icon('HIT','⚔️')} Hits</h3>
                <div class="symbol-stats">
                    <div class="stat-item"><span class="stat-label">Expected</span><span class="stat-value">${safe(ex.hits).toFixed(2)} ± ${safe(sd.hits).toFixed(2)}</span></div>
                    <div class="stat-item"><span class="stat-label">Min</span><span class="stat-value">${minMax.hits.min}</span></div>
                    <div class="stat-item"><span class="stat-label">Max</span><span class="stat-value">${minMax.hits.max}</span></div>
                </div>
            </div>
            <div class="symbol-group">
                <h3>${icon('BLOCK','🛡️')} Blocks</h3>
                <div class="symbol-stats">
                    <div class="stat-item"><span class="stat-label">Expected</span><span class="stat-value">${safe(ex.blocks).toFixed(2)} ± ${safe(sd.blocks).toFixed(2)}</span></div>
                    <div class="stat-item"><span class="stat-label">Min</span><span class="stat-value">${minMax.blocks.min}</span></div>
                    <div class="stat-item"><span class="stat-label">Max</span><span class="stat-value">${minMax.blocks.max}</span></div>
                </div>
            </div>
            <div class="symbol-group">
                <h3>${icon('SPECIAL','⚡')} Specials</h3>
                <div class="symbol-stats">
                    <div class="stat-item"><span class="stat-label">Expected</span><span class="stat-value">${safe(ex.specials).toFixed(2)} ± ${safe(sd.specials).toFixed(2)}</span></div>
                    <div class="stat-item"><span class="stat-label">Min</span><span class="stat-value">${minMax.specials.min}</span></div>
                    <div class="stat-item"><span class="stat-label">Max</span><span class="stat-value">${minMax.specials.max}</span></div>
                </div>
            </div>
        `;
        const ts = document.getElementById('results-timestamp');
        if (ts) ts.textContent = results.timestamp;
    }

    computeMinMax(results: MonteCarloResults): { [k in 'hits'|'blocks'|'specials']: { min: number; max: number } } {
        const out: any = {};
        const pairs: Array<['hits'|'blocks'|'specials', Record<number, number>]> = [
            ['hits', results.hits],
            ['blocks', results.blocks],
            ['specials', results.specials]
        ];
        for (const [key, map] of pairs) {
            const present = Object.keys(map).map(k => parseInt(k, 10)).filter(n => !Number.isNaN(n) && (map[n] || 0) > 0);
            out[key] = present.length === 0 ? { min: 0, max: 0 } : { min: Math.min(...present), max: Math.max(...present) };
        }
        return out;
    }

    showCombatResults(results: CombatResults): void {
        this.setCombatResultsVisibility(true);
        const summary = document.getElementById('combat-summary') as HTMLElement | null;
        if (!summary) return;
        const ex = results?.expected || {};
        const safe = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
        const icon = (key: string, fallback?: string) => this.iconSpan(key, fallback);
        summary.innerHTML = `
            <div class="combat-stats">
                <div class="stat-group attacker-stats"><h3>Attacker</h3>
                    <div class="stat-item"><span class="stat-label">${icon('HIT','⚔️')} Hits</span><span class="stat-value">${safe(ex.attackerHits).toFixed(2)}</span></div>
                    <div class="stat-item"><span class="stat-label">${icon('SPECIAL','⚡')} Specials</span><span class="stat-value">${safe(ex.attackerSpecials).toFixed(2)}</span></div>
                    <div class="stat-item"><span class="stat-label">${icon('BLOCK','🛡️')} Blocks</span><span class="stat-value">${safe(ex.attackerBlocks).toFixed(2)}</span></div>
                </div>
                <div class="stat-group defender-stats"><h3>Defender</h3>
                    <div class="stat-item"><span class="stat-label">${icon('HIT','⚔️')} Hits</span><span class="stat-value">${safe(ex.defenderHits).toFixed(2)}</span></div>
                    <div class="stat-item"><span class="stat-label">${icon('SPECIAL','⚡')} Specials</span><span class="stat-value">${safe(ex.defenderSpecials).toFixed(2)}</span></div>
                    <div class="stat-item"><span class="stat-label">${icon('BLOCK','🛡️')} Blocks</span><span class="stat-value">${safe(ex.defenderBlocks).toFixed(2)}</span></div>
                </div>
                <div class="stat-group outcome-stats"><h3>Outcome</h3>
                    <div class="stat-item"><span class="stat-label">Attacker Win Rate</span><span class="stat-value">${safe(results.attackerWinRate).toFixed(1)}%</span></div>
                    <div class="stat-item"><span class="stat-label">Attacker Tie Rate</span><span class="stat-value">${safe(results.attackerTieRate).toFixed(1)}%</span></div>
                    <div class="stat-item"><span class="stat-label">Attacker Loss Rate</span><span class="stat-value">${safe(results.attackerLossRate).toFixed(1)}%</span></div>
                    <div class="stat-item"><span class="stat-label">${icon('WOUND','❤')} Wounds (Attacker → Defender)</span><span class="stat-value">${safe(ex.woundsAttacker).toFixed(2)}</span></div>
                    <div class="stat-item"><span class="stat-label">${icon('WOUND','❤')} Wounds (Defender → Attacker)</span><span class="stat-value">${safe(ex.woundsDefender).toFixed(2)}</span></div>
                </div>
            </div>`;
        const cts = document.getElementById('combat-results-timestamp');
        if (cts) cts.textContent = results.timestamp;
    }

    updateFaceStatsUI(): void {
        if (!this.facesByColor) return;
        document.querySelectorAll<HTMLElement>('#analysis-tab .dice-type').forEach(diceType => {
            const colorLabel = (diceType.dataset as any).color as string | undefined;
            const color = normalizeColor(colorLabel || '');
            const statsEl = diceType.querySelector('.dice-stats') as HTMLElement | null;
            if (!statsEl) return;
            const fb = (this.facesByColor as FacesByColor)[color];
            if (!fb) return;
            const stats = computeDieStats(fb, color);
            statsEl.textContent = `${stats.primaryPct.toFixed(1)}% ${stats.primaryLabel}, ${stats.secondaryPct.toFixed(1)}% ${stats.secondaryLabel}`;
        });

        const faceGrid = document.querySelector('#faces-tab .dice-face-grid') as HTMLElement | null;
        if (!faceGrid) return;
        faceGrid.innerHTML = '';
        const order = ['RED','ORANGE','YELLOW','GREEN','BLUE','BLACK'] as const;
        const iconMap: Record<typeof order[number], string> = { RED: '⚔️', ORANGE: '⚔️', YELLOW: '⚡', GREEN: '🛡️', BLUE: '🛡️', BLACK: '⚡' };
        for (const color of order) {
            const faces = (this.facesByColor as FacesByColor)[color];
            if (!faces) continue;
            const pretty = color.charAt(0) + color.slice(1).toLowerCase();
            const wrapper = document.createElement('div');
            wrapper.className = 'die-reference';
            (wrapper as HTMLElement).dataset.color = pretty as any;
            const role = isAttackColor(color) ? 'Attack' : 'Defense';
            const dieKey = `DIE_${color}`;
            const headerIcon = this.iconSpan(dieKey, iconMap[color]);
            wrapper.innerHTML = `
                <div class="die-header">
                    <div class="dice-icon ${pretty.toLowerCase()}-die">${headerIcon}</div>
                    <div class="die-info">
                        <h3>${pretty} ${role} Die</h3>
                        <p>Faces derived from canonical JSON</p>
                    </div>
                </div>
                <div class="face-list"></div>
            `;
            const list = wrapper.querySelector('.face-list') as HTMLElement | null;
            faces.forEach((face, idx) => {
                const div = document.createElement('div');
                div.className = 'face-item';
                const text = `Face ${idx+1}: `;
                if ((window as any).WARCROW_ICON_MAP && typeof (window as any).WARCROW_ICON_MAP === 'object') {
                    const spans = face.map(sym => {
                        const g = (window as any).WARCROW_ICON_MAP[sym];
                        if (!g) return symbolToEmoji(sym);
                        return `<span class="wc-icon">${g}</span>`;
                    }).join(' ');
                    div.innerHTML = text + spans;
                } else {
                    div.textContent = text + face.map(sym => symbolToEmoji(sym)).join(' ');
                }
                if (list) list.appendChild(div);
            });
            faceGrid.appendChild(wrapper);
        }
    }

    updateStaticDiceIcons(): void {
        document.querySelectorAll<HTMLElement>('.dice-type .dice-icon').forEach(div => {
            const parent = div.closest('.dice-type') as HTMLElement | null;
            const label = parent?.dataset.color;
            if (!label) return;
            const key = `DIE_${normalizeColor(label)}`;
            const g = (window as any).WARCROW_ICON_MAP?.[key];
            if (g) div.innerHTML = `<span class="wc-icon">${g}</span>`; else this.logMissingIcon(key);
        });
    }

    updateChartDisplay(): void { if (!this.lastSimulationData) return; this.renderAnalysisCharts(); }
    updateBivariateDisplay(): void { if (!this.lastSimulationData) return; this.renderBivariateCharts(); }

    updateRunButtonsAvailability(): void {
        const simBtn = document.getElementById('run-simulation');
        const combatBtn = document.getElementById('run-combat-simulation');
        if (simBtn) {
            const totalDice = Object.values(this.analysisPool).reduce((s, c) => s + c, 0);
            simBtn.toggleAttribute('disabled', this.isSimulating || totalDice === 0);
        }
        if (combatBtn) {
            const attackerTotal = Object.values(this.attackerPool).reduce((s, c) => s + c, 0);
            const defenderTotal = Object.values(this.defenderPool).reduce((s, c) => s + c, 0);
            combatBtn.toggleAttribute('disabled', this.isCombatSimulating || (attackerTotal === 0 && defenderTotal === 0));
        }
    }

    showEmptyAnalysisState(): void {
        this.setAnalysisResultsVisibility(false);
        const summary = document.getElementById('symbol-summary');
        if (summary) summary.innerHTML = '';
        const ts = document.getElementById('results-timestamp');
        if (ts) ts.textContent = '';
        this.showResultsWarning(false);
    }

    showEmptyCombatState(): void {
        this.setCombatResultsVisibility(false);
        const summary = document.getElementById('combat-summary');
        if (summary) summary.innerHTML = '';
        const ts = document.getElementById('combat-results-timestamp');
        if (ts) ts.textContent = '';
        this.showCombatResultsWarning(false);
    }

    ensureChart(canvasId: string, datasets: { labels: string[]; datasets: any[] }, xLabel: string): void {
        if (this.activeCharts[canvasId]) {
            const chart = this.activeCharts[canvasId];
            chart.data.labels = datasets.labels;
            chart.data.datasets = datasets.datasets;
            chart.update();
            return;
        }
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
        if (!canvas) return;
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        this.activeCharts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: { labels: datasets.labels, datasets: datasets.datasets },
            options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { x: { title: { display: true, text: xLabel } }, y: { beginAtZero: true, max: 100, title: { display: true, text: 'Probability %' } } } }
        });
    }

    buildCumulativeSeries(map: Record<number, number>): { labels: string[]; data: number[] } {
        const { labels, data } = this.buildSeries(map);
        const out: number[] = new Array(data.length) as number[];
        let run = 0;
        for (let i = data.length - 1; i >= 0; i--) { run += (data[i] ?? 0); out[i] = run; }
        return { labels, data: out };
    }

    renderAnalysisCharts(): void {
        if (!this.lastSimulationData) return;
        const modeHits = (document.querySelector('input[name="analysis-mode-hits"]:checked') as HTMLInputElement | null)?.value || 'filled';
        const modeBlocks = (document.querySelector('input[name="analysis-mode-blocks"]:checked') as HTMLInputElement | null)?.value || 'filled';
        const modeSpecials = (document.querySelector('input[name="analysis-mode-specials"]:checked') as HTMLInputElement | null)?.value || 'filled';
        const needsCombined = ((modeHits === 'both' && !this.lastSimulationData!.totalHits) || (modeBlocks === 'both' && !this.lastSimulationData!.totalBlocks) || (modeSpecials === 'both' && !this.lastSimulationData!.totalSpecials));
        if (needsCombined) { if (!this.isSimulating) this.runSimulation(); return; }
        const colors: any = {
            hits: { filled: { bg: 'rgba(220,38,38,0.35)', border: 'rgba(220,38,38,1)' }, hollow: { bg: 'rgba(220,38,38,0.15)', border: 'rgba(220,38,38,0.7)' } },
            blocks: { filled: { bg: 'rgba(37,99,235,0.35)', border: 'rgba(37,99,235,1)' }, hollow: { bg: 'rgba(37,99,235,0.15)', border: 'rgba(37,99,235,0.7)' } },
            specials: { filled: { bg: 'rgba(234,179,8,0.35)', border: 'rgba(234,179,8,1)' }, hollow: { bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.7)' } }
        };
        const buildAligned = (map: Record<number, number>, labels: string[]) => labels.map((l: string) => map[parseInt(l, 10)] || 0);
        const tailCumulativeFrom = (arr: number[]) => { const out: number[] = new Array(arr.length) as number[]; let run = 0; for (let i = arr.length - 1; i >= 0; i--) { run += (arr[i] ?? 0); out[i] = run; } return out; };
        const makeDatasets = (filledMap: Record<number, number>, hollowMap: Record<number, number>, combinedMap: Record<number, number> | undefined, colorSet: any, title: string, mode: string) => {
            const keysFilled = Object.keys(filledMap).map(k => parseInt(k, 10)).filter(n => !Number.isNaN(n) && (filledMap[n] || 0) > 0);
            const keysHollow = Object.keys(hollowMap).map(k => parseInt(k, 10)).filter(n => !Number.isNaN(n) && (hollowMap[n] || 0) > 0);
            const keysCombined = Object.keys(combinedMap || {}).map(k => parseInt(k, 10)).filter(n => !Number.isNaN(n) && ((combinedMap || {})[n] || 0) > 0);
            const maxKey = Math.max(0, ...keysFilled, ...keysHollow, ...keysCombined);
            const labels = Array.from({ length: maxKey + 1 }, (_, i) => String(i));
            const datasets: any[] = [];
            if (mode === 'filled') {
                const data = buildAligned(filledMap, labels); const tail = tailCumulativeFrom([...data]);
                datasets.push(
                    { type: 'bar', label: `${title} (filled) %`, data, backgroundColor: colorSet.filled.bg, borderColor: colorSet.filled.border, borderWidth: 1 },
                    { type: 'line', label: title + ' (filled) cumulative % (>= x)', data: tail, borderColor: colorSet.filled.border, backgroundColor: colorSet.filled.border, yAxisID: 'y', tension: 0.2 }
                );
            } else if (mode === 'hollow') {
                const dataH = buildAligned(hollowMap, labels); const tailH = tailCumulativeFrom([...dataH]);
                datasets.push(
                    { type: 'bar', label: `${title} (hollow) %`, data: dataH, backgroundColor: colorSet.hollow.bg, borderColor: colorSet.hollow.border, borderWidth: 1 },
                    { type: 'line', label: title + ' (hollow) cumulative % (>= x)', data: tailH, borderColor: colorSet.hollow.border, backgroundColor: colorSet.hollow.border, yAxisID: 'y', tension: 0.2 }
                );
            } else {
                const summed = buildAligned(combinedMap || {}, labels); const tailSum = tailCumulativeFrom([...summed]);
                datasets.push(
                    { type: 'bar', label: `${title} (filled + hollow) %`, data: summed, backgroundColor: colorSet.filled.bg, borderColor: colorSet.filled.border, borderWidth: 1 },
                    { type: 'line', label: title + ' (filled + hollow) cumulative % (>= x)', data: tailSum, borderColor: colorSet.filled.border, backgroundColor: colorSet.filled.border, yAxisID: 'y', tension: 0.2 }
                );
            }
            return { labels, datasets };
        };
        const d = this.lastSimulationData!;
        const dsHits = makeDatasets(d.hits, d.hollowHits, d.totalHits, colors.hits, 'Hits', modeHits);
        const dsBlocks = makeDatasets(d.blocks, d.hollowBlocks, d.totalBlocks, colors.blocks, 'Blocks', modeBlocks);
        const dsSpecials = makeDatasets(d.specials, d.hollowSpecials, d.totalSpecials, colors.specials, 'Specials', modeSpecials);
        this.ensureChart('chart-hits', dsHits, 'Count');
        this.ensureChart('chart-blocks', dsBlocks, 'Count');
        this.ensureChart('chart-specials', dsSpecials, 'Count');
        this.renderBivariateCharts();
    }

    ensurePlotlyHeatmap(divId: string, jointMap: Record<number, Record<number, number>>, xLabel: string, yLabel: string): void {
        const el = document.getElementById(divId) as any;
        if (!el || !jointMap) return;
        const xKeys = Object.keys(jointMap).map(k => parseInt(k, 10)).filter(n => !Number.isNaN(n));
        const maxX = Math.max(0, ...(xKeys.length ? xKeys : [0]));
        let maxY = 0;
        for (const x of xKeys) {
            const yKeys = Object.keys(jointMap[x] || {}).map(k => parseInt(k, 10)).filter(n => !Number.isNaN(n));
            if (yKeys.length) maxY = Math.max(maxY, Math.max(...yKeys));
        }
        const width = maxX + 1; const height = maxY + 1;
        const z: number[][] = Array.from({ length: height }, () => Array.from({ length: width }, () => 0));
        for (let x = 0; x <= maxX; x++) {
            const row = jointMap[x] || {};
            for (let y = 0; y <= maxY; y++) {
                const v = (row as any)[y] || 0;
                const rowZ = z[y] as number[];
                rowZ[x] = v;
            }
        }
        const cum: number[][] = Array.from({ length: height }, () => Array.from({ length: width }, () => 0));
        for (let y = height - 1; y >= 0; y--) {
            for (let x = width - 1; x >= 0; x--) {
                const rowZ = z[y] as number[];
                const rowCum = cum[y] as number[];
                const nextRowCum = y + 1 < height ? (cum[y + 1] as number[]) : undefined;
                const self = (rowZ[x] ?? 0);
                const right = x + 1 < width ? (rowCum[x + 1] ?? 0) : 0;
                const down = nextRowCum ? (nextRowCum[x] ?? 0) : 0;
                const diag = (x + 1 < width && nextRowCum) ? (nextRowCum[x + 1] ?? 0) : 0;
                rowCum[x] = self + right + down - diag;
            }
        }
        const colorscale = [ [0, 'rgb(19,52,59)'], [0.25, 'rgb(41,150,161)'], [0.5, 'rgb(33,128,141)'], [0.75, 'rgb(45,166,178)'], [1, 'rgb(50,184,198)'] ];
        const rs = getComputedStyle(document.documentElement);
        const textColor = (rs.getPropertyValue('--color-text') || '#333').trim();
        const borderColor = (rs.getPropertyValue('--color-border') || 'rgba(0,0,0,0.2)').trim();
        const hover = xLabel + '=%{x}<br>' + yLabel + '=%{y}<br>' + 'P=%{z:.2f}%<br>' + 'Cum P(>= %{x}, >= %{y})=%{customdata:.2f}%<extra></extra>';
        const trace = { type: 'heatmap', x: Array.from({ length: width }, (_, i) => i), y: Array.from({ length: height }, (_, i) => i), z, customdata: cum, hovertemplate: hover, colorscale, colorbar: { title: { text: 'Probability %', side: 'right' }, tickcolor: textColor, tickfont: { color: textColor }, titlefont: { color: textColor }, thickness: 12 }, zmin: 0, zauto: true } as any;
        const container = el.parentElement; if (container) container.style.overflow = 'hidden'; el.style.width = '100%'; el.style.height = '100%';
        const layout = { autosize: true, margin: { l: 44, r: 12, t: 8, b: 44 }, xaxis: { title: { text: xLabel, font: { color: textColor } }, dtick: 1, rangemode: 'tozero', tickfont: { color: textColor }, gridcolor: borderColor, zerolinecolor: borderColor }, yaxis: { title: { text: yLabel, font: { color: textColor } }, dtick: 1, rangemode: 'tozero', tickfont: { color: textColor }, gridcolor: borderColor, zerolinecolor: borderColor }, font: { color: textColor }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', dragmode: false } as any;
        const config = { displayModeBar: false, responsive: true, staticPlot: false, scrollZoom: false, doubleClick: false } as any;
        if (el.data) { (window as any).Plotly.react(el, [trace], layout, config); } else { (window as any).Plotly.newPlot(el, [trace], layout, config); }
    }

    renderBivariateCharts(): void {
        if (!this.lastSimulationData) return;
        const modeHS = (document.querySelector('input[name="analysis-mode-hs"]:checked') as HTMLInputElement | null)?.value || 'filled';
        const modeBS = (document.querySelector('input[name="analysis-mode-bs"]:checked') as HTMLInputElement | null)?.value || 'filled';
        const pickHSMap = () => { const d = this.lastSimulationData!; if (modeHS === 'hollow') return d.jointHitsSpecialsHollow; if (modeHS === 'both') return d.jointHitsSpecialsTotal; return d.jointHitsSpecialsFilled; };
        const pickBSMap = () => { const d = this.lastSimulationData!; if (modeBS === 'hollow') return d.jointBlocksSpecialsHollow; if (modeBS === 'both') return d.jointBlocksSpecialsTotal; return d.jointBlocksSpecialsFilled; };
        this.ensurePlotlyHeatmap('chart-hits-vs-specials', pickHSMap() || {}, 'Hits', 'Specials');
        this.ensurePlotlyHeatmap('chart-blocks-vs-specials', pickBSMap() || {}, 'Blocks', 'Specials');
    }

    destroyChart(id: string): void { const chart = this.activeCharts[id]; if (!chart) return; chart.destroy(); delete this.activeCharts[id]; const panel = document.querySelector(`.chart-panel[data-chart-id="${id}"]`); if (panel && panel.parentElement) panel.parentElement.removeChild(panel); }

    buildSeries(dataMap: Record<number, number>): { labels: string[]; data: number[] } { const keys = Object.keys(dataMap).map(k => parseInt(k, 10)).filter(n => !Number.isNaN(n)); const max = Math.max(0, ...keys.filter(k => (dataMap[Number(k)] || 0) > 0)); const labels = Array.from({ length: max + 1 }, (_, i) => String(i)); const data = labels.map(l => dataMap[parseInt(l, 10)] || 0); return { labels, data }; }

    showCombatChart(results: CombatResults): void {
        const canvasA = document.getElementById('combat-wounds-attacker') as HTMLCanvasElement | null;
        if (this.combatChart) { this.combatChart.destroy(); this.combatChart = null; }
        if (!canvasA) return;
        const woundsA = this.buildSeries(results.woundsAttacker);
        const cumA = this.buildCumulativeSeries(results.woundsAttacker);
        const ctxA = canvasA.getContext('2d') as CanvasRenderingContext2D | null;
        if (!ctxA) return;
        this.combatChart = new Chart(ctxA, { type: 'bar', data: { labels: woundsA.labels, datasets: [ { type: 'bar', label: 'Wounds (Attacker -> Defender) %', data: woundsA.data, backgroundColor: 'rgba(33, 128, 141, 0.35)', borderColor: 'rgba(33, 128, 141, 1)', borderWidth: 1 }, { type: 'line', label: 'Cumulative % (>= x)', data: cumA.data, borderColor: 'rgba(33, 128, 141, 1)', backgroundColor: 'rgba(33, 128, 141, 1)', yAxisID: 'y', tension: 0.2 } ] }, options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { x: { title: { display: true, text: 'Wounds' } }, y: { beginAtZero: true, max: 100, title: { display: true, text: 'Probability %' } } } } });
        const canvasD = document.getElementById('combat-wounds-defender') as HTMLCanvasElement | null;
        if (this.combatWoundsDefChart) { this.combatWoundsDefChart.destroy(); this.combatWoundsDefChart = null; }
        if (!canvasD) return;
        const woundsD = this.buildSeries(results.woundsDefender);
        const cumD = this.buildCumulativeSeries(results.woundsDefender);
        const ctxD = canvasD.getContext('2d') as CanvasRenderingContext2D | null;
        if (!ctxD) return;
        this.combatWoundsDefChart = new Chart(ctxD, { type: 'bar', data: { labels: woundsD.labels, datasets: [ { type: 'bar', label: 'Wounds (Defender -> Attacker) %', data: woundsD.data, backgroundColor: 'rgba(192, 21, 47, 0.25)', borderColor: 'rgba(192, 21, 47, 1)', borderWidth: 1 }, { type: 'line', label: 'Cumulative % (>= x)', data: cumD.data, borderColor: 'rgba(192, 21, 47, 1)', backgroundColor: 'rgba(192, 21, 47, 1)', yAxisID: 'y', tension: 0.2 } ] }, options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { x: { title: { display: true, text: 'Wounds' } }, y: { beginAtZero: true, max: 100, title: { display: true, text: 'Probability %' } } } } });
    }

    showCombatSpecialsCharts(results: CombatResults): void {
        const canvasA = document.getElementById('combat-specials-attacker') as HTMLCanvasElement | null;
        if (this.combatSpecialsChartAttacker) { this.combatSpecialsChartAttacker.destroy(); this.combatSpecialsChartAttacker = null; }
        if (canvasA) {
            const sA = this.buildSeries(results.attackerSpecialsDist);
            const cA = this.buildCumulativeSeries(results.attackerSpecialsDist);
            const ctxA = canvasA.getContext('2d') as CanvasRenderingContext2D | null;
            if (!ctxA) return;
            this.combatSpecialsChartAttacker = new Chart(ctxA, { type: 'bar', data: { labels: sA.labels, datasets: [ { type: 'bar', label: 'Attacker Specials %', data: sA.data, backgroundColor: 'rgba(234,179,8,0.35)', borderColor: 'rgba(234,179,8,1)', borderWidth: 1 }, { type: 'line', label: 'Cumulative % (>= x)', data: cA.data, borderColor: 'rgba(234,179,8,1)', backgroundColor: 'rgba(234,179,8,1)', yAxisID: 'y', tension: 0.2 } ] }, options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { x: { title: { display: true, text: 'Specials (Attacker)' } }, y: { beginAtZero: true, max: 100, title: { display: true, text: 'Probability %' } } } } });
        }
        const canvasD = document.getElementById('combat-specials-defender') as HTMLCanvasElement | null;
        if (this.combatSpecialsChartDefender) { this.combatSpecialsChartDefender.destroy(); this.combatSpecialsChartDefender = null; }
        if (canvasD) {
            const sD = this.buildSeries(results.defenderSpecialsDist);
            const cD = this.buildCumulativeSeries(results.defenderSpecialsDist);
            const ctxD = canvasD.getContext('2d') as CanvasRenderingContext2D | null;
            if (!ctxD) return;
            this.combatSpecialsChartDefender = new Chart(ctxD, { type: 'bar', data: { labels: sD.labels, datasets: [ { type: 'bar', label: 'Defender Specials %', data: sD.data, backgroundColor: 'rgba(41,150,161,0.25)', borderColor: 'rgba(41,150,161,1)', borderWidth: 1 }, { type: 'line', label: 'Cumulative % (>= x)', data: cD.data, borderColor: 'rgba(41,150,161,1)', backgroundColor: 'rgba(41,150,161,1)', yAxisID: 'y', tension: 0.2 } ] }, options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { x: { title: { display: true, text: 'Specials (Defender)' } }, y: { beginAtZero: true, max: 100, title: { display: true, text: 'Probability %' } } } } });
        }
    }

    setAnalysisResultsVisibility(visible: boolean): void { const summary = document.getElementById('symbol-summary'); const sections = document.querySelectorAll('#analysis-tab .chart-section'); if (summary) summary.classList.toggle('hidden', !visible); sections.forEach(sec => (sec as HTMLElement).classList.toggle('hidden', !visible)); }
    setCombatResultsVisibility(visible: boolean): void { const summary = document.getElementById('combat-summary'); if (summary) summary.classList.toggle('hidden', !visible); const ids = ['combat-wounds-attacker', 'combat-wounds-defender', 'combat-specials-attacker', 'combat-specials-defender']; ids.forEach(id => { const canvas = document.getElementById(id) as HTMLCanvasElement | null; const container = canvas && canvas.parentElement; if (container) (container as HTMLElement).classList.toggle('hidden', !visible); }); }
}

function symbolToEmoji(sym: string) {
    switch (sym) {
        case 'HIT': return '⚔️ HIT';
        case 'HOLLOW_HIT': return '⭕ HOLLOW HIT';
        case 'BLOCK': return '🛡️ BLOCK';
        case 'HOLLOW_BLOCK': return '⭕ HOLLOW BLOCK';
        case 'SPECIAL': return '⚡ SPECIAL';
        case 'HOLLOW_SPECIAL': return '⭕ HOLLOW SPECIAL';
        default: return sym;
    }
}

document.addEventListener('DOMContentLoaded', () => { new WarcrowCalculator(); });


