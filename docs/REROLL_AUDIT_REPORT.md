# Dice Reroll Functionality Audit Report

**Date**: November 9, 2025  
**Requested By**: User  
**Conducted By**: AI Code Assistant  
**Status**: ✅ Complete

## Executive Summary

A comprehensive audit of the dice rerolling functionality was conducted in response to user reports of rerolls not increasing average hit counts as expected. The audit revealed that **the reroll logic is functioning correctly** and does increase average hits significantly (40%+ improvement in test scenarios).

## Key Findings

### ✅ Core Functionality is Working Correctly

The reroll logic was thoroughly tested and confirmed to be working as designed:

- **Selective Dice Rerolls**: Increases average hits by **40.5%** (from 2.171 to 3.050 avg hits)
- **Full Pool Rerolls**: Increases average hits by **29.6%** (from 1.387 to 1.797 avg hits)
- **Dice Selection**: Correctly identifies and rerolls worst-performing dice
- **Statistics Tracking**: Now accurately counts rerolls performed

### 🔧 Improvements Made

1. **Reroll Statistics Tracking**
   - Added `RerollStats` type to track:
     - Full rerolls occurred
     - Individual dice rerolled count
     - Total rolls executed
   - Integrated into `MonteCarloResults`

2. **Console Debugging Output**
   - Logs when full rerolls trigger
   - Logs selective reroll details (dice indices, priority mode)
   - Summary statistics after each simulation

3. **UI Display Enhancements**
   - New "Reroll Statistics" section in results panel
   - Shows:
     - Full reroll count and rate
     - Total dice rerolled
     - Average dice rerolled per roll
   - **Warning indicator** when rerolls are enabled but none occur

4. **Enhanced Test Coverage**
   - Added Monte Carlo verification tests
   - Confirmed rerolls increase average results
   - All 15 reroll tests pass

## Technical Details

### Modified Files

1. **`src/types/reroll.ts`**
   - Added `RerollStats` type

2. **`src/dice.ts`**
   - Updated `simulateDiceRollWithRerolls` to return `{aggregate, stats}`
   - Added console logging for debugging
   - Updated `MonteCarloResults` type

3. **`src/services/simulation.ts`**
   - Aggregates reroll statistics across all simulation runs
   - Outputs summary statistics to console
   - Properly handles new return type from reroll function

4. **`src/app.ts`**
   - Displays reroll statistics in UI results panel
   - Shows warning if rerolls enabled but not occurring

5. **`tests/reroll.test.ts`**
   - Updated all tests for new return type
   - Added comprehensive Monte Carlo tests proving effectiveness

### How to Use the Debugging Features

#### Console Output

When running simulations with rerolls enabled, you'll see:

```javascript
[REROLL] Selective reroll {
  diceCount: 2,
  maxAllowed: 2,
  priorityMode: 'hits',
  diceToReroll: [ 1, 3 ]
}

[REROLL STATS] {
  totalSimulations: 10000,
  fullRerolls: 0,
  avgFullRerollsPerRoll: '0.000',
  totalDiceRerolled: 20000,
  avgDiceRerolledPerRoll: '2.000',
  fullRerollEnabled: false,
  diceRerollEnabled: true
}
```

#### UI Display

The results panel now shows a "🎲 Reroll Statistics" section with:
- Full reroll count/rate (if applicable)
- Total dice rerolled
- Average dice rerolled per roll
- ⚠️ Warning if no rerolls occurred despite being enabled

## Potential Causes of User's Issue

Since the core logic is confirmed working, the issue you're experiencing could be:

### 1. Configuration Not Being Applied
- **Check**: Open browser console and look for `[REROLL STATS]` output
- **Expected**: Should see statistics showing rerolls occurring
- **If missing**: Configuration may not be reaching the simulation

### 2. Priority Mode Mismatch
- **Issue**: Rerolling for "blocks" when dice can't produce blocks
- **Solution**: Verify priority mode matches the dice colors in pool
- **Example**: Yellow dice prioritizing hits but pool is mostly defense dice

