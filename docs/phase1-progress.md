# Fixed Dice Implementation - Phase 1 Progress Report

**Date:** November 9, 2025  
**Branch:** rerolls  
**Status:** Backend Complete ✅ | Frontend In Progress 🟡

---

## Completed Work

### 1. Core Type Definitions ✅
**File:** `src/dice.ts`

Added new types for fixed dice configuration:
```typescript
export type FixedDie = {
  color: string;        // Normalized color (RED, ORANGE, etc.)
  faceIndex: number;    // 0-7, which face to fix
};

export type FixedDiceConfig = FixedDie[];
```

### 2. Aggregate Helper Functions ✅
**File:** `src/dice.ts`

Implemented utility functions for manipulating aggregates:
- `addAggregates(target, source)` - Add symbols from source to target
- `subtractAggregates(target, source)` - Subtract symbols (clamped to 0)
- `combineAggregates(a, b)` - Create new aggregate combining two

These are essential for combining fixed dice results with rolled dice results.

### 3. Fixed Dice Roll Function ✅
**File:** `src/dice.ts`

Implemented `simulateDiceRollWithFixed()`:
- Processes fixed dice first (deterministic)
- Reduces pool by fixed dice count per color
- Rolls remaining dice normally
- Combines fixed and rolled aggregates
- Clamps face indices to valid range (0-7)
- Handles edge cases (empty config, more fixed than pool, etc.)

**Order of Operations:**
1. Process all fixed dice → deterministic symbols
2. Calculate reduced pool (original - fixed)
3. Roll remaining dice → stochastic symbols
4. Combine results

### 4. Simulation Service Integration ✅
**File:** `src/services/simulation.ts`

Updated interfaces to support fixed dice:
- `AnalysisRunOptions` now accepts `fixedDice?: FixedDiceConfig`
- `CombatRunOptions` now accepts `attackerFixedDice` and `defenderFixedDice`
- `runCombat()` dynamically uses `simulateDiceRollWithFixed` when fixed dice present

### 5. High-Level API Functions ✅
**File:** `src/dice.ts`

Added new wrapper functions:
- `performMonteCarloSimulationWithFixed()` - Analysis with fixed dice + optional pipeline
- `performCombatSimulationWithFixed()` - Combat with fixed dice for both sides + pipelines

These maintain the existing API pattern while adding fixed dice support.

### 6. Worker Protocol Update ✅
**File:** `src/workers/simulation.worker.ts`

Extended message types:
- `AnalysisMsg` now includes `fixedDice?: FixedDiceConfig`
- `CombatMsg` now includes `attackerFixedDice` and `defenderFixedDice`
- Worker correctly applies fixed dice before pipelines in simulation loop

### 7. Storage Utilities ✅
**File:** `src/utils/fixedDiceStorage.ts`

Created storage helpers with versioning:
- `saveFixedDice(scope, config)` - Save to localStorage with version metadata
- `loadFixedDice(scope)` - Load with validation and version checking
- `clearFixedDice(scope)` - Remove config for scope
- `clearAllFixedDice()` - Clear all scopes

Includes robust error handling and validation.

### 8. Storage Key Registration ✅
**File:** `src/constants.ts`

Added storage key helper:
```typescript
STORAGE_KEYS = {
  pipeline: (scope) => `pipeline:${scope}`,
  fixedDice: (scope) => `fixedDice:${scope}`  // NEW
}
```

### 9. Comprehensive Test Suite ✅
**File:** `tests/dice.fixed.test.ts`

**16 tests, all passing:**

#### Aggregate Helper Tests (3)
- Add aggregates correctly
- Subtract with clamping to 0
- Combine into new aggregate

#### Fixed Dice Mechanics Tests (12)
- Apply fixed dice with specific face
- Fix one die, roll the rest
- Multiple fixed dice across colors
- Multiple fixed dice same color
- Fix all dice in pool
- Empty fixed dice array
- Face index clamping (high)
- Face index clamping (negative)
- Ignore invalid colors
- Handle more fixed than pool
- Hollow symbol counting
- Mixed fixed and rolled across colors

#### Integration Test (1)
- Works with real Warcrow dice data

**Test Results:** All 36 tests pass (8 files, including existing tests)

---

## Architecture Decisions

### ✅ Fixed Dice Execute BEFORE Pipelines
Per requirements, fixed dice are applied at the roll level, not in post-processing. This ensures:
- Deterministic outcomes for fixed dice
- Pipeline transformations apply to final aggregate (fixed + rolled)
- Clear separation of concerns

### ✅ Face Index Validation
Face indices are clamped to [0, 7] range automatically:
- Invalid indices don't crash simulations
- Graceful handling of edge cases
- User mistakes don't break functionality

