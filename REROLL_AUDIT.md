# Reroll Functionality Audit Report

## Executive Summary

**Audit Date**: November 9, 2025  
**Status**: ✅ **PASSED** - Bug found and fixed, all tests passing

---

## Audit Questions & Answers

### 1. Does repeat roll only allow one full reroll?

**✅ YES** - Confirmed correct behavior

- **Code Location**: `src/dice.ts` lines 518-523
- When the condition is met, `simulateDiceRollDetailed` is called exactly once to reroll the entire pool
- No loops or additional reroll logic present

### 2. Is the reroll decision based on current result vs expected outcome?

**✅ YES** - Confirmed correct behavior

- **Code Location**: `src/dice.ts` lines 304-325
- `shouldRerollAggregate` function:
  - Calculates expected value for the pool composition
  - Compares actual aggregate result to expected value
  - Returns `true` if `actual < expected`

### 3. Are selective rerolls choosing dice with the greatest difference from expected?

**✅ YES** - Confirmed correct behavior

- **Code Location**: `src/dice.ts` lines 398-438
- `scoreDie` function (lines 398-416):
  - Calculates weighted actual value for the die
  - Subtracts expected value for that color
  - Negative score = underperformed
- `selectDiceToReroll` function (lines 421-438):
  - Scores all dice
  - Sorts ascending (most negative first = worst performers)
  - Returns indices of N worst dice

**Key Feature**: Color-aware scoring ensures a red die with 0 hits (far below its high expected value) is prioritized over a yellow die with 0 hits (closer to its low expected value).

---

## Critical Bug Found & Fixed

### The Bug

When **both** repeat roll and repeat dice were enabled, the code performed an extra roll that threw away the full reroll result:

```typescript
// BUGGY CODE (before fix)
if (repeatRollConfig?.enabled) {
    agg = simulateDiceRoll(pool, facesByColor, rng);  // Roll 1: Initial
    if (shouldRerollAggregate(...)) {
      agg = simulateDiceRoll(pool, facesByColor, rng); // Roll 2: Full reroll
    }
    
    if (repeatDiceConfig?.enabled) {
      const result = simulateDiceRollDetailed(pool, facesByColor, rng);  // Roll 3: BUG!
      dice = result.dice;
      agg = result.aggregate;  // Overwrites result from Roll 2
    }
}
```

**Impact**: The full reroll result was discarded, and a brand new roll was used instead.

### The Fix

Restructured the logic to use detailed tracking from the start when repeat dice is enabled:

```typescript
// FIXED CODE
if (needsDetailed) {
    // Phase 1: Initial roll with detailed tracking
    let result = simulateDiceRollDetailed(pool, facesByColor, rng);
    
    // Phase 2: Full reroll if condition met (still detailed)
    if (repeatRollConfig?.enabled && shouldRerollAggregate(...)) {
      result = simulateDiceRollDetailed(pool, facesByColor, rng);
    }
    
    // Phase 3: Selective rerolls on the dice from Phase 2
    const toReroll = selectDiceToReroll(result.dice, ...);
    // ... reroll selected dice
}
```

**Result**: Correct sequence of 3 rolls instead of 4 when both rerolls are enabled.

---

## Test Coverage

### New Test Suite: `tests/reroll.test.ts`

**13 comprehensive tests covering:**

1. **Expected value calculations**
   - Single die expectations
   - Multi-die pool expectations

2. **Reroll condition logic**
   - Below expected (BelowExpected)
   - Zero symbol (NoSymbol)
   - Custom threshold (MinSymbol)

3. **Die scoring**
   - Underperforming dice get negative scores
   - Color-aware prioritization (red vs yellow)

4. **Dice selection**
   - Selects worst performers
   - Respects max dice limit

5. **Full reroll behavior**
   - Rerolls exactly once when condition met
   - Does not reroll when condition not met

6. **Selective reroll behavior**
   - Rerolls worst-performing dice
   - Respects dice limit

7. **Combined rerolls (the bug test)**
   - Applies both sequentially
   - Correct roll count (3 not 4)

### Test Results

```bash
✓ tests/reroll.test.ts (13 tests) 5ms
✓ All other tests (20 tests) 160ms

Test Files  8 passed (8)
Tests  33 passed (33)
```

---

## Implementation Verification

### Repeat Roll (Full Reroll)

| Requirement | Status | Evidence |
|------------|--------|----------|
| Only rerolls once | ✅ | No loops in reroll logic |
| Uses expected value | ✅ | `computePoolExpectedValue` function |
| Compares actual vs expected | ✅ | `shouldRerollAggregate` returns `actual < expected` |
| Condition-based | ✅ | Multiple condition types supported |

### Repeat Dice (Selective Reroll)

| Requirement | Status | Evidence |
|------------|--------|----------|
| Selects worst performers | ✅ | Sorts by score ascending |
| Color-aware | ✅ | Expected values calculated per color |
| Respects max dice limit | ✅ | `Math.min(maxRerolls, dice.length)` |
| Each die rerolled once max | ✅ | Loop iterates through `toReroll` indices once |

### Sequential Reroll Order

| Phase | Expected Behavior | Status |
|-------|------------------|--------|
| 1. Initial roll | Roll with or without detailed tracking | ✅ |
| 2. Full reroll | If condition met, reroll entire pool once | ✅ |
| 3. Selective reroll | Reroll up to X worst dice | ✅ |

---

## Recommendations

### ✅ Completed

1. ✅ Comprehensive test suite created
2. ✅ Critical bug found and fixed
3. ✅ All tests passing
4. ✅ Build successful

### Future Enhancements (Optional)

1. **Performance Tests**: Add tests for large dice pools (10+ dice) to ensure performance
2. **Edge Cases**: Add tests for:
   - Empty pools
   - All dice performing perfectly (no rerolls needed)
   - All dice performing terribly (all need reroll)
3. **Monte Carlo Validation**: Add integration test that runs 10,000 simulations with rerolls and validates statistical properties

---

## Conclusion

The reroll implementation is **working correctly** with the exception of one critical bug that has been fixed. The logic correctly:

1. ✅ Limits full rerolls to once
2. ✅ Makes decisions based on actual vs expected values
3. ✅ Prioritizes dice with the greatest negative difference from expected
4. ✅ Is color-aware (red die with 0 hits prioritized over yellow die with 0 hits)
5. ✅ Applies rerolls in the correct sequential order

All tests pass (33/33) and the build is successful.

