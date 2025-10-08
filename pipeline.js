// Warcrow pipeline engine for dice processing (pre/post steps)

export function blankCounts() {
    return { hits: 0, blocks: 0, specials: 0, hollowHits: 0, hollowBlocks: 0, hollowSpecials: 0 };
}

export class Pipeline {
    constructor(steps = []) { this.steps = steps; }
    applyPre(state, ctx) { for (const s of this.steps) { if (s.enabled && typeof s.applyPre === 'function') s.applyPre(state, ctx); } }
    applyPost(state) { for (const s of this.steps) { if (s.enabled && typeof s.applyPost === 'function') s.applyPost(state); } }
    applyCombat(selfAggregate, opponentAggregate, role) {
        for (const s of this.steps) {
            if (s.enabled && typeof s.applyCombat === 'function') s.applyCombat(selfAggregate, opponentAggregate, role);
        }
        // Clamp to non-negative after all steps
        const clampKeys = ['hits','blocks','specials','hollowHits','hollowBlocks','hollowSpecials'];
        for (const k of clampKeys) {
            if (selfAggregate[k] != null) selfAggregate[k] = Math.max(0, selfAggregate[k] | 0);
            if (opponentAggregate[k] != null) opponentAggregate[k] = Math.max(0, opponentAggregate[k] | 0);
        }
    }
}

export class ElitePromotionStep {
    constructor(id, enabled = true, symbols = ['hollowHits','hollowBlocks','hollowSpecials'], max = null) {
        this.id = id; this.enabled = enabled; this.symbols = symbols; this.max = max; this.type = 'ElitePromotion';
    }
    applyPost(state) {
        let remaining = (this.max == null ? Number.POSITIVE_INFINITY : this.max);
        const pairs = [ ['hollowHits','hits'], ['hollowBlocks','blocks'], ['hollowSpecials','specials'] ];
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

export class AddSymbolsStep {
    constructor(id, enabled = true, delta = {}) { this.id = id; this.enabled = enabled; this.delta = delta; this.type = 'AddSymbols'; }
    applyPost(state) {
        const keys = Object.keys(this.delta);
        for (const k of keys) {
            const v = this.delta[k] || 0;
            if (!v) continue;
            state.aggregate[k] = (state.aggregate[k] || 0) + v;
        }
    }
}

export class SwitchSymbolsStep {
    constructor(id, enabled, from, to, ratio = { x: 1, y: 1 }, max = null) {
        this.id = id; this.enabled = enabled; this.from = from; this.to = to; this.ratio = ratio; this.max = max; this.type = 'SwitchSymbols';
    }
    applyPost(state) {
        const available = Math.floor((state.aggregate[this.from] || 0) / Math.max(1, this.ratio.x));
        const groups = Math.min(available, this.max == null ? available : this.max);
        if (groups <= 0) return;
        state.aggregate[this.from] -= groups * Math.max(1, this.ratio.x);
        state.aggregate[this.to] = (state.aggregate[this.to] || 0) + groups * Math.max(0, this.ratio.y);
    }
}

// Pairwise combat switch: consume your symbols to affect both sides
export class CombatSwitchStep {
    constructor(id, enabled = true, config = {}) {
        this.id = id; this.enabled = enabled; this.type = 'CombatSwitch';
        this.costSymbol = ['hits','blocks','specials'].includes(config.costSymbol) ? config.costSymbol : 'specials';
        this.costCount = Math.max(1, (config.costCount | 0) || 1);
        this.selfDelta = Object.assign({ hits: 0, blocks: 0, specials: 0 }, config.selfDelta || {});
        this.oppDelta = Object.assign({ hits: 0, blocks: 0, specials: 0 }, config.oppDelta || {});
        this.max = (config.max == null ? null : Math.max(0, config.max | 0));
    }
    applyCombat(selfAgg, oppAgg) {
        const available = Math.max(0, selfAgg[this.costSymbol] | 0);
        const groupsByCost = Math.floor(available / Math.max(1, this.costCount));
        let groups = groupsByCost;
        if (this.max != null) groups = Math.min(groups, this.max);
        if (groups <= 0) return;

        // Pay cost from filled symbols only
        selfAgg[this.costSymbol] = Math.max(0, (selfAgg[this.costSymbol] | 0) - groups * Math.max(1, this.costCount));

        // Apply self bonuses per activation
        for (const k of Object.keys(this.selfDelta)) {
            const v = Math.max(0, this.selfDelta[k] | 0);
            if (!v) continue;
            selfAgg[k] = (selfAgg[k] | 0) + v * groups;
        }
        // Apply opponent debuffs per activation (subtract)
        for (const k of Object.keys(this.oppDelta)) {
            const v = Math.max(0, this.oppDelta[k] | 0);
            if (!v) continue;
            oppAgg[k] = Math.max(0, (oppAgg[k] | 0) - v * groups);
        }
    }
}

// Helper to expand a pool to an array of color entries (for potential future pre-roll steps)
export function buildDieRequestsFromPool(pool) {
    const out = [];
    for (const [color, count] of Object.entries(pool || {})) {
        const n = Math.max(0, count | 0);
        for (let i = 0; i < n; i++) out.push({ color });
    }
    return out;
}


