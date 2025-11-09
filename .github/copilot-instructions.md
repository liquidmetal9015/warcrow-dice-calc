**Project Overview**
- TypeScript + Vite single-page app for Warcrow dice simulation; `src/app.ts` instantiates `WarcrowCalculator` and wires DOM tabs, pipelines, and chart updates.
- Canonical die faces load from `public/warcrow_dice_faces.json`; treat this file as the contract for symbol probabilities and keep in sync with any rules changes.

**Simulation Flow**
- `SimulationController` prefers the web worker in `src/workers/simulation.worker.ts` (xorshift32 RNG seeded per request) and falls back to main-thread helpers in `src/dice.ts` when workers fail.
- Core Monte Carlo loops live in `src/services/simulation.ts`; they always normalize distributions to percentages (0-100) and accumulate expectations/stddev. Extend these functions when adding new statistics so normalization stays centralized.
- Pipelines transform aggregates after rolls and before combat resolution; ensure `transformAggregate` hooks return fresh objects when chaining mutations.

**Pipelines**
- Step implementations (`AddSymbolsStep`, `ElitePromotionStep`, `SwitchSymbolsStep`, `CombatSwitchStep`) in `src/pipeline.ts` mutate `state.aggregate` and clamp counts non-negative in `Pipeline.applyCombat`.
- Adding a step type requires updates in `src/pipelineSerialization.ts`, the worker (deserialization), and the UI editor (`src/ui/pipelineEditor.ts`) to keep localStorage, worker, and DOM controls aligned.
- Serialized steps persist under `localStorage` keys `pipeline:{scope}`; keep scope strings (`analysis`, `attacker`, `defender`) intact when storing new metadata.

**UI & State**
- DOM scaffolding lives in root `index.html` with styling in `style.css`; the app accesses elements by ID/class, so adjust selectors in `src/app.ts` if markup changes.
- Charts use global `Chart` and `Plotly` instances injected via `index.html`; avoid importing chart packages in TypeScript and rely on the globals instead.
- Icon rendering depends on `window.WARCROW_ICON_MAP` populated by the page; new symbols must be added there to avoid fallback warnings.

**Testing**
- Vitest drives tests (`npm run test`, `npm run test:watch`, `npm run test:cov`); helper script `./scripts/test.sh` ensures Node 20 via nvm.
- Deterministic RNG helpers in `tests/utils.ts` keep probabilistic assertions stable; prefer them over `Math.random` inside tests.
- Distribution and simulation expectations live in `tests/simulation*.test.ts` and `tests/dice*.test.ts`; mirror those patterns when validating new aggregate outputs.

**Developer Workflow**
- Node 20 is enforced (`.nvmrc`, setup scripts). Run `./scripts/setup.sh` on first clone to install deps and execute a smoke test.
- Use `npm run dev` or `./scripts/dev.sh` for the Vite dev server; static assets (including dice faces JSON) are served from `public/` and bundled as-is.
- Type safety is strict (`tsconfig.json` enables `noUncheckedIndexedAccess`); exported utilities should declare explicit types to satisfy the compiler.
