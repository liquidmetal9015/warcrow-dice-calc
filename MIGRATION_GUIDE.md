# Migration Guide - Monolithic to Modular Architecture

## Overview

This guide explains what changed in the major refactoring and how to work with the new architecture.

## What Changed

### Before: Monolithic Architecture
```
src/app.ts (1338 lines)
  └─ WarcrowCalculator class
     ├─ All tab logic mixed together
     ├─ State management scattered throughout
     ├─ Chart management embedded
     ├─ Storage operations everywhere
     └─ No separation of concerns
```

### After: Modular Architecture
```
src/
├── app.ts (18 lines) - Entry point
├── core/
│   └── AppController.ts - Tab routing
├── services/ - Shared utilities
│   ├── StorageService.ts
│   ├── ChartService.ts
│   ├── IconService.ts
│   └── DiceData.ts
└── tabs/ - Independent modules
    ├── analysis/
    ├── combat/
    ├── explorer/
    └── faces/
```

## Breaking Changes

### None for Users
✅ All functionality works exactly the same
✅ No UI changes
✅ No data migration needed
✅ localStorage structure unchanged

### For Developers

#### 1. **WarcrowCalculator Class No Longer Exists**

**Before:**
```typescript
const calc = new WarcrowCalculator();
calc.switchTab('analysis');
```

**After:**
```typescript
const app = new AppController();
await app.init();
app.switchTab('analysis');
```

#### 2. **Tab Access Changes**

**Before:**
```typescript
// Direct access to monolithic class
calc.analysisPool
calc.attackerPool
```

**After:**
```typescript
// Access through tab controllers
const analysisTab = app.getTab('analysis');
// Tab state is encapsulated
```

#### 3. **Services Are Now Injected**

**Before:**
```typescript
// Everything was in one class
this.facesByColor
this.activeCharts
```

**After:**
```typescript
// Access through services
services.diceData.getFaces();
services.charts.ensureChart(...);
```

## New Patterns

### 1. Tab Controllers

Each tab now has its own controller:

```typescript
import { AnalysisTab } from './tabs/analysis/AnalysisTab';

const container = document.getElementById('analysis-tab');
const tab = new AnalysisTab(container, services);
await tab.initialize();
tab.activate();
```

### 2. State Management

State is now observable:

```typescript
// Subscribe to state changes
const unsubscribe = state.subscribe((newState) => {
  console.log('State changed:', newState);
});

// Update state
state.setDiceCount('Red', 5);

// Cleanup
unsubscribe();
```

### 3. Service Usage

Services are stateless and injectable:

```typescript
// Storage
storageService.save('key', data);
const data = storageService.load('key');

// Charts
chartService.ensureChart('id', 'bar', data, options);

// Icons
iconService.renderIcon('HIT', '⚔️');

// Dice Data
await diceData.load();
const faces = diceData.getFaces();
```

## What Stayed the Same

### User Experience
- All four tabs work identically
- All simulations produce same results
- All UI interactions unchanged
- All keyboard shortcuts (if any) work

### Data Structures
- Pipeline configurations
- Reroll configurations
- localStorage keys and formats
- Simulation algorithms
- Dice face definitions

### External Dependencies
- Chart.js usage
- Plotly usage
- Custom font loading
- Worker implementation

## How to Work with New Code

### Adding Features to a Tab

1. **Identify the tab** (analysis, combat, explorer, or faces)
2. **Update the state** class to add new data
3. **Update the UI** class to render new data
4. **Update the controller** to handle interactions

Example - Adding a feature to Analysis:

```typescript
// 1. Add to AnalysisState.ts
export interface AnalysisStateData {
  myNewSetting: boolean;  // Add new field
}

setMyNewSetting(value: boolean): void {
  this.updateState({ myNewSetting: value });
}

// 2. Update AnalysisUI.ts
render(state: AnalysisStateData): void {
  if (state.myNewSetting) {
    // Render new UI
  }
}

// 3. Update AnalysisTab.ts
bindEvents(): void {
  document.getElementById('new-btn')?.addEventListener('click', () => {
    this.state.setMyNewSetting(true);
  });
}
```

### Creating a New Service

```typescript
// 1. Create service file
export class MyService {
  doWork(input: string): string {
    return input.toUpperCase();
  }
}

export const myService = new MyService();

// 2. Add to SharedServices interface
export interface SharedServices {
  myService: MyService;
}

// 3. Initialize in AppController
this.services = {
  myService: myService
};
```