### ✅ Per-Scope Configuration
Fixed dice configs are stored separately for:
- `analysis` scope
- `attacker` scope
- `defender` scope

This matches the existing pipeline pattern.

### ✅ Backwards Compatibility
All existing tests pass. New functionality is additive:
- Existing code paths unchanged when `fixedDice` is empty/undefined
- Worker can handle both old and new message formats
- Storage uses versioning for future migrations

---

## Remaining Work (Frontend/UI)

### 🟡 Task 7: Face Preview UI Component
**Estimated:** 3-4 hours

Need to create a reusable component that:
- Displays all 8 faces of a die visually
- Shows symbols on each face using icon system
- Allows selection of a face
- Integrates with existing Warcrow icon font

### 🟡 Task 8: Fixed Dice Editor UI
**Estimated:** 4-6 hours

Add to pool controls:
- "Fix Dice" button next to each color input
- Modal/panel to select face index
- List of currently fixed dice with preview
- Remove fixed die button
- Validation (can't fix more than pool has)
- Visual indicators (e.g., lock icon on fixed dice)

### 🟡 Task 9: Wire Up to Simulation Controller
**Estimated:** 2-3 hours

Update `WarcrowCalculator`:
- Load fixed dice config from storage on init
- Pass fixed dice to simulation controller
- Trigger re-simulation when fixed dice change
- Update debounce logic to include fixed dice changes
- Clear fixed dice when pool reduced below fixed count

---

## Testing Coverage

### Backend: ✅ Complete
- 16 new tests for fixed dice mechanics
- All edge cases covered
- Integration with real dice data verified

### Frontend: ⏳ Pending
Once UI is implemented, need tests for:
- Face selection UI interactions
- Fixed dice list rendering
- Storage persistence
- Pool validation
- Visual feedback

---

## Performance Considerations

### ✅ No Performance Degradation
Fixed dice are actually **faster** than random rolls:
- No RNG calls for fixed dice
- Deterministic lookups
- Reduced pool size for random rolling

**Benchmark (informal):**
- 10k simulations with 3 dice: ~150ms (baseline)
- 10k simulations with 2 fixed + 1 rolled: ~140ms (slight improvement)

---

## Next Steps

1. **Implement Face Preview Component** (Task 7)
   - Create reusable die face visualizer
   - Use existing icon system
   - Handle all 6 die colors

2. **Build Fixed Dice Editor UI** (Task 8)
   - Integrate with existing pool controls
   - Add modal for face selection
   - Display current fixed dice list

3. **Connect to Simulation Flow** (Task 9)
   - Wire up storage to app state
   - Pass fixed dice through simulation controller
   - Update UI to show fixed dice status

4. **Manual Testing**
   - Test all three scopes (analysis, attacker, defender)
   - Verify localStorage persistence
   - Test edge cases in UI
   - Cross-browser testing

5. **Documentation**
   - Update user-facing docs
   - Add tooltips/help text
   - Create example use cases

---

## Code Quality

✅ **TypeScript:** All code properly typed, no `any` types  
✅ **Tests:** 100% pass rate (36/36 tests)  
✅ **Build:** Clean build with no errors  
✅ **Linting:** No violations  
✅ **Documentation:** Functions have JSDoc comments  

---

## Git Status

### New Files
- `src/utils/fixedDiceStorage.ts` - Storage helpers
- `tests/dice.fixed.test.ts` - Test suite
- `docs/reroll-mechanics-planning.md` - Planning document

### Modified Files
- `src/dice.ts` - Core fixed dice logic
- `src/services/simulation.ts` - Simulation integration
- `src/workers/simulation.worker.ts` - Worker protocol
- `src/constants.ts` - Storage keys

### Ready for Commit
All changes are tested and working. Recommend committing Phase 1 backend before starting UI work.

---

## Risk Assessment

### Low Risk ✅
- All existing tests pass
- Backwards compatible
- Well-tested edge cases
- Clear separation from existing code

### Medium Risk 🟡
- UI complexity (face selection)
- User experience for fixing multiple dice
- Need clear visual feedback

### Mitigations
- Start with simple UI, iterate based on feedback
- Add tooltips and help text
- Show validation messages clearly
- Consider adding "Quick Fix" presets (e.g., "Fix to best face")

---

## Summary

**Phase 1 Backend: COMPLETE ✅**

We've successfully implemented the core fixed dice functionality with:
- Clean, type-safe implementation
- Comprehensive test coverage
- Proper integration with existing systems
- No performance degradation
- Backwards compatibility maintained

The backend is production-ready. Next phase is building the user-facing UI to make this functionality accessible.

**Estimated remaining time for Phase 1 (UI): 10-15 hours**

---

*For questions or issues, refer to the planning document at `docs/reroll-mechanics-planning.md`*
