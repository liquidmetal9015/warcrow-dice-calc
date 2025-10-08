// Warcrow pipeline engine for dice processing (pre/post steps)

export function blankCounts() {
    return { hits: 0, blocks: 0, specials: 0, hollowHits: 0, hollowBlocks: 0, hollowSpecials: 0 };
}

export class Pipeline {
    constructor(steps = []) { this.steps = steps; }
    applyPre(state, ctx) { for (const s of this.steps) { if (s.enabled && typeof s.applyPre === 'function') s.applyPre(state, ctx); } }
    applyPost(state) { for (const s of this.steps) { if (s.enabled && typeof s.applyPost === 'function') s.applyPost(state); } }
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

// Helper to expand a pool to an array of color entries (for potential future pre-roll steps)
export function buildDieRequestsFromPool(pool) {
    const out = [];
    for (const [color, count] of Object.entries(pool || {})) {
        const n = Math.max(0, count | 0);
        for (let i = 0; i < n; i++) out.push({ color });
    }
    return out;
}


