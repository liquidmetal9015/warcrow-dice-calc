# Warcrow Dice Reroll Mechanics: Implementation Plan

**Document Version:** 1.0  
**Date:** November 9, 2025  
**Status:** Planning Phase

---

## Executive Summary

This document outlines strategies for implementing **"fix"** (select specific die face) and **"repeat"** (reroll dice) mechanics in the Warcrow dice calculator. The core challenge is balancing simulation accuracy with user-friendly configuration in a probabilistic system where dice faces have varying symbol distributions without strictly "better" outcomes.

---

## 1. Problem Space Analysis

### 1.1 Current Architecture

The calculator uses Monte Carlo simulation with:
- **Core simulation loop**: `src/services/simulation.ts` (`runAnalysis`, `runCombat`)
- **Roll function**: `simulateDiceRoll()` rolls all dice in a pool once and aggregates symbols
- **Pipeline system**: Post-roll transformations (symbol switches, additions, elite promotions) via `Pipeline.applyPost()`
- **Worker-based execution**: Heavy simulations run in `src/workers/simulation.worker.ts` with deterministic RNG

### 1.2 Mechanic Types

#### Fix Dice
- **Definition**: Select a specific face (1-8) for a die instead of rolling
- **Complexity**: Medium – requires UI for face selection + simulation model for fixed outcomes
- **Use Cases**: "Choose face 3 on one Red die", "Fix two Yellow dice to faces 2 and 7"

#### Repeat Roll (Entire Pool)
- **Definition**: Reroll all dice if certain conditions are met
- **Complexity**: High – requires condition evaluation + decision logic
- **Use Cases**: "Reroll if total hits < 2", "Reroll if no specials"

#### Repeat Up To X Dice (Selective)
- **Definition**: Reroll a subset of dice (potentially across colors) up to a limit
- **Complexity**: Very High – optimal reroll selection depends on context and goals
- **Use Cases**: "Repeat up to 2 dice", "Reroll one Red and one Blue die"

---

## 2. Proposed Implementation Strategy

### 2.1 Phase 1: Fix Dice (Easiest - Start Here)

#### Backend Design

**New Type Definitions** (`src/dice.ts`):
```typescript
export type FixedDie = {
  color: string;
  faceIndex: number; // 0-7
};

export type FixedDiceConfig = FixedDie[];
```

**Modified Roll Function**:
Create `simulateDiceRollWithFixed()` that:
1. Processes fixed dice first (deterministic symbol aggregation)
2. Rolls remaining dice normally
3. Combines results

```typescript
export function simulateDiceRollWithFixed(
  pool: Pool,
  fixedDice: FixedDiceConfig,
  facesByColor: FacesByColor,
  rng: RNG = Math.random
): Aggregate {
  const agg = blankAggregate();
  
  // Process fixed dice
  for (const fixed of fixedDice) {
    const faces = facesByColor[normalizeColor(fixed.color)];
    if (!faces) continue;
    const face = faces[fixed.faceIndex];
    const symbols = countSymbolsFromFace(face);
    // Add to aggregate...
  }
  
  // Reduce pool counts by fixed dice
  const reducedPool = { ...pool };
  for (const fixed of fixedDice) {
    const color = normalizeColor(fixed.color);
    reducedPool[color] = Math.max(0, (reducedPool[color] || 0) - 1);
  }
  
  // Roll remaining dice normally
  const rolledAgg = simulateDiceRoll(reducedPool, facesByColor, rng);
  
  // Combine aggregates
  return combineAggregates(agg, rolledAgg);
}
```

**Pipeline Integration**:
- Could be a `FixDiceStep` in pipeline, but might be better as a **pre-roll configuration**
- Store fixed dice config alongside pool in UI state
- Pass to simulation layer separately from pipeline

#### Frontend Design

**UI Components**:
1. **Pool UI Enhancement**: Add "Fix" button next to each die color's input
   - Opens modal/dropdown showing die faces (visual preview)
   - User selects face index (show actual symbols on that face)
   - Displays list of currently fixed dice