### Debugging

#### Check App Instance
```javascript
// In browser console
window.__warcrowApp
```

#### Access Tab State
```javascript
const analysisTab = window.__warcrowApp.getTab('analysis');
// Note: State is encapsulated, access through public methods
```

#### Check Services
```javascript
window.__warcrowApp.services.storage
window.__warcrowApp.services.charts
window.__warcrowApp.services.diceData
```

## Common Tasks

### Task: Update Dice Pool
```typescript
// Old way (direct mutation)
this.analysisPool.Red = 5;

// New way (through state)
analysisTab.state.setDiceCount('Red', 5);
```

### Task: Run Simulation
```typescript
// Old way (method on calculator)
calc.runSimulation();

// New way (internal to tab)
// Happens automatically when state changes
// Or manually trigger through tab controller
```

### Task: Persist Configuration
```typescript
// Old way (scattered localStorage calls)
localStorage.setItem('key', JSON.stringify(data));

// New way (through service)
storageService.save('key', data);
```

### Task: Render a Chart
```typescript
// Old way (managed in monolithic class)
if (this.activeCharts[id]) {
  this.activeCharts[id].update();
}

// New way (through service)
chartService.ensureChart(id, type, data, options);
```

## File Locations Reference

| Old Location | New Location | Purpose |
|--------------|--------------|---------|
| `app.ts` (line 100-200) | `tabs/analysis/AnalysisState.ts` | Analysis state |
| `app.ts` (line 300-400) | `tabs/analysis/AnalysisUI.ts` | Analysis UI |
| `app.ts` (line 500-600) | `tabs/combat/CombatState.ts` | Combat state |
| `app.ts` (line 700-800) | `tabs/combat/CombatUI.ts` | Combat UI |
| `app.ts` (line 900-1000) | `tabs/explorer/ExplorerState.ts` | Explorer state |
| `app.ts` (line 1100-1200) | `tabs/faces/FacesTab.ts` | Faces tab |
| `app.ts` (chart methods) | `services/ChartService.ts` | Chart management |
| `app.ts` (storage methods) | `services/StorageService.ts` | Storage |
| `app.ts` (icon methods) | `services/IconService.ts` | Icons |

## Testing the Migration

### Smoke Tests

1. **Analysis Tab**
   - ✅ Add dice to pool
   - ✅ Run simulation
   - ✅ View charts
   - ✅ Configure pipeline
   - ✅ Configure rerolls

2. **Combat Tab**
   - ✅ Add attacker dice
   - ✅ Add defender dice
   - ✅ Run combat simulation
   - ✅ View results
   - ✅ Configure pipelines

3. **Explorer Tab**
   - ✅ Add dice
   - ✅ Roll dice
   - ✅ View reroll priorities
   - ✅ Change priority mode

4. **Faces Tab**
   - ✅ View all dice faces
   - ✅ See icons render

### Regression Tests

Compare results before and after:
- Same dice pool should produce same expected values
- Pipeline configurations should persist
- Reroll settings should persist
- Charts should render identically

## Rollback Plan

If issues are discovered:

1. **Use Git to Restore**
   ```bash
   # Find the commit before refactoring
   git log --oneline | head -20
   
   # Restore old app.ts from git
   git show <commit-hash>:src/app.ts > src/app.ts
   
   # Or reset the entire refactoring (destructive!)
   git reset --hard <commit-hash>
   
   npm run build
   ```

2. **Partial Rollback**
   - All new modular files can remain
   - Only restore old app.ts if needed
   - Can cherry-pick improvements later

3. **Report Issues**
   - Document what doesn't work
   - Compare behavior with old version
   - Create test cases

## Benefits Summary

### For Users
- ✅ No changes needed
- ✅ Same functionality
- ✅ Faster development = more features sooner

### For Developers
- ✅ 80% reduction in largest file size
- ✅ Clear separation of concerns
- ✅ Easy to test individual modules
- ✅ Safe to modify code (limited blast radius)
- ✅ New features are faster to implement

## Support

### Questions?
- Check `docs/ARCHITECTURE.md` for detailed patterns
- See `REFACTORING_SUMMARY.md` for overview
- Look at existing tab implementations as examples

### Found a Bug?
- Check if it exists in old code too
- Test with old code backup if needed
- Document steps to reproduce
- Check browser console for errors

---

**Migration Date:** November 9, 2025
**Status:** ✅ Complete
**Rollback:** Available via git history

