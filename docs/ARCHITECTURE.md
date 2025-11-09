# Warcrow Calculator - Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [Core Principles](#core-principles)
3. [Architecture Layers](#architecture-layers)
4. [Tab Structure](#tab-structure)
5. [Data Flow](#data-flow)
6. [State Management](#state-management)
7. [Service Layer](#service-layer)
8. [Adding New Features](#adding-new-features)

## Overview

The Warcrow Calculator is built as a **tab-based single-page application** where each tab operates as an independent mini-application. The architecture emphasizes:

- **Tab Independence**: Each tab is self-contained with no cross-tab dependencies
- **Separation of Concerns**: Clear boundaries between UI, state, and business logic
- **Service Layer**: Shared stateless services for common functionality
- **Observable State**: Predictable state changes using the observer pattern

## Core Principles

### 1. Tab Independence
Each of the four tabs (Analysis, Combat, Explorer, Faces) is completely independent:
- Has its own state management
- Has its own UI rendering logic
- Has its own controller
- Shares nothing except services and dice data

### 2. Unidirectional Data Flow
```
User Interaction → TabController → State Update → UI Render
                                         ↓
                                    Notify Listeners
```

### 3. Dependency Injection
Services are injected into tab controllers, making them:
- Easy to test
- Easy to mock
- Easy to replace

## Architecture Layers

```
┌──────────────────────────────────────────────────────────┐
│                       app.ts                              │
│                  (Entry Point - 18 lines)                 │
└─────────────────────────┬────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────┐
│                  AppController                            │
│           (Tab Routing & Initialization)                  │
└──────────┬──────────────┬──────────────┬─────────────────┘
           │              │              │
┌──────────▼──┐  ┌───────▼──────┐  ┌────▼───────┐
│ Analysis Tab│  │ Combat Tab   │  │Explorer Tab│  ...
│             │  │              │  │            │
│ ┌─────────┐ │  │ ┌─────────┐  │  │ ┌────────┐ │
│ │  State  │ │  │ │  State  │  │  │ │ State  │ │
│ └─────────┘ │  │ └─────────┘  │  │ └────────┘ │
│             │  │              │  │            │
│ ┌─────────┐ │  │ ┌─────────┐  │  │ ┌────────┐ │
│ │   UI    │ │  │ │   UI    │  │  │ │   UI   │ │
│ └─────────┘ │  │ └─────────┘  │  │ └────────┘ │
│             │  │              │  │            │
│ ┌─────────┐ │  │ ┌─────────┐  │  │ ┌────────┐ │
│ │Components│ │  │ │Components│  │  │ │Comp.  │ │
│ └─────────┘ │  │ └─────────┘  │  │ └────────┘ │
└─────────────┘  └──────────────┘  └────────────┘
       │                │                 │
       └────────────────┼─────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│                  Shared Services                          │
│  Storage │ Charts │ Icons │ Simulation │ DiceData        │
└───────────────────────────────────────────────────────────┘
```

## Tab Structure

Every tab follows a consistent pattern:

### Tab Components

#### 1. **TabController** (Main Entry Point)
```typescript
class ExampleTab extends TabController {
  private state: ExampleState;
  private ui: ExampleUI;
  
  protected async onInitialize(): Promise<void> {
    // Setup state, UI, event listeners
  }
  
  protected onActivate(): void {
    // Tab becomes visible
  }
  
  protected onDeactivate(): void {
    // Tab becomes hidden
  }
  
  protected onDispose(): void {
    // Cleanup
  }
}
```

**Responsibilities:**
- Coordinate between state and UI
- Handle user interactions
- Trigger simulations
- Manage lifecycle

#### 2. **TabState** (State Management)
```typescript
class ExampleState extends TabState<StateData> {
  // Getters for state access
  getPool(): DicePool { return {...this.state.pool}; }
  
  // Methods for state updates
  updatePool(pool: DicePool): void {
    this.updateState({ pool });
    // Notifies all listeners automatically
  }
}
```

**Responsibilities:**
- Store tab-specific state
- Notify listeners of changes
- Provide immutable state access
- Validate state transitions

#### 3. **TabUI** (UI Rendering)
```typescript
class ExampleUI {
  render(state: StateData): void {
    // Pure rendering based on state
  }
  
  showLoading(): void { }
  showEmptyState(): void { }
  showResults(results: any): void { }
}
```

**Responsibilities:**
- Render UI based on state
- No business logic
- No state mutations
- Delegate chart rendering to components

#### 4. **Components** (Reusable UI)
```typescript
class SymbolSummary {
  render(results: MonteCarloResults): void {
    // Render specific UI element
  }
}
```

**Responsibilities:**
- Render specific UI sections
- Self-contained and reusable
- Accept data, return HTML

## Data Flow

### Example: Adding a Die to Analysis Tab

```
1. User clicks "+1 Red die" button
   ↓
2. AnalysisTab.handleDiceAdjust()
   ↓
3. AnalysisState.setDiceCount('Red', 1)
   ↓
4. State updates internally and notifies listeners
   ↓
5. AnalysisTab receives state change notification
   ↓
6. AnalysisUI.render(newState) is called
   ↓
7. UI updates to show new die count
   ↓
8. AnalysisTab.scheduleSimulation() is called
   ↓
9. After debounce, simulation runs
   ↓
10. Results come back
   ↓
11. State.setResults(results)
   ↓
12. UI re-renders with results
```

### State Change Flow
```
User Action
    ↓
Controller Method
    ↓
State Update Method
    ↓
Internal State Change + notifyListeners()
    ↓
All Subscribed Listeners Called
    ↓
UI.render(newState)
    ↓
DOM Updated
```

## State Management

### Observable Pattern

All tab states extend `TabState<T>` which implements the observer pattern:

```typescript
// Subscribing to state changes
const unsubscribe = state.subscribe((newState) => {
  console.log('State changed:', newState);
  ui.render(newState);
});

// Unsubscribing
unsubscribe();
```

### Immutability

State getters return copies to prevent external mutations:

```typescript
getPool(): DicePool {
  return { ...this.state.pool };  // Returns a copy
}
```

### State Updates

State is updated through dedicated methods:

```typescript
updatePool(pool: Partial<DicePool>): void {
  this.updateState({
    pool: { ...this.state.pool, ...pool },
    resultsOutdated: true
  });
  // Automatically notifies all listeners
}
```

## Service Layer

Services are **stateless, injectable, and reusable**:

### StorageService
```typescript
storageService.save('key', data);
const data = storageService.load<T>('key');
```

**Use Cases:**
- Persisting pipeline configurations
- Saving user preferences
- Caching results

### ChartService
```typescript
chartService.ensureChart('chart-id', 'bar', chartData, options);
chartService.destroyChart('chart-id');
```

**Use Cases:**
- Creating/updating Chart.js charts
- Creating/updating Plotly heatmaps
- Managing chart lifecycle

### IconService
```typescript
iconService.renderIcon('HIT', '⚔️');
iconService.getIconMap();
```

**Use Cases:**
- Rendering Warcrow font icons
- Providing fallback emojis
- Checking icon availability

### DiceData
```typescript
await diceData.load();
const faces = diceData.getFaces();
```

**Use Cases:**
- Loading dice face definitions
- Accessing dice data globally
- Validating dice structure

### SimulationController
```typescript
await simulation.runAnalysisWithPipeline(pool, faces, count, pipeline);
```

**Use Cases:**
- Running Monte Carlo simulations
- Running combat simulations
- Web Worker management

## Adding New Features

### Adding a New Tab

1. **Create tab directory structure:**
```
src/tabs/mytab/
  ├── MyTab.ts          # Controller
  ├── MyTabState.ts     # State management
  ├── MyTabUI.ts        # UI rendering
  └── components/        # Tab-specific components
      └── MyComponent.ts
```

2. **Implement TabController:**
```typescript
export class MyTab extends TabController {
  protected async onInitialize(): Promise<void> {
    // Setup
  }
  // ... other lifecycle methods
}
```

3. **Implement State:**
```typescript
export class MyTabState extends TabState<MyStateData> {
  constructor() {
    super({ /* initial state */ });
  }
}
```

4. **Register in AppController:**
```typescript
const myTabContainer = document.getElementById('mytab-tab');
this.tabs.set('mytab', new MyTab(myTabContainer, this.services));
```

### Adding a New Service

1. **Create service file:**
```typescript
// src/services/MyService.ts
export class MyService {
  doSomething(input: string): string {
    return `processed: ${input}`;
  }
}

export const myService = new MyService();
```

2. **Add to SharedServices:**
```typescript
// src/core/types.ts
export interface SharedServices {
  // ... existing services
  myService: MyService;
}
```

3. **Initialize in AppController:**
```typescript
this.services = {
  // ... existing services
  myService: myService
};
```

### Adding a Feature to Existing Tab

1. **Add state for the feature:**
```typescript
// In AnalysisState.ts
export interface AnalysisStateData {
  // ... existing state
  myNewFeature: boolean;
}

setMyNewFeature(value: boolean): void {
  this.updateState({ myNewFeature: value });
}
```

2. **Update UI to render the feature:**
```typescript
// In AnalysisUI.ts
render(state: AnalysisStateData): void {
  if (state.myNewFeature) {
    // Render new feature
  }
}
```

3. **Add interaction handling:**
```typescript
// In AnalysisTab.ts
private bindEvents(): void {
  // ... existing bindings
  document.getElementById('my-feature-btn')?.addEventListener('click', () => {
    this.state.setMyNewFeature(true);
  });
}
```

## Best Practices

### DO ✅
- Keep controllers thin - delegate to state and UI
- Make state updates through dedicated methods
- Return copies from state getters
- Use services for shared functionality
- Keep components focused and reusable

### DON'T ❌
- Don't mutate state directly
- Don't share state between tabs
- Don't put business logic in UI classes
- Don't make services stateful
- Don't create circular dependencies

## Testing Strategy

### Unit Testing

**Services:**
```typescript
test('StorageService saves and loads data', () => {
  storageService.save('test', { value: 123 });
  const loaded = storageService.load('test');
  expect(loaded).toEqual({ value: 123 });
});
```

**State:**
```typescript
test('AnalysisState updates pool correctly', () => {
  const state = new AnalysisState();
  state.setDiceCount('Red', 3);
  expect(state.getPool().Red).toBe(3);
});
```

**Components:**
```typescript
test('SymbolSummary renders correctly', () => {
  const container = document.createElement('div');
  const component = new SymbolSummary(container, iconService);
  component.render(mockResults);
  expect(container.innerHTML).toContain('Expected');
});
```

### Integration Testing

Test tab lifecycle:
```typescript
test('AnalysisTab initializes and renders', async () => {
  const container = document.createElement('div');
  const tab = new AnalysisTab(container, mockServices);
  await tab.initialize();
  tab.activate();
  expect(container.querySelector('.symbol-summary')).toBeTruthy();
});
```

## Performance Considerations

### Current Optimizations
- Debounced simulation triggers (300ms)
- Chart updates instead of recreations
- Web Worker for heavy simulations
- Efficient state change notifications

### Future Optimizations
- Lazy loading tabs (only load on first activation)
- Virtual scrolling for large dice lists
- Memoized calculations
- Code splitting by tab

## Debugging

### Available Debug Hooks

```typescript
// Global app instance
window.__warcrowApp

// Get specific tab
const analysisTab = window.__warcrowApp.getTab('analysis');

// Access services
const { storage, charts, icons } = window.__warcrowApp.services;
```

### Common Issues

**Tab not rendering?**
- Check if tab is initialized: `tab.isTabInitialized()`
- Check if tab is active: `tab.isTabActive()`
- Check browser console for errors

**State not updating?**
- Verify state change method is called
- Check if listeners are subscribed
- Ensure updateState() is called (not direct mutation)

**Simulation not running?**
- Check dice pool count > 0
- Verify diceData is loaded
- Check simulation controller initialization

---

**Last Updated:** November 9, 2025
**Version:** 2.0.0 (Post-Refactoring)