2. **Face Preview Component**:
   ```
   [Red Die #1: Face 3]  [⚔️ ⚔️]  [Change] [Remove]
   [Orange Die #1: Face 7]  [⭕⚡]  [Change] [Remove]
   ```

3. **Storage Schema** (localStorage):
   ```typescript
   {
     "fixedDice:analysis": [
       { "color": "RED", "faceIndex": 2 },
       { "color": "YELLOW", "faceIndex": 5 }
     ],
     "fixedDice:attacker": [...],
     "fixedDice:defender": [...]
   }
   ```

**Validation**:
- Cannot fix more dice than available in pool
- Clear fixed dice when pool count drops below fixed count
- Show warning icon when fixed dice exceed pool

#### Testing Strategy
- Unit tests with deterministic faces (test fixture)
- Verify fixed dice produce expected aggregate
- Ensure remaining dice still randomize properly
- Test edge cases (fix all dice, fix zero dice)

---

### 2.2 Phase 2: Repeat Roll (Conditional Full Reroll)

#### Backend Design

**Condition Types**:
```typescript
export type RerollConditionType = 
  | 'minSymbolCount'  // "At least X of symbol Y"
  | 'maxSymbolCount'  // "At most X of symbol Y"
  | 'totalScore'      // Custom scoring function
  | 'symbolPresence'  // "Has at least one of symbol Y"
  | 'custom';         // Future: JavaScript expression

export type RerollCondition = {
  type: RerollConditionType;
  symbol?: keyof Aggregate;
  threshold?: number;
  operator?: 'lt' | 'lte' | 'gt' | 'gte' | 'eq';
  maxRerolls?: number; // Prevent infinite loops
};

export type RerollConfig = {
  conditions: RerollCondition[];
  logic: 'AND' | 'OR'; // How to combine multiple conditions
  maxAttempts: number; // Total reroll limit (default 1)
};
```

**Evaluation Function**:
```typescript
function shouldReroll(agg: Aggregate, config: RerollConfig, attempt: number): boolean {
  if (attempt >= config.maxAttempts) return false;
  
  const results = config.conditions.map(cond => evaluateCondition(agg, cond));
  
  return config.logic === 'AND' 
    ? results.every(r => r)
    : results.some(r => r);
}

function evaluateCondition(agg: Aggregate, cond: RerollCondition): boolean {
  if (cond.type === 'minSymbolCount' && cond.symbol) {
    const count = agg[cond.symbol] || 0;
    const threshold = cond.threshold || 0;
    return count < threshold; // Reroll if below minimum
  }
  // ... other condition types
  return false;
}
```

**Modified Simulation Loop**:
```typescript
export function simulateDiceRollWithReroll(
  pool: Pool,
  facesByColor: FacesByColor,
  rerollConfig: RerollConfig | null,
  rng: RNG = Math.random
): Aggregate {
  let agg = simulateDiceRoll(pool, facesByColor, rng);
  let attempts = 0;
  
  while (rerollConfig && shouldReroll(agg, rerollConfig, attempts)) {
    attempts++;
    agg = simulateDiceRoll(pool, facesByColor, rng);
  }
  
  return agg;
}
```

**Critical Consideration**: This significantly alters probability distributions. A "reroll if no hits" mechanic on 2 Red dice changes hit distribution dramatically:
- Without reroll: ~31% chance of 0 hits
- With reroll: 0.31 × 0.31 = ~9.6% chance of 0 hits

#### Frontend Design

**UI Flow**:
1. **"Add Reroll Condition" button** in analysis/combat tabs
2. **Condition Builder Modal**:
   ```
   [Reroll entire pool when:]
   
   Condition 1: [Hits ▼] is [less than ▼] [2]  [×]
   Condition 2: [Specials ▼] [equals ▼] [0]     [×]
   
   [+ Add Condition]
   
   Combine conditions: (•) All must be true  ( ) Any can be true
   
   Maximum reroll attempts: [1] (1-3 recommended)
   
   [Save] [Cancel]
   ```

3. **Visual Indicator**: Show reroll icon/badge on pool display

