# Warcrow Dice Calculator - Agent Guide

This document serves as the primary source of truth for AI agents working on the Warcrow Dice Calculator project. It describes the architecture, patterns, and standards used in the codebase.

## Project Overview

**Warcrow Dice Calculator** is a TypeScript/Vite web application for Monte Carlo simulation and probability analysis of the Warcrow tabletop game dice system. It calculates roll probabilities, combat outcomes, and visualizes statistics using Chart.js and Plotly.

**Key Characteristics:**
- **Zero-Framework UI:** Pure DOM manipulation (no React/Vue/etc)
- **Tab-Based Architecture:** Modular, independent tabs with shared services
- **Observable State:** Reactive state management via custom `TabState`
- **Web Workers:** Heavy simulation logic runs off the main thread

## Core Concepts

### Dice System
- **Attack Dice**: Red, Orange, Yellow
- **Defense Dice**: Green, Blue, Black
- **Faces**: Each die has 8 faces defined in `public/warcrow_dice_faces.json`

### Symbol Types
- `HIT` / `HOLLOW_HIT`: Attack success
- `BLOCK` / `HOLLOW_BLOCK`: Defense success
- `SPECIAL` / `HOLLOW_SPECIAL`: Special triggers
- **Hollow vs Filled**: Hollow symbols are distinct and handled differently in pipelines (e.g., often promoted to filled).

### Game States (New in v2.1)
- **Disarmed**: Cancels the die with the most filled **HIT** symbols (tie-break: most SPECIALs).
- **Vulnerable**: Cancels the die with the most filled **BLOCK** symbols (tie-break: most SPECIALs).

### Core Features
1.  **Analysis Tab**: Single pool analysis, distributions, Disarmed/Vulnerable toggles.
2.  **Combat Tab**: Attacker vs Defender simulation, Disarmed/Vulnerable toggles.
3.  **Explorer Tab**: Manual rolling and reroll priority analysis.
4.  **Faces Tab**: Reference for all dice faces.
5.  **Pipelines**: Post-processing steps (e.g., `AddSymbols`, `ElitePromotion`, `SwitchSymbols`).

## Architecture

The application follows a **Modular Tab-Based Architecture**.

### High-Level Structure
```
src/
├── app.ts                  # Entry point
├── core/                   # Core app logic (AppController, DiceData)
├── services/               # Shared stateless services (Charts, Icons, Storage)
├── tabs/                   # Independent functional modules
│   ├── base/               # Base classes (TabController, TabState)
│   ├── analysis/           # Analysis Tab module
│   ├── combat/             # Combat Tab module
│   ├── explorer/           # Explorer Tab module
│   └── faces/              # Faces Tab module
├── ui/                     # Legacy/Shared UI components
├── workers/                # Simulation web workers
└── dice.ts                 # Core simulation logic
```

### The Tab Pattern
Every tab follows a strict pattern to ensure decoupling:

1.  **TabController** (`src/tabs/base/TabController.ts`):
    - Orchestrates State and UI.
    - Handles lifecycle (`initialize`, `activate`, `deactivate`, `dispose`).
    - Injects `SharedServices`.

2.  **TabState** (`src/tabs/base/TabState.ts`):
    - Holds immutable state data.
    - Implements the Observable pattern (`subscribe`/`unsubscribe`).
    - Updates trigger UI renders automatically.

3.  **TabUI**:
    - Pure rendering class.
    - No business logic.
    - Receives state, updates DOM.

4.  **Components**:
    - Smaller, reusable UI parts (e.g., `SymbolSummary`, `DistributionCharts`).

### Shared Services
Services are stateless singletons or instantiated once and passed via `SharedServices` interface:
- `StorageService`: LocalStorage wrapper.
- `ChartService`: Wrapper for Chart.js and Plotly.
- `IconService`: Manages Warcrow font glyphs and fallbacks.
- `DiceData`: Loads and caches dice face definitions.
- `SimulationController`: Manages Web Worker communication.

## Tech Stack & Standards

- **Build**: Vite 5.x
- **Language**: TypeScript 5.x (Strict Mode)
- **Testing**: Vitest
- **Linting**: ESLint
- **Visualization**: Chart.js, Plotly

### Naming Conventions
- **Classes/Types**: PascalCase (`AnalysisTab`, `DicePool`)
- **Functions/Methods**: camelCase (`simulateRoll`)
- **Constants**: UPPER_SNAKE_CASE (`DS.HIT`)
- **Files**: PascalCase for classes, camelCase for utilities.

### Coding Rules
1.  **Immutability**: Return copies of state. Do not mutate objects in place if possible.
2.  **Strict Typing**: Avoid `any`. Use specific types for everything.
3.  **No UI Frameworks**: Use standard DOM APIs (`querySelector`, `createElement`).
4.  **Dependency Injection**: Tabs receive services; they do not import singletons directly if possible (though some legacy utils might).

## Simulation Logic

Simulation is performed via **Monte Carlo** methods (typically 10,000+ iterations).

- **Location**: `src/dice.ts` and `src/workers/simulation.worker.ts`.
- **Flow**:
    1.  Generate random faces for pool.
    2.  Apply Rerolls (Attacker/Defender).
    3.  Apply States (Disarmed/Vulnerable) -> **Cancels Dice**.
    4.  Apply Pipeline (Post-processing).
    5.  Aggregate results.

## Development Workflow

1.  **State Changes**:
    - Add field to `TabState` interface.
    - Create update method in `State` class.
    - Update `UI` class to render new state.
    - Update `Controller` to bind events to state methods.

2.  **New Tab**:
    - Extend `TabController`.
    - Implement `initialize`, `activate`, etc.
    - Register in `AppController`.

3.  **Testing**:
    - Unit test States and Services.
    - Use `performMonteCarloSimulation` with seeded RNG for logic tests.

## Debugging

- Access app instance: `window.__warcrowApp`
- Access services: `window.__warcrowApp.services`
- Check Tab state: `window.__warcrowApp.getTab('analysis').state.getState()`

---
*Last Updated: November 2025*

