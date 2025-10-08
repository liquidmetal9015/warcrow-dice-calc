// Enhanced Warcrow Monte Carlo Calculator (refactored to use dice.js)
import { loadDiceFaces, performMonteCarloSimulation, performCombatSimulation, computeDieStats, normalizeColor, isAttackColor } from './dice.js';

class WarcrowCalculator {
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
        this.DEFAULT_SIMULATION_COUNT = 10000;
        this.debounceMs = 150;
        this.analysisDebounceTimeout = null;
        this.combatDebounceTimeout = null;
        this.pendingAnalysisRun = false;
        this.pendingCombatRun = false;

        this.init();
    }

    async init() {
        try {
            this.facesByColor = await loadDiceFaces();
        } catch (e) {
            console.error(e);
            alert('Failed to load dice faces.');
            return;
        }
        this.initializeEventListeners();
        // Ensure initial tab styling and visibility reflect the DOM's active tab
        const activeBtn = document.querySelector('.tab-btn.active');
        const initialTab = activeBtn?.dataset.tab || 'analysis';
        this.switchTab(initialTab);
        // Reveal tab bar after classes are correct to prevent FOUC
        const tabSelector = document.querySelector('.tab-selector');
        if (tabSelector) tabSelector.style.visibility = 'visible';
        this.updateFaceStatsUI();
        this.updateDisplay();
        this.resetResultsDisplay();
    }

    initializeEventListeners() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Manual run controls removed from UI

        document.getElementById('reset-pool').addEventListener('click', () => {
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

        document.getElementById('reset-combat').addEventListener('click', () => {
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

        // Removed presets

        // Auto-run is now always on by default

        document.querySelectorAll('.dice-btn-plus, .dice-btn-minus').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleDiceAdjust(e.currentTarget));
        });

        // Analysis per-chart segmented controls
        ['analysis-mode-hits', 'analysis-mode-blocks', 'analysis-mode-specials'].forEach(name => {
            document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
                r.addEventListener('change', () => this.updateChartDisplay());
            });
        });
        // Bivariate segmented controls
        ['analysis-mode-hs', 'analysis-mode-bs'].forEach(name => {
            document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
                r.addEventListener('change', () => this.updateBivariateDisplay());
            });
        });
        const attackerElite = document.getElementById('attacker-elite');
        if (attackerElite) {
            attackerElite.addEventListener('change', () => {
                this.hideCombatResults();
                if (this.isCombatSimulating) {
                    this.pendingCombatRun = true;
                } else {
                    this.scheduleCombatRun();
                }
            });
        }
        const defenderElite = document.getElementById('defender-elite');
        if (defenderElite) {
            defenderElite.addEventListener('change', () => {
                this.hideCombatResults();
                if (this.isCombatSimulating) {
                    this.pendingCombatRun = true;
                } else {
                    this.scheduleCombatRun();
                }
            });
        }

        // No checkbox controls; charts are always present in collapsible sections
    }

    handleDiceAdjust(button) {
        const parent = button.closest('.dice-type');
        const label = parent.querySelector('.dice-label').textContent.trim();
        const poolName = parent.dataset.pool || 'analysis';
        const isPlus = button.classList.contains('dice-btn-plus');
        const pool = poolName === 'attacker' ? this.attackerPool : poolName === 'defender' ? this.defenderPool : this.analysisPool;
        const newVal = Math.max(0, (pool[label] || 0) + (isPlus ? 1 : -1));
        pool[label] = newVal;
        parent.querySelector('.dice-count').textContent = String(newVal);
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

    syncCountsFromState() {
        document.querySelectorAll('.dice-type').forEach(el => {
            const label = el.querySelector('.dice-label').textContent.trim();
            const poolName = el.dataset.pool || 'analysis';
            const pool = poolName === 'attacker' ? this.attackerPool : poolName === 'defender' ? this.defenderPool : this.analysisPool;
            el.querySelector('.dice-count').textContent = String(pool[label] || 0);
        });
    }

    switchTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll('.tab-btn').forEach(b => {
            const isActive = b.dataset.tab === tab;
            b.classList.toggle('active', isActive);
            b.classList.toggle('btn--primary', isActive);
            b.classList.toggle('btn--outline', !isActive);
        });
        document.getElementById('analysis-tab').classList.toggle('hidden', tab !== 'analysis');
        document.getElementById('combat-tab').classList.toggle('hidden', tab !== 'combat');
        document.getElementById('faces-tab').classList.toggle('hidden', tab !== 'faces');
        this.updateDisplay();
    }

    updateDisplay() {
        this.updateStatus();
    }

    markResultsOutdated() {
        // No longer show a warning; just transition to loading state
        this.resultsOutdated = true;
        this.hideResults();
    }

    markCombatResultsOutdated() {
        // No longer show a warning; just transition to loading state
        this.combatResultsOutdated = true;
        this.hideCombatResults();
    }

    updateStatus() {
        const simStatus = document.getElementById('sim-status');
        if (simStatus) {
            simStatus.className = 'status ' + (this.isSimulating ? 'status--info' : 'status--success');
            simStatus.textContent = this.isSimulating ? 'Running…' : 'Ready';
        }
        const combatStatus = document.getElementById('combat-status');
        if (combatStatus) {
            combatStatus.className = 'status ' + (this.isCombatSimulating ? 'status--info' : 'status--success');
            combatStatus.textContent = this.isCombatSimulating ? 'Running…' : 'Ready';
        }
        this.updateRunButtonsAvailability?.();
    }

    hideResults() {
        const totalDice = Object.values(this.analysisPool).reduce((s, c) => s + c, 0);
        if (totalDice === 0) {
            this.showEmptyAnalysisState();
            return;
        }
        this.setAnalysisResultsVisibility(true);
        document.getElementById('symbol-summary').innerHTML = `<div class="loading-placeholder"><div class="skeleton-card"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div></div>`;
    }

    hideCombatResults() {
        const attackerTotal = Object.values(this.attackerPool).reduce((s, c) => s + c, 0);
        const defenderTotal = Object.values(this.defenderPool).reduce((s, c) => s + c, 0);
        if (attackerTotal === 0 && defenderTotal === 0) {
            this.showEmptyCombatState();
            return;
        }
        this.setCombatResultsVisibility(true);
        document.getElementById('combat-summary').innerHTML = `<div class="loading-placeholder"><div class="skeleton-card"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div></div>`;
    }

    showResultsWarning(show) {
        const el = document.getElementById('results-warning');
        if (el) el.classList.toggle('hidden', !show);
    }

    showCombatResultsWarning(show) {
        const el = document.getElementById('combat-results-warning');
        if (el) el.classList.toggle('hidden', !show);
    }

    updateButtonState(buttonId, isLoading) {
        const button = document.getElementById(buttonId);
        const btnText = button.querySelector('.btn-text');
        const btnLoading = button.querySelector('.btn-loading');
        if (isLoading) {
            button.setAttribute('disabled', 'true');
            btnText.style.opacity = 0;
            btnLoading.classList.remove('hidden');
        } else {
            button.removeAttribute('disabled');
            btnText.style.opacity = 1;
            btnLoading.classList.add('hidden');
        }
    }

    maybeAutoRunAnalysis() {
        const totalDice = Object.values(this.analysisPool).reduce((s, c) => s + c, 0);
        if (totalDice > 0 && !this.isSimulating) {
            this.runSimulation();
        } else if (totalDice === 0) {
            this.showEmptyAnalysisState();
        }
    }

    scheduleAnalysisRun() {
        if (this.analysisDebounceTimeout) clearTimeout(this.analysisDebounceTimeout);
        this.analysisDebounceTimeout = setTimeout(() => this.maybeAutoRunAnalysis(), this.debounceMs);
    }

    maybeAutoRunCombat() {
        const attackerTotal = Object.values(this.attackerPool).reduce((s, c) => s + c, 0);
        const defenderTotal = Object.values(this.defenderPool).reduce((s, c) => s + c, 0);
        if ((attackerTotal > 0 || defenderTotal > 0) && !this.isCombatSimulating) {
            this.runCombatSimulation();
        } else if (attackerTotal === 0 && defenderTotal === 0) {
            this.showEmptyCombatState();
        }
    }

    scheduleCombatRun() {
        if (this.combatDebounceTimeout) clearTimeout(this.combatDebounceTimeout);
        this.combatDebounceTimeout = setTimeout(() => this.maybeAutoRunCombat(), this.debounceMs);
    }

    resetResultsDisplay() {
        this.resultsOutdated = false;
        this.combatResultsOutdated = false;
        const rw = document.getElementById('results-warning');
        const crw = document.getElementById('combat-results-warning');
        if (rw) rw.classList.add('hidden');
        if (crw) crw.classList.add('hidden');
        this.hideResults();
        this.hideCombatResults();
    }

    async runSimulation() {
        if (this.isSimulating) return;
        const totalDice = Object.values(this.analysisPool).reduce((sum, count) => sum + count, 0);
        if (totalDice === 0) { this.showEmptyAnalysisState(); return; }
        this.isSimulating = true;
        this.hideResults();
        this.updateStatus();
        try {
            await new Promise(r => setTimeout(r, 150));
            const simulationCount = this.DEFAULT_SIMULATION_COUNT;
            const results = await performMonteCarloSimulation(this.analysisPool, this.facesByColor, simulationCount, false);
            this.lastSimulationData = results;
            this.resultsOutdated = false;
            this.showResults(results);
            this.renderAnalysisCharts();
        } catch (e) {
            console.error('Simulation error:', e);
        } finally {
            this.isSimulating = false;
            this.updateStatus();
            if (this.pendingAnalysisRun) {
                this.pendingAnalysisRun = false;
                this.scheduleAnalysisRun();
            }
        }
    }

    async runCombatSimulation() {
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
            const isAttackerElite = document.getElementById('attacker-elite').checked;
            const isDefenderElite = document.getElementById('defender-elite').checked;
            const results = await performCombatSimulation(this.attackerPool, this.defenderPool, this.facesByColor, simulationCount, isAttackerElite, isDefenderElite);
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
            if (this.pendingCombatRun) {
                this.pendingCombatRun = false;
                this.scheduleCombatRun();
            }
        }
    }

    showResults(results) {
        this.setAnalysisResultsVisibility(true);
        const summary = document.getElementById('symbol-summary');
        const ex = results?.expected || {};
        const safe = (v) => (Number.isFinite(v) ? v : 0);
        const minMax = this.computeMinMax(results);
        summary.innerHTML = `
            <div class="symbol-group">
                <h3>⚔️ Hits</h3>
                <div class="symbol-stats">
                    <div class="stat-item"><span class="stat-label">Expected</span><span class="stat-value">${safe(ex.hits).toFixed(2)}</span></div>
                    <div class="stat-item"><span class="stat-label">Min</span><span class="stat-value">${minMax.hits.min}</span></div>
                    <div class="stat-item"><span class="stat-label">Max</span><span class="stat-value">${minMax.hits.max}</span></div>
                </div>
            </div>
            <div class="symbol-group">
                <h3>🛡️ Blocks</h3>
                <div class="symbol-stats">
                    <div class="stat-item"><span class="stat-label">Expected</span><span class="stat-value">${safe(ex.blocks).toFixed(2)}</span></div>
                    <div class="stat-item"><span class="stat-label">Min</span><span class="stat-value">${minMax.blocks.min}</span></div>
                    <div class="stat-item"><span class="stat-label">Max</span><span class="stat-value">${minMax.blocks.max}</span></div>
                </div>
            </div>
            <div class="symbol-group">
                <h3>⚡ Specials</h3>
                <div class="symbol-stats">
                    <div class="stat-item"><span class="stat-label">Expected</span><span class="stat-value">${safe(ex.specials).toFixed(2)}</span></div>
                    <div class="stat-item"><span class="stat-label">Min</span><span class="stat-value">${minMax.specials.min}</span></div>
                    <div class="stat-item"><span class="stat-label">Max</span><span class="stat-value">${minMax.specials.max}</span></div>
                </div>
            </div>
        `;
        document.getElementById('results-timestamp').textContent = results.timestamp;
    }

    computeMinMax(results) {
        const keysToScan = ['hits', 'blocks', 'specials'];
        const out = {};
        for (const key of keysToScan) {
            const map = results[key] || {};
            const present = Object.keys(map).map(k => parseInt(k, 10)).filter(n => !Number.isNaN(n) && (map[n] || 0) > 0);
            if (present.length === 0) {
                out[key] = { min: 0, max: 0 };
            } else {
                out[key] = { min: Math.min(...present), max: Math.max(...present) };
            }
        }
        return out;
    }

    showCombatResults(results) {
        this.setCombatResultsVisibility(true);
        const summary = document.getElementById('combat-summary');
        const ex = results?.expected || {};
        const safe = (v) => (Number.isFinite(v) ? v : 0);
        summary.innerHTML = `
            <div class="combat-stats">
                <div class="stat-group attacker-stats"><h3>Attacker</h3>
                    <div class="stat-item"><span class="stat-label">Expected Hits</span><span class="stat-value">${safe(ex.attackerHits).toFixed(2)}</span></div>
                    <div class="stat-item"><span class="stat-label">Expected Specials</span><span class="stat-value">${safe(ex.attackerSpecials).toFixed(2)}</span></div>
                    <div class="stat-item"><span class="stat-label">Expected Blocks</span><span class="stat-value">${safe(ex.attackerBlocks).toFixed(2)}</span></div>
                </div>
                <div class="stat-group defender-stats"><h3>Defender</h3>
                    <div class="stat-item"><span class="stat-label">Expected Hits</span><span class="stat-value">${safe(ex.defenderHits).toFixed(2)}</span></div>
                    <div class="stat-item"><span class="stat-label">Expected Specials</span><span class="stat-value">${safe(ex.defenderSpecials).toFixed(2)}</span></div>
                    <div class="stat-item"><span class="stat-label">Expected Blocks</span><span class="stat-value">${safe(ex.defenderBlocks).toFixed(2)}</span></div>
                </div>
                <div class="stat-group outcome-stats"><h3>Outcome</h3>
                    <div class="stat-item"><span class="stat-label">Attacker Win Rate</span><span class="stat-value">${safe(results.attackerWinRate).toFixed(1)}%</span></div>
                    <div class="stat-item"><span class="stat-label">Attacker Tie Rate</span><span class="stat-value">${safe(results.attackerTieRate).toFixed(1)}%</span></div>
                    <div class="stat-item"><span class="stat-label">Attacker Loss Rate</span><span class="stat-value">${safe(results.attackerLossRate).toFixed(1)}%</span></div>
                    <div class="stat-item"><span class="stat-label">Expected Wounds (Attacker → Defender)</span><span class="stat-value">${safe(ex.woundsAttacker).toFixed(2)}</span></div>
                    <div class="stat-item"><span class="stat-label">Expected Wounds (Defender → Attacker)</span><span class="stat-value">${safe(ex.woundsDefender).toFixed(2)}</span></div>
                </div>
            </div>`;
        document.getElementById('combat-results-timestamp').textContent = results.timestamp;
    }

    updateFaceStatsUI() {
        if (!this.facesByColor) return;
        document.querySelectorAll('#analysis-tab .dice-type').forEach(diceType => {
            const colorLabel = diceType.dataset.color;
            const color = normalizeColor(colorLabel);
            const statsEl = diceType.querySelector('.dice-stats');
            if (!statsEl) return;
            const stats = computeDieStats(this.facesByColor[color], color);
            statsEl.textContent = `${stats.primaryPct.toFixed(1)}% ${stats.primaryLabel}, ${stats.secondaryPct.toFixed(1)}% ${stats.secondaryLabel}`;
        });

        const faceGrid = document.querySelector('#faces-tab .dice-face-grid');
        if (!faceGrid) return;
        faceGrid.innerHTML = '';
        const order = ['RED','ORANGE','YELLOW','GREEN','BLUE','BLACK'];
        const iconMap = { RED: '⚔️', ORANGE: '⚔️', YELLOW: '⚡', GREEN: '🛡️', BLUE: '🛡️', BLACK: '⚡' };
        for (const color of order) {
            const faces = this.facesByColor[color];
            const pretty = color.charAt(0) + color.slice(1).toLowerCase();
            const wrapper = document.createElement('div');
            wrapper.className = 'die-reference';
            wrapper.dataset.color = pretty;
            const role = isAttackColor(color) ? 'Attack' : 'Defense';
            wrapper.innerHTML = `
                <div class="die-header">
                    <div class="dice-icon ${pretty.toLowerCase()}-die">${iconMap[color]}</div>
                    <div class="die-info">
                        <h3>${pretty} ${role} Die</h3>
                        <p>Faces derived from canonical JSON</p>
                    </div>
                </div>
                <div class="face-list"></div>
            `;
            const list = wrapper.querySelector('.face-list');
            faces.forEach((face, idx) => {
                const div = document.createElement('div');
                div.className = 'face-item';
                div.textContent = `Face ${idx+1}: ${face.map(sym => symbolToEmoji(sym)).join(' ')}`;
                list.appendChild(div);
            });
            faceGrid.appendChild(wrapper);
        }
    }

    updateChartDisplay() {
        if (!this.lastSimulationData) return;
        this.renderAnalysisCharts();
    }

    updateBivariateDisplay() {
        if (!this.lastSimulationData) return;
        this.renderBivariateCharts();
    }

    updateRunButtonsAvailability() {
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

    showEmptyAnalysisState() {
        this.setAnalysisResultsVisibility(false);
        const summary = document.getElementById('symbol-summary');
        if (summary) summary.innerHTML = '';
        const ts = document.getElementById('results-timestamp');
        if (ts) ts.textContent = '';
        this.showResultsWarning(false);
    }

    showEmptyCombatState() {
        this.setCombatResultsVisibility(false);
        const summary = document.getElementById('combat-summary');
        if (summary) summary.innerHTML = '';
        const ts = document.getElementById('combat-results-timestamp');
        if (ts) ts.textContent = '';
        this.showCombatResultsWarning(false);
    }

    ensureChart(canvasId, datasets, xLabel) {
        if (this.activeCharts[canvasId]) {
            const chart = this.activeCharts[canvasId];
            chart.data.labels = datasets.labels;
            chart.data.datasets = datasets.datasets;
            chart.update();
            return;
        }
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        this.activeCharts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: { labels: datasets.labels, datasets: datasets.datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: { title: { display: true, text: xLabel } },
                    y: { beginAtZero: true, max: 100, title: { display: true, text: 'Probability %' } }
                }
            }
        });
    }

    buildCumulativeSeries(map) {
        const { labels, data } = this.buildSeries(map);
        let running = 0;
        const cumulative = data.map(v => (running += v));
        return { labels, data: cumulative };
    }

    renderAnalysisCharts() {
        if (!this.lastSimulationData) return;
        // Read per-chart modes (default to filled)
        const modeHits = (document.querySelector('input[name="analysis-mode-hits"]:checked')?.value) || 'filled';
        const modeBlocks = (document.querySelector('input[name="analysis-mode-blocks"]:checked')?.value) || 'filled';
        const modeSpecials = (document.querySelector('input[name="analysis-mode-specials"]:checked')?.value) || 'filled';

        // If switching to hollow+filled but current results don't have combined distributions,
        // re-run the simulation to populate them and avoid using undefined maps.
        const needsCombined = (
            (modeHits === 'both' && !this.lastSimulationData.totalHits) ||
            (modeBlocks === 'both' && !this.lastSimulationData.totalBlocks) ||
            (modeSpecials === 'both' && !this.lastSimulationData.totalSpecials)
        );
        if (needsCombined) {
            if (!this.isSimulating) this.runSimulation();
            return;
        }

        const colors = {
            hits: {
                filled: { bg: 'rgba(220,38,38,0.35)', border: 'rgba(220,38,38,1)' },
                hollow: { bg: 'rgba(220,38,38,0.15)', border: 'rgba(220,38,38,0.7)' }
            },
            blocks: {
                filled: { bg: 'rgba(37,99,235,0.35)', border: 'rgba(37,99,235,1)' },
                hollow: { bg: 'rgba(37,99,235,0.15)', border: 'rgba(37,99,235,0.7)' }
            },
            specials: {
                filled: { bg: 'rgba(234,179,8,0.35)', border: 'rgba(234,179,8,1)' },
                hollow: { bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.7)' }
            }
        };

        const buildAligned = (map, labels) => labels.map(l => map[parseInt(l, 10)] || 0);
        const cumulativeFrom = (arr) => {
            let run = 0;
            return arr.map(v => (run += v));
        };

        const makeDatasets = (filledMap, hollowMap, combinedMap, colorSet, title, mode) => {
            const keysFilled = Object.keys(filledMap).map(k => parseInt(k, 10)).filter(n => !Number.isNaN(n) && (filledMap[n] || 0) > 0);
            const keysHollow = Object.keys(hollowMap).map(k => parseInt(k, 10)).filter(n => !Number.isNaN(n) && (hollowMap[n] || 0) > 0);
            const keysCombined = Object.keys(combinedMap || {}).map(k => parseInt(k, 10)).filter(n => !Number.isNaN(n) && ((combinedMap || {})[n] || 0) > 0);
            const maxKey = Math.max(0, ...keysFilled, ...keysHollow, ...keysCombined);
            const labels = Array.from({ length: maxKey + 1 }, (_, i) => String(i));

            const datasets = [];
            if (mode === 'filled') {
                const data = buildAligned(filledMap, labels);
                const cum = cumulativeFrom([...data]);
                datasets.push(
                    { type: 'bar', label: `${title} (filled) %`, data, backgroundColor: colorSet.filled.bg, borderColor: colorSet.filled.border, borderWidth: 1 },
                    { type: 'line', label: `${title} (filled) cumulative %`, data: cum, borderColor: colorSet.filled.border, backgroundColor: colorSet.filled.border, yAxisID: 'y', tension: 0.2 }
                );
            }
            else if (mode === 'hollow') {
                const dataH = buildAligned(hollowMap, labels);
                const cumH = cumulativeFrom([...dataH]);
                datasets.push(
                    { type: 'bar', label: `${title} (hollow) %`, data: dataH, backgroundColor: colorSet.hollow.bg, borderColor: colorSet.hollow.border, borderWidth: 1 },
                    { type: 'line', label: `${title} (hollow) cumulative %`, data: cumH, borderColor: colorSet.hollow.border, backgroundColor: colorSet.hollow.border, yAxisID: 'y', tension: 0.2 }
                );
            }
            else {
                // both: use proper combined distribution from simulation (not a sum of percentages)
                const summed = buildAligned(combinedMap || {}, labels);
                const cumSum = cumulativeFrom([...summed]);
                datasets.push(
                    { type: 'bar', label: `${title} (filled + hollow) %`, data: summed, backgroundColor: colorSet.filled.bg, borderColor: colorSet.filled.border, borderWidth: 1 },
                    { type: 'line', label: `${title} (filled + hollow) cumulative %`, data: cumSum, borderColor: colorSet.filled.border, backgroundColor: colorSet.filled.border, yAxisID: 'y', tension: 0.2 }
                );
            }

            return { labels, datasets };
        };

        this.ensureChart('chart-hits', makeDatasets(this.lastSimulationData.hits, this.lastSimulationData.hollowHits, this.lastSimulationData.totalHits, colors.hits, 'Hits', modeHits), 'Count');
        this.ensureChart('chart-blocks', makeDatasets(this.lastSimulationData.blocks, this.lastSimulationData.hollowBlocks, this.lastSimulationData.totalBlocks, colors.blocks, 'Blocks', modeBlocks), 'Count');
        this.ensureChart('chart-specials', makeDatasets(this.lastSimulationData.specials, this.lastSimulationData.hollowSpecials, this.lastSimulationData.totalSpecials, colors.specials, 'Specials', modeSpecials), 'Count');

        // Also render bivariate heatmaps
        this.renderBivariateCharts();
    }

    ensurePlotlyHeatmap(divId, jointMap, xLabel, yLabel) {
        const el = document.getElementById(divId);
        if (!el || !jointMap) return;

        // Build z matrix (percent) and cumulative-at-least matrix as customdata
        const xKeys = Object.keys(jointMap).map(k => parseInt(k, 10)).filter(n => !Number.isNaN(n));
        const maxX = Math.max(0, ...(xKeys.length ? xKeys : [0]));
        let maxY = 0;
        for (const x of xKeys) {
            const yKeys = Object.keys(jointMap[x] || {}).map(k => parseInt(k, 10)).filter(n => !Number.isNaN(n));
            if (yKeys.length) maxY = Math.max(maxY, Math.max(...yKeys));
        }
        const width = maxX + 1;
        const height = maxY + 1;
        const z = Array.from({ length: height }, () => Array.from({ length: width }, () => 0));
        for (let x = 0; x <= maxX; x++) {
            const row = jointMap[x] || {};
            for (let y = 0; y <= maxY; y++) {
                const v = row[y] || 0;
                // Plotly heatmap expects z as rows along y, columns along x
                z[y][x] = v;
            }
        }
        // Cumulative at least: cum[y][x] = sum_{yy>=y, xx>=x} z[yy][xx]
        const cum = Array.from({ length: height }, () => Array.from({ length: width }, () => 0));
        for (let y = height - 1; y >= 0; y--) {
            for (let x = width - 1; x >= 0; x--) {
                const self = z[y][x];
                const right = x + 1 < width ? cum[y][x + 1] : 0;
                const down = y + 1 < height ? cum[y + 1][x] : 0;
                const diag = (x + 1 < width && y + 1 < height) ? cum[y + 1][x + 1] : 0;
                cum[y][x] = self + right + down - diag;
            }
        }

        // Colors aligned with app palette (dark low values to avoid bright whites)
        const colorscale = [
            [0, 'rgb(19,52,59)'],       // slate-900
            [0.25, 'rgb(41,150,161)'],  // teal-800
            [0.5, 'rgb(33,128,141)'],   // teal-500
            [0.75, 'rgb(45,166,178)'],  // teal-400
            [1, 'rgb(50,184,198)']      // teal-300
        ];

        // Read theme colors from CSS variables
        const rs = getComputedStyle(document.documentElement);
        const textColor = (rs.getPropertyValue('--color-text') || '#333').trim();
        const borderColor = (rs.getPropertyValue('--color-border') || 'rgba(0,0,0,0.2)').trim();

        const trace = {
            type: 'heatmap',
            x: Array.from({ length: width }, (_, i) => i),
            y: Array.from({ length: height }, (_, i) => i),
            z,
            customdata: cum,
            hovertemplate: `${xLabel}=%{x}<br>${yLabel}=%{y}<br>P=%{z:.2f}%<br>Cum P(≥ %{x}, ≥ %{y})=%{customdata:.2f}%<extra></extra>`,
            colorscale,
            colorbar: {
                title: { text: 'Probability %', side: 'right' },
                tickcolor: textColor,
                tickfont: { color: textColor },
                titlefont: { color: textColor },
                thickness: 12
            },
            zmin: 0,
            zauto: true
        };

        // Ensure the plot fills its container
        const container = el.parentElement;
        if (container) container.style.overflow = 'hidden';
        el.style.width = '100%';
        el.style.height = '100%';

        const layout = {
            autosize: true,
            margin: { l: 44, r: 12, t: 8, b: 44 },
            xaxis: {
                title: { text: xLabel, font: { color: textColor } },
                dtick: 1,
                rangemode: 'tozero',
                tickfont: { color: textColor },
                gridcolor: borderColor,
                zerolinecolor: borderColor
            },
            yaxis: {
                title: { text: yLabel, font: { color: textColor } },
                dtick: 1,
                rangemode: 'tozero',
                tickfont: { color: textColor },
                gridcolor: borderColor,
                zerolinecolor: borderColor
            },
            font: { color: textColor },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            dragmode: false
        };
        const config = { displayModeBar: false, responsive: true, staticPlot: false, scrollZoom: false, doubleClick: false };

        if (el.data) {
            Plotly.react(el, [trace], layout, config);
        } else {
            Plotly.newPlot(el, [trace], layout, config);
        }
    }

    renderBivariateCharts() {
        if (!this.lastSimulationData) return;
        const modeHS = (document.querySelector('input[name="analysis-mode-hs"]:checked')?.value) || 'filled';
        const modeBS = (document.querySelector('input[name="analysis-mode-bs"]:checked')?.value) || 'filled';

        // Pick joint maps for selected mode
        const pickHSMap = () => {
            if (modeHS === 'hollow') return this.lastSimulationData.jointHitsSpecialsHollow;
            if (modeHS === 'both') return this.lastSimulationData.jointHitsSpecialsTotal;
            return this.lastSimulationData.jointHitsSpecialsFilled;
        };
        const pickBSMap = () => {
            if (modeBS === 'hollow') return this.lastSimulationData.jointBlocksSpecialsHollow;
            if (modeBS === 'both') return this.lastSimulationData.jointBlocksSpecialsTotal;
            return this.lastSimulationData.jointBlocksSpecialsFilled;
        };

        this.ensurePlotlyHeatmap('chart-hits-vs-specials', pickHSMap() || {}, 'Hits', 'Specials');
        this.ensurePlotlyHeatmap('chart-blocks-vs-specials', pickBSMap() || {}, 'Blocks', 'Specials');
    }

    destroyChart(id) {
        const chart = this.activeCharts[id];
        if (!chart) return;
        chart.destroy();
        delete this.activeCharts[id];
        const panel = document.querySelector(`.chart-panel[data-chart-id="${id}"]`);
        if (panel && panel.parentElement) panel.parentElement.removeChild(panel);
    }

    buildSeries(dataMap) {
        const keys = Object.keys(dataMap).map(k => parseInt(k, 10)).filter(n => !Number.isNaN(n));
        const max = Math.max(0, ...keys.filter(k => (dataMap[k] || 0) > 0));
        const labels = Array.from({ length: max + 1 }, (_, i) => String(i));
        const data = labels.map(l => dataMap[parseInt(l, 10)] || 0);
        return { labels, data };
    }

    showCombatChart(results) {
        const canvasA = document.getElementById('combat-wounds-attacker');
        if (this.combatChart) { this.combatChart.destroy(); this.combatChart = null; }
        if (!canvasA) return;
        const woundsA = this.buildSeries(results.woundsAttacker);
        const cumA = this.buildCumulativeSeries(results.woundsAttacker);
        const ctxA = canvasA.getContext('2d');
        this.combatChart = new Chart(ctxA, {
            type: 'bar',
            data: {
                labels: woundsA.labels,
                datasets: [
                    { type: 'bar', label: 'Wounds (Attacker → Defender) %', data: woundsA.data, backgroundColor: 'rgba(33, 128, 141, 0.35)', borderColor: 'rgba(33, 128, 141, 1)', borderWidth: 1 },
                    { type: 'line', label: 'Cumulative % (Attacker)', data: cumA.data, borderColor: 'rgba(33, 128, 141, 1)', backgroundColor: 'rgba(33, 128, 141, 1)', yAxisID: 'y', tension: 0.2 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: { title: { display: true, text: 'Wounds' } },
                    y: { beginAtZero: true, max: 100, title: { display: true, text: 'Probability %' } }
                }
            }
        });
        const canvasD = document.getElementById('combat-wounds-defender');
        if (this.combatWoundsDefChart) { this.combatWoundsDefChart.destroy(); this.combatWoundsDefChart = null; }
        if (!canvasD) return;
        const woundsD = this.buildSeries(results.woundsDefender);
        const cumD = this.buildCumulativeSeries(results.woundsDefender);
        const ctxD = canvasD.getContext('2d');
        this.combatWoundsDefChart = new Chart(ctxD, {
            type: 'bar',
            data: {
                labels: woundsD.labels,
                datasets: [
                    { type: 'bar', label: 'Wounds (Defender → Attacker) %', data: woundsD.data, backgroundColor: 'rgba(192, 21, 47, 0.25)', borderColor: 'rgba(192, 21, 47, 1)', borderWidth: 1 },
                    { type: 'line', label: 'Cumulative % (Defender)', data: cumD.data, borderColor: 'rgba(192, 21, 47, 1)', backgroundColor: 'rgba(192, 21, 47, 1)', yAxisID: 'y', tension: 0.2 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: { title: { display: true, text: 'Wounds' } },
                    y: { beginAtZero: true, max: 100, title: { display: true, text: 'Probability %' } }
                }
            }
        });
    }

    showCombatSpecialsCharts(results) {
        // Attacker specials chart
        const canvasA = document.getElementById('combat-specials-attacker');
        if (this.combatSpecialsChartAttacker) { this.combatSpecialsChartAttacker.destroy(); this.combatSpecialsChartAttacker = null; }
        if (canvasA) {
            const sA = this.buildSeries(results.attackerSpecialsDist);
            const cA = this.buildCumulativeSeries(results.attackerSpecialsDist);
            const ctxA = canvasA.getContext('2d');
            this.combatSpecialsChartAttacker = new Chart(ctxA, {
                type: 'bar',
                data: {
                    labels: sA.labels,
                    datasets: [
                        { type: 'bar', label: 'Attacker Specials %', data: sA.data, backgroundColor: 'rgba(234,179,8,0.35)', borderColor: 'rgba(234,179,8,1)', borderWidth: 1 },
                        { type: 'line', label: 'Cumulative % (Attacker)', data: cA.data, borderColor: 'rgba(234,179,8,1)', backgroundColor: 'rgba(234,179,8,1)', yAxisID: 'y', tension: 0.2 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    scales: {
                        x: { title: { display: true, text: 'Specials (Attacker)' } },
                        y: { beginAtZero: true, max: 100, title: { display: true, text: 'Probability %' } }
                    }
                }
            });
        }

        // Defender specials chart
        const canvasD = document.getElementById('combat-specials-defender');
        if (this.combatSpecialsChartDefender) { this.combatSpecialsChartDefender.destroy(); this.combatSpecialsChartDefender = null; }
        if (canvasD) {
            const sD = this.buildSeries(results.defenderSpecialsDist);
            const cD = this.buildCumulativeSeries(results.defenderSpecialsDist);
            const ctxD = canvasD.getContext('2d');
            this.combatSpecialsChartDefender = new Chart(ctxD, {
                type: 'bar',
                data: {
                    labels: sD.labels,
                    datasets: [
                        { type: 'bar', label: 'Defender Specials %', data: sD.data, backgroundColor: 'rgba(41,150,161,0.25)', borderColor: 'rgba(41,150,161,1)', borderWidth: 1 },
                        { type: 'line', label: 'Cumulative % (Defender)', data: cD.data, borderColor: 'rgba(41,150,161,1)', backgroundColor: 'rgba(41,150,161,1)', yAxisID: 'y', tension: 0.2 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    scales: {
                        x: { title: { display: true, text: 'Specials (Defender)' } },
                        y: { beginAtZero: true, max: 100, title: { display: true, text: 'Probability %' } }
                    }
                }
            });
        }
    }

    setAnalysisResultsVisibility(visible) {
        const summary = document.getElementById('symbol-summary');
        const sections = document.querySelectorAll('#analysis-tab .chart-section');
        if (summary) summary.classList.toggle('hidden', !visible);
        sections.forEach(sec => sec.classList.toggle('hidden', !visible));
    }

    setCombatResultsVisibility(visible) {
        const summary = document.getElementById('combat-summary');
        if (summary) summary.classList.toggle('hidden', !visible);
        const ids = ['combat-wounds-attacker', 'combat-wounds-defender', 'combat-specials-attacker', 'combat-specials-defender'];
        ids.forEach(id => {
            const canvas = document.getElementById(id);
            const container = canvas && canvas.parentElement;
            if (container) container.classList.toggle('hidden', !visible);
        });
    }
}

function symbolToEmoji(sym) {
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