**Storage**:
```typescript
{
  "rerollConfig:analysis": {
    "conditions": [
      { "type": "minSymbolCount", "symbol": "hits", "threshold": 2 }
    ],
    "logic": "OR",
    "maxAttempts": 1
  }
}
```

#### Testing Strategy
- Test each condition type independently
- Verify probability distributions shift as expected
- Test max attempts limiter (prevent infinite loops)
- Performance test (rerolls can significantly increase computation)

**Performance Note**: Each reroll multiplies simulation work. Budget simulation count accordingly:
- 10,000 sims × avg 1.3 rerolls = 13,000 effective rolls
- May need worker progress updates for user feedback

---

### 2.3 Phase 3: Repeat Up To X Dice (Most Complex)

This is the trickiest feature due to **optimal reroll selection** complexity.

#### Strategy A: User-Specified Reroll Targets (Simplest)

**Approach**: Let users specify exactly which dice/faces to reroll.

**UI**:
```
Selective Reroll Configuration:

Pool Results Preview (example roll):
Red #1: [⚔️⚔️] (•) Keep  ( ) Reroll
Red #2: [⚔️]    (•) Keep  ( ) Reroll
Orange: [⭕⚡]   ( ) Keep  (•) Reroll

Reroll limit: [2] dice maximum

[Run Simulation with This Strategy]
```

**Backend**:
```typescript
export type SelectiveRerollStrategy = {
  targetFaces: Array<{
    color: string;
    faceIndex: number; // Which specific face outcome to reroll
  }>;
  maxRerolls: number;
};
```

**Problem**: This requires showing an "example roll" and having users specify strategy per outcome. Too complex for general simulation.

#### Strategy B: Heuristic-Based Reroll (Practical)

**Approach**: Define reroll priority heuristics that work across all rolls.

**UI**:
```
Selective Reroll (up to 2 dice):

Reroll Priority:
1. [Blanks (no symbols) ▼]
2. [Hollow-only results ▼]
3. [Lowest-value die ▼]

Goal optimization: (•) Maximize hits  ( ) Maximize specials  ( ) Balanced

[Save Strategy]
```

**Heuristic Types**:
```typescript
export type RerollHeuristic = 
  | 'blanks'           // Reroll dice that showed no symbols
  | 'hollowOnly'       // Reroll dice with only hollow symbols
  | 'lowestValue'      // Reroll dice with fewest symbols
  | 'offTarget'        // Reroll dice that didn't show target symbol
  | 'custom';          // Advanced: score each die
```

**Implementation**:
```typescript
export type SelectiveRerollConfig = {
  maxDice: number; // Up to X dice
  heuristics: RerollHeuristic[];
  targetSymbol?: keyof Aggregate; // For 'offTarget' heuristic
  maxAttempts: number; // How many times can you reroll (usually 1)
};

export function simulateDiceRollWithSelectiveReroll(
  pool: Pool,
  facesByColor: FacesByColor,
  config: SelectiveRerollConfig,
  rng: RNG = Math.random
): Aggregate {
  // First roll - need to track individual die results
  const { dice, aggregate } = simulateDiceRollDetailed(pool, facesByColor, rng);
  
  // Score each die based on heuristics
  const diceWithScores = dice.map((die, idx) => ({
    ...die,
    score: scoreDieResult(die, config)
  }));
  
  // Sort by score (lowest = highest reroll priority)
  diceWithScores.sort((a, b) => a.score - b.score);
  
  // Reroll worst N dice
  const toReroll = diceWithScores.slice(0, Math.min(config.maxDice, dice.length));
  
  // Remove their contributions from aggregate
  let newAggregate = { ...aggregate };
  for (const die of toReroll) {
    // Subtract old die's symbols
    subtractAggregates(newAggregate, die.symbols);
    
    // Roll new result
    const faces = facesByColor[die.color];
    const newFaceIdx = Math.floor(rng() * 8);
    const newFace = faces[newFaceIdx];
    const newSymbols = countSymbolsFromFace(newFace);
    
    // Add new symbols
    addAggregates(newAggregate, newSymbols);
  }
  
  return newAggregate;
}
```