### 3. UI State Bug
- **Issue**: UI checkbox state not syncing with actual config
- **Solution**: Check browser console for the actual config being used
- **Note**: Previous UI state bug was fixed (see `docs/BUG_FIX_REROLL_STATE.md`)

### 4. Cached Results
- **Issue**: Old simulation results being displayed
- **Solution**: Clear cache or force full page reload
- **Check**: Look at the timestamp on results

## Verification Steps

To verify rerolls are working in your app:

1. **Open browser developer console** (F12)
2. **Select a dice pool** (e.g., 3 Red + 2 Yellow)
3. **Note the baseline** average hits without rerolls
4. **Enable "Repeat Dice"** with priority "hits"
5. **Run simulation** and check console for:
   - `[REROLL] Selective reroll` messages
   - `[REROLL STATS]` summary
6. **Check UI** for "Reroll Statistics" section
7. **Compare averages** - should increase significantly

### Expected Console Output Example

```
[REROLL] Selective reroll { diceCount: 2, maxAllowed: 2, priorityMode: 'hits', diceToReroll: [ 0, 3 ] }
[REROLL] Selective reroll { diceCount: 2, maxAllowed: 2, priorityMode: 'hits', diceToReroll: [ 1, 2 ] }
... (many more) ...
[REROLL STATS] {
  totalSimulations: 10000,
  totalDiceRerolled: 20000,
  avgDiceRerolledPerRoll: '2.000',
  diceRerollEnabled: true
}
```

### If You See No Console Output

This indicates the reroll configuration is not being passed to the simulation. Possible causes:
- Checkbox UI state not syncing with internal config
- Config being overwritten somewhere in the call chain
- Wrong tab selected (Analysis vs Combat)

## Recommendations

### For Users Experiencing Issues

1. **Check the console output** - this is the definitive source of truth
2. **Look for the "⚠️ No rerolls occurred!" warning** in the UI
3. **Verify the priority mode** matches your dice colors
4. **Try different reroll settings** to isolate the issue
5. **Clear browser cache** and reload

### For Developers

1. **Console logs are your friend** - they show exactly what's happening
2. **Reroll stats in UI** provide user-visible confirmation
3. **Test with various dice pools** to ensure all scenarios work
4. **Monitor the config objects** being passed to simulation

## Test Results

All 15 tests pass, including:

✅ `computePoolExpectedValue` - Correctly calculates expected values  
✅ `shouldRerollAggregate` - Triggers rerolls appropriately  
✅ `scoreDie` - Scores dice correctly relative to expectations  
✅ `selectDiceToReroll` - Selects worst-performing dice  
✅ `simulateDiceRollWithRerolls` - Performs rerolls correctly  
✅ **`rerolling increases average hits (Monte Carlo)`** - **40.5% improvement**  
✅ **`rerolling with full reroll also increases average hits`** - **29.6% improvement**

## Conclusion

The dice reroll functionality is **working correctly** at the core logic level. The significant improvements shown in testing (40%+ for selective rerolls) confirm that the algorithm is effective.

If you're still experiencing issues where enabling rerolls doesn't increase averages:

1. **First step**: Check browser console for `[REROLL STATS]` output
2. **If present**: Rerolls are occurring - issue may be with specific dice/mode combination
3. **If absent**: Configuration not reaching simulation - UI binding issue

The new debugging tools (console logs + UI statistics) should make it easy to diagnose exactly what's happening in any given scenario.

## Files Modified in This Audit

- `src/types/reroll.ts` - Added RerollStats type
- `src/dice.ts` - Return stats from reroll function, add logging
- `src/services/simulation.ts` - Aggregate and display reroll stats
- `src/app.ts` - Display reroll stats in UI
- `tests/reroll.test.ts` - Update tests and add Monte Carlo verification

## Next Steps

1. Run your specific scenario and check console output
2. Share console logs if issue persists
3. Verify UI configuration matches what you expect
4. Check for any browser console errors

---

**End of Report**

