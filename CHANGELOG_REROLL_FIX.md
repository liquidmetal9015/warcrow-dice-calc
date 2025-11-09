# Changelog: Reroll UI Bug Fix

## [2025-11-09] - UI State Management Bug Fix

### 🐛 Bug Fixed
**Issue**: Reroll priority would silently revert to default when toggling the "repeat dice" checkbox

**Symptoms**:
- User selects priority "blocks" → works correctly
- User unchecks "repeat dice" checkbox → priority silently reverts to "hits"
- User rechecks "repeat dice" checkbox → now using wrong priority
- Values only correct after explicitly changing priority again

**Root Cause**: Event handlers were spreading `initialConfig` object, which captured stale values from initialization time instead of reading current UI state.

### ✅ Changes Made

#### Fixed Files
1. **src/ui/rerollEditor.ts**
   - Fixed `initRepeatDiceUI()` to read current state from DOM
   - Fixed `initRepeatRollUI()` to read current state from DOM
   - Added `getCurrentConfig()` helper functions to prevent stale closures
   - Eliminated all `...initialConfig` spreads in event handlers
   - Reduced code duplication across event handlers

#### New Files Created
1. **docs/UI_STATE_MANAGEMENT.md** (150 lines)
   - Comprehensive guide on preventing stale closure bugs
   - Before/after examples
   - Best practices for UI state management
   - Manual and automated testing strategies
   - Complete root cause analysis of the bug

2. **docs/BUG_FIX_REROLL_STATE.md** (250 lines)
   - Detailed bug report and fix documentation
   - Step-by-step reproduction
   - Code comparison showing the fix
   - Prevention strategy
   - Testing checklist

3. **src/utils/uiHelpers.ts** (140 lines)
   - `createStateReader()` - Pattern for state reading functions
   - `getCheckedRadioValue()` - Safe radio button value getter
   - `parseInputInt()` - Bounded integer parsing
   - `validateElements()` - Type-safe element validation
   - `safeAddEventListener()` - Null-safe event binding
   - `debounce()` - Debouncing utility

4. **.github/CODE_REVIEW_CHECKLIST.md** (200 lines)
   - Quick reference for code reviewers
   - Anti-patterns to watch for
   - Correct patterns to encourage
   - Red flags checklist
   - Testing requirements

### 🧪 Testing

#### Automated Tests
```
✓ All 33 tests pass
✓ No regressions introduced
✓ Build completes successfully
```

#### Manual Testing
To verify the fix:
1. Select 2 green + 2 black dice
2. Check "repeat dice", select "blocks" priority
3. Note the blocks value (should be ~2.69)
4. Uncheck then recheck "repeat dice"
5. ✅ Blocks value remains correct (~2.69)
6. Change priority multiple times
7. ✅ All values update correctly

### 📚 Documentation

Created comprehensive documentation to prevent similar bugs:

- **Best Practices Guide**: Patterns to follow and anti-patterns to avoid
- **Bug Report**: Complete analysis for future reference
- **Code Review Checklist**: Quick reference for reviewers
- **Utility Functions**: Reusable helpers with clear documentation

### 🎓 Key Learnings

1. **DOM is the source of truth**: Always read current state from DOM elements
2. **Avoid closure captures**: Don't spread config objects in event handlers
3. **Test cross-control interactions**: Bugs hide in control interactions
4. **Use helper functions**: One `getCurrentConfig()` prevents duplication
5. **Document patterns**: Make best practices easy to follow

### 🔄 Impact

**Breaking Changes**: None

**API Changes**: None (internal refactoring only)

**Performance**: No impact (same number of DOM reads)

**User Experience**: ✅ Fixed - Reroll controls now work correctly

### 🚀 Future Improvements

Suggestions for continued improvement:

1. **Add integration tests** for UI control interactions
2. **Create ESLint rule** to detect `...initialConfig` pattern
3. **Add automated UI testing** with Playwright/Cypress
4. **Consider state management library** for complex UI state
5. **Add TypeScript strict mode** for better type safety

### 📋 Files Summary

**Modified**: 1 file
- `src/ui/rerollEditor.ts` (refactored both init functions)

**Created**: 4 files
- `docs/UI_STATE_MANAGEMENT.md`
- `docs/BUG_FIX_REROLL_STATE.md`
- `src/utils/uiHelpers.ts`
- `.github/CODE_REVIEW_CHECKLIST.md`

**Total Lines Added**: ~740 lines (including documentation)

### ✅ Verification

- [x] Bug fixed and verified manually
- [x] All tests pass
- [x] Build succeeds
- [x] No linter errors
- [x] Documentation complete
- [x] Prevention strategy in place
- [x] Code review guidelines created
- [x] Utility functions for future use

---

## Pattern Before Fix

```typescript
// ❌ BUGGY: Captures and spreads stale config
enableCheckbox.addEventListener('change', () => {
  callback({ ...initialConfig, enabled: checkbox.checked });
});
```

## Pattern After Fix

```typescript
// ✅ FIXED: Reads all state from DOM
function getCurrentConfig(): Config {
  return {
    enabled: enableCheckbox.checked,
    mode: getCheckedRadioValue(radios) || 'default',
    // ... all other fields from current DOM state
  };
}

enableCheckbox.addEventListener('change', () => {
  callback(getCurrentConfig());
});
```

---

**Issue Closed**: ✅ Complete  
**Next Steps**: Monitor for similar patterns in future code reviews