**New Required Function**:
```typescript
type DieResult = {
  color: string;
  faceIndex: number;
  symbols: Aggregate;
};

type DetailedRollResult = {
  dice: DieResult[];
  aggregate: Aggregate;
};

export function simulateDiceRollDetailed(
  pool: Pool,
  facesByColor: FacesByColor,
  rng: RNG
): DetailedRollResult {
  const dice: DieResult[] = [];
  const aggregate = blankAggregate();
  
  for (const [color, count] of Object.entries(pool)) {
    const colorKey = normalizeColor(color);
    const faces = facesByColor[colorKey];
    if (!faces) continue;
    
    for (let i = 0; i < count; i++) {
      const faceIndex = Math.floor(rng() * 8);
      const face = faces[faceIndex];
      const symbols = countSymbolsFromFace(face);
      
      dice.push({ color: colorKey, faceIndex, symbols });
      
      // Accumulate into aggregate
      for (const key of Object.keys(symbols) as Array<keyof Aggregate>) {
        aggregate[key] += symbols[key];
      }
    }
  }
  
  return { dice, aggregate };
}
```

#### Strategy C: Probabilistic Optimal Reroll (Advanced)

**Approach**: For each die result, calculate expected value of keeping vs rerolling, then reroll worst N.

**Expected Value Calculation**:
```typescript
function getExpectedValueOfReroll(color: string, facesByColor: FacesByColor, weights: SymbolWeights): number {
  const faces = facesByColor[normalizeColor(color)];
  let totalValue = 0;
  
  for (const face of faces) {
    const symbols = countSymbolsFromFace(face);
    totalValue += scoreAggregate(symbols, weights);
  }
  
  return totalValue / faces.length; // Average across all faces
}

function scoreDieForReroll(die: DieResult, config: SelectiveRerollConfig, facesByColor: FacesByColor): number {
  const currentValue = scoreAggregate(die.symbols, config.weights);
  const expectedValue = getExpectedValueOfReroll(die.color, facesByColor, config.weights);
  
  return expectedValue - currentValue; // Positive = reroll beneficial
}
```

**Weights Configuration**:
```typescript
export type SymbolWeights = {
  hits: number;
  blocks: number;
  specials: number;
  hollowHits: number;
  hollowBlocks: number;
  hollowSpecials: number;
};
```

**UI**:
```
Selective Reroll (up to 2 dice):

Reroll Strategy: (•) Optimal (expected value)  ( ) Simple heuristic

Symbol Priorities:
- Hits:           [10] 
- Blocks:         [8]
- Specials:       [6]
- Hollow Hits:    [3]
- Hollow Blocks:  [2]
- Hollow Specials:[2]

Maximum rerolls per simulation: [1]

[Preview Impact] [Save]
```

**Pros**:
- Mathematically optimal for given weights
- Flexible for different unit priorities

**Cons**:
- Requires users to understand weighting
- More complex UI
- Higher computation cost

---

### 2.4 Architectural Integration

#### Worker Protocol Updates

**Message Types** (`src/workers/simulation.worker.ts`):
```typescript
type AnalysisMsg = {
  type: 'analysis';
  pool: Pool;
  facesByColor: FacesByColor;
  simulationCount: number;
  pipeline?: SerializedPipelineStep[];
  fixedDice?: FixedDiceConfig;         // NEW
  rerollConfig?: RerollConfig;         // NEW
  selectiveRerollConfig?: SelectiveRerollConfig; // NEW
};
```

#### Pipeline vs. Pre-Roll Configuration

**Decision**: Reroll mechanics should be **separate from pipelines** because:
- Pipelines transform aggregates **after** rolling
- Rerolls affect **the rolling process itself**
- Different lifecycle: pre-roll config vs. post-roll transformation

**Proposed Structure**:
```typescript
type SimulationConfig = {
  pool: Pool;
  fixedDice?: FixedDiceConfig;
  rerollConfig?: RerollConfig;
  selectiveRerollConfig?: SelectiveRerollConfig;
  pipeline?: Pipeline;
};
```

