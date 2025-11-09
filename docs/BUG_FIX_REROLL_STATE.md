# Bug Fix: Reroll UI State Management

## Issue Summary

**Date**: November 9, 2025  
**Component**: Reroll UI Controls (`src/ui/rerollEditor.ts`)  
**Severity**: Medium - User-facing bug causing incorrect calculations  
**Status**: ✅ Fixed

## Problem Description

When using the repeat dice functionality:
1. User selects 2 green dice + 2 black dice → avg 2.26 blocks
2. User checks "repeat dice" and selects priority "blocks" → avg 2.69 blocks ✓
3. User unchecks the "repeat dice" checkbox → **BUG: priority silently reverts to "hits"**
4. User rechecks the "repeat dice" checkbox → avg 1.79 blocks ✗ (wrong!)
5. User switches priority to hits then back to blocks → avg 2.69 blocks ✓ (works again)

Additionally, on page load, no priority radio button was selected initially.

## Root Cause

The event handlers in `initRepeatDiceUI` and `initRepeatRollUI` were capturing and spreading `initialConfig`, which contained stale values from when the function was first called.

### Example of the Bug

```typescript
function initRepeatDiceUI(initialConfig: RepeatDiceConfig, ...) {
  // initialConfig.priorityMode = 'hits' (initial value)
  
  enableCheckbox.addEventListener('change', () => {
    callback({ 
      ...initialConfig,  // ❌ BUG: Spreads stale config!
      enabled: checkbox.checked 
    });
  });
  
  // User changes priority to 'blocks' → works
  // User toggles checkbox → spreads initialConfig → reverts to 'hits'!
}
```

### Why It Happened

JavaScript closures capture variables by reference. When `initialConfig` was spread in the event handler, it contained the values from initialization time, not the current UI state. This caused the following sequence:

1. **Initialization**: `initialConfig = { priorityMode: 'hits', ... }`
2. **User changes priority**: Direct radio button handler works correctly
3. **User toggles checkbox**: Handler spreads `initialConfig`, overwriting `priorityMode` back to 'hits'
4. **Subsequent actions**: All use the reverted value until priority is explicitly changed again

## The Fix

### Strategy: Always Read Current State from DOM

Instead of relying on captured config objects, all event handlers now read the current state directly from DOM elements.

#### Before (Buggy):
```typescript
enableCheckbox.addEventListener('change', () => {
  callback({ 
    ...initialConfig,  // ❌ Stale data
    enabled: enableCheckbox.checked 
  });
});

priorityRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    callback({ 
      ...initialConfig,  // ❌ Stale data
      priorityMode: radio.value 
    });
  });
});
```

#### After (Fixed):
```typescript
// Helper function reads ALL state from DOM
function getCurrentConfig(): RepeatDiceConfig {
  const checkedRadio = Array.from(priorityRadios).find(r => r.checked);
  return {
    enabled: enableCheckbox.checked,
    maxDiceToReroll: parseInt(maxDiceInput.value || '2', 10),
    priorityMode: checkedRadio?.value as RepeatDiceConfig['priorityMode'] || 'hits',
    countHollowAsFilled: hollowCheckbox?.checked || false
  };
}

// All handlers use the same helper
enableCheckbox.addEventListener('change', () => {
  callback(getCurrentConfig());  // ✅ Always fresh
});

priorityRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.checked) {
      callback(getCurrentConfig());  // ✅ Always fresh
    }
  });
});
```

### Benefits of This Approach

1. **Single Source of Truth**: DOM elements are the authoritative state
2. **No Stale Data**: Every callback reads current values
3. **Less Duplication**: One helper function instead of repeated logic
4. **Easier to Maintain**: Changes to config structure only need updating in one place
5. **Clearer Intent**: `getCurrentConfig()` clearly communicates what's happening

## Files Changed

### Modified Files
- `src/ui/rerollEditor.ts` - Fixed both `initRepeatRollUI` and `initRepeatDiceUI`

### New Files Created
- `docs/UI_STATE_MANAGEMENT.md` - Best practices guide
- `docs/BUG_FIX_REROLL_STATE.md` - This document
- `src/utils/uiHelpers.ts` - Utility functions to prevent similar bugs

## Testing

### Automated Tests
All existing tests continue to pass:
```
✓ tests/reroll.test.ts (13 tests)
✓ tests/simulations.test.ts (2 tests)
✓ All other test suites (33 tests total)
```

### Manual Testing Checklist

To verify the fix:
- [ ] Set 2 green + 2 black dice
- [ ] Check "repeat dice", select "blocks" priority
- [ ] Note the average blocks value
- [ ] Uncheck "repeat dice"
- [ ] Recheck "repeat dice"
- [ ] **Verify**: Blocks value is still correct (should match step 3)
- [ ] Change priority to hits, then back to blocks
- [ ] **Verify**: Value updates correctly

## Prevention Strategy

To prevent similar bugs in the future:

### 1. Code Review Checklist
- [ ] Event handlers don't spread captured config objects
- [ ] Event handlers read state from DOM or state management
- [ ] `initialConfig` is only used to set initial DOM state
- [ ] Helper functions exist to read current state

### 2. Development Guidelines
- Use `getCurrentConfig()` pattern for all form state
- Never use `...initialConfig` in event handlers
- Document the source of truth for each piece of state
- Prefer explicit state reading over closure captures

### 3. Testing Guidelines
When testing UI controls:
1. Change control A
2. Verify it works
3. Change control B
4. **Critical**: Verify control A's value is still correct
5. Change control A again
6. Verify it still works

### 4. Utility Functions
Created reusable utilities in `src/utils/uiHelpers.ts`:
- `getCheckedRadioValue()` - Safely get checked radio value
- `parseInputInt()` - Parse input with bounds checking
- `createStateReader()` - Document state reading pattern
- `validateElements()` - Type-safe element validation

### 5. Documentation
- `docs/UI_STATE_MANAGEMENT.md` contains detailed guidelines
- Includes anti-patterns and recommended patterns
- Examples from this bug for reference

## Lessons Learned

1. **Closures are powerful but dangerous**: Variables captured in closures don't automatically update
2. **Test cross-control interactions**: Bugs often hide in interactions between controls
3. **Be explicit about state sources**: Document where each piece of state comes from
4. **Helper functions prevent duplication**: One `getCurrentConfig()` is better than five inline versions
5. **The initial value can be a trap**: Just because it works initially doesn't mean it's correct

## Related Issues

None found in current codebase. The pattern has been eliminated from all UI initialization functions.

## References

- MDN: [Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures)
- MDN: [EventTarget.addEventListener()](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener)
- Internal: `docs/UI_STATE_MANAGEMENT.md`
- Internal: `src/utils/uiHelpers.ts`