**Order of Operations** (CRITICAL):
1. **Fixed dice** applied first (deterministic)
2. **Remaining dice rolled** (stochastic)
3. **Evaluate reroll conditions** → reroll if needed
4. **Pipeline transformations** applied to final aggregate

**Important Constraints**:
- ⚠️ **Fix and reroll mechanics ALWAYS execute before pipeline steps**
- ⚠️ **A die can NEVER be rerolled more than once per simulation**
- ⚠️ **Fixed dice are not rolled and cannot be rerolled**
- This ensures deterministic behavior and prevents infinite reroll loops

---

## 3. Recommended Implementation Roadmap

### Milestone 1: Fix Dice (Weeks 1-2)
- ✅ Low risk, high value
- Implement `simulateDiceRollWithFixed()`
- Build face preview UI component
- Add fixed dice storage/serialization
- Update worker protocol
- Write tests

**Acceptance Criteria**:
- User can fix specific dice to specific faces
- Simulations correctly apply fixed dice
- UI shows which dice are fixed
- Fixed dice persist across sessions

### Milestone 2: Repeat Roll (Weeks 3-4)
- ✅ Medium complexity, clear use case
- Implement condition evaluation system
- Build condition builder UI
- Add reroll logic to simulation
- Update worker to handle rerolls
- Performance testing (handle simulation overhead)

**Acceptance Criteria**:
- User can define "reroll if" conditions
- Simulations correctly reroll entire pool when conditions met
- Probability distributions reflect reroll logic
- Performance remains acceptable (< 5s for 10k sims)

### Milestone 3A: Selective Reroll - Simple Heuristic (Weeks 5-6)
- ✅ Start with Strategy B (heuristic-based)
- Implement detailed roll tracking
- Add heuristic evaluation
- Build reroll strategy UI
- Test distribution impacts

**Acceptance Criteria**:
- User can configure "reroll up to N dice" with heuristics
- Heuristics correctly identify worst dice
- Simulations reflect selective reroll behavior

### Milestone 3B: Selective Reroll - Advanced (Weeks 7-8, Optional)
- ⚠️ Only if users need more control
- Implement expected-value optimization
- Add symbol weighting UI
- Add preview/comparison tools

---

## 4. Technical Challenges & Mitigations

### Challenge 1: Performance Degradation
**Issue**: Rerolls multiply simulation work. Selective rerolls require tracking individual dice.

**Mitigations**:
- Use worker threads (already implemented)
- Add progress indicators for long simulations
- Cache expected value calculations
- Optimize hot paths with typed arrays for die results
- Consider reducing default simulation count when rerolls enabled (10k → 5k)

### Challenge 2: UI Complexity
**Issue**: Configuring reroll strategies can be overwhelming.

**Mitigations**:
- Provide sensible defaults
- Add "Quick Config" presets: "Reroll blanks", "Optimize for hits", "Maximize specials"
- Show inline help/tooltips
- Progressive disclosure (advanced options collapsed)

### Challenge 3: Distribution Validation
**Issue**: Ensuring reroll logic produces correct probability distributions.

**Mitigations**:
- Comprehensive unit tests with known dice configs
- Manual calculation verification for simple cases
- Add "Debug Mode" that logs reroll decisions for sample runs
- Visual diff tool comparing distributions with/without rerolls

### Challenge 4: Storage Schema Evolution
**Issue**: Adding reroll configs to localStorage requires versioning.

**Mitigations**:
- Add schema version field to all stored configs
- Implement migration functions
- Graceful fallback if parsing fails (clear invalid state)

---

## 5. Alternative Approaches Considered

### Approach: Pre-Simulation Decision Trees
**Idea**: Generate all possible reroll outcomes as a tree, compute probabilities analytically.

**Pros**: Perfectly accurate, no Monte Carlo error
**Cons**: Combinatorial explosion (8 faces per die, N dice, M rerolls = 8^(N×M) branches)
**Verdict**: ❌ Impractical for pools > 2-3 dice

### Approach: Machine Learning for Optimal Rerolls
**Idea**: Train RL agent to maximize expected value.

**Pros**: Could discover non-obvious strategies
**Cons**: Requires training data, black-box decisions, overkill for simple dice
**Verdict**: ❌ Over-engineering for this use case

### Approach: Let Users Script Reroll Logic
**Idea**: JavaScript/Python expressions for custom conditions.

**Pros**: Maximum flexibility
**Cons**: Security risks, steep learning curve, hard to validate
**Verdict**: ⚠️ Maybe as "advanced" feature in future, but start with UI-based config

---

## 6. Open Questions for User Research

1. **Fix Dice**: Should fixed dice be per-simulation (user specifies fixed pool) or per-unit (unit always has face X)?
   
2. **Reroll Frequency**: How common are abilities with "reroll up to 2" vs. "reroll all"?

3. **Symbol Priorities**: For selective rerolls, do users need per-unit symbol weights, or are role-based defaults (attacker: prioritize hits, defender: prioritize blocks) sufficient?

4. **Multiple Reroll Phases**: Can a single unit have both "repeat roll" AND "repeat up to X dice"? Does order matter?

5. **Conditional Rerolls**: Are there cases where reroll ability depends on opponent's roll? (e.g., "reroll if opponent rolled more hits")

---

## 7. Success Metrics

- **Adoption**: 30%+ of users configure at least one reroll mechanic within first month
- **Performance**: Simulations with rerolls complete in < 5s for 10k iterations
- **Accuracy**: Distribution tests pass with < 1% error margin
- **Usability**: < 10% support requests related to reroll configuration

---

## 8. Appendix: Code Snippets

### A. Combining Aggregates
```typescript
function addAggregates(target: Aggregate, source: Aggregate): void {
  for (const key of Object.keys(source) as Array<keyof Aggregate>) {
    target[key] = (target[key] || 0) + (source[key] || 0);
  }
}

function subtractAggregates(target: Aggregate, source: Aggregate): void {
  for (const key of Object.keys(source) as Array<keyof Aggregate>) {
    target[key] = Math.max(0, (target[key] || 0) - (source[key] || 0));
  }
}

function combineAggregates(a: Aggregate, b: Aggregate): Aggregate {
  const result = blankAggregate();
  addAggregates(result, a);
  addAggregates(result, b);
  return result;
}
```

### B. Storage Helper
```typescript
const STORAGE_VERSION = '1.0';

function saveRerollConfig(scope: 'analysis'|'attacker'|'defender', config: RerollConfig): void {
  const key = `reroll:${scope}`;
  localStorage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, config }));
}

function loadRerollConfig(scope: 'analysis'|'attacker'|'defender'): RerollConfig | null {
  const key = `reroll:${scope}`;
  const data = localStorage.getItem(key);
  if (!data) return null;
  
  try {
    const parsed = JSON.parse(data);
    if (parsed.version !== STORAGE_VERSION) {
      console.warn('Reroll config version mismatch, clearing');
      localStorage.removeItem(key);
      return null;
    }
    return parsed.config;
  } catch (e) {
    console.error('Failed to parse reroll config', e);
    return null;
  }
}
```

---

## 9. Conclusion

The recommended approach is to implement these features in **three phases**:

1. **Fix Dice** (simplest, immediate value)
2. **Repeat Roll** (conditional full reroll, clear semantics)
3. **Selective Reroll with Heuristics** (complex, start with simple heuristics)

For **Selective Reroll**, prioritize **Strategy B (heuristic-based)** over Strategy C (optimal EV) initially. Users can specify reroll priorities without needing to understand weighting systems. If user feedback indicates need for more control, then implement expected-value optimization as an "Advanced" toggle.

The key architectural insight is to **separate reroll mechanics from the pipeline system** since they operate at different stages (pre-roll vs. post-roll). This keeps the code modular and prevents entanglement between rolling logic and transformation logic.

Performance must be closely monitored, especially for selective rerolls which require tracking individual die results. The existing worker architecture provides a solid foundation, but progress indicators and simulation count adjustments may be necessary.

---

**Next Steps:**
1. Review this plan with stakeholders
2. Create GitHub issues for Milestones 1-3
3. Set up feature branch: `feature/reroll-mechanics`
4. Begin with Fix Dice implementation
