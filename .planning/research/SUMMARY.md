# Project Research Summary

**Project:** Job Tracker Chrome Extension — Code Quality Milestone
**Domain:** React/TypeScript Chrome extension refactoring
**Researched:** 2026-03-18
**Confidence:** HIGH (based primarily on direct codebase inspection; external tool verification unavailable)

## Executive Summary

This milestone is a code quality refactoring pass on an existing, working Chrome extension. The codebase (Vite 5.4.21 + React 18.2.0 + TypeScript 5.9.3) has four compounding problems: a latent data-loss bug from stale closures in `useJobApps`, ~100 lines of untestable CSV logic buried in `App.tsx`, a 400-line global `App.css` with no style scoping, and zero test or lint infrastructure. The recommended approach is to fix these in dependency order — tooling first, then logic refactors, then test coverage, then CSS isolation — each phase delivered as a behavior-preserving change with no new features introduced.

The critical constraint is that this is a Chrome extension: the `chrome` global does not exist in the test environment, the popup is 520px wide with a single JS bundle, and every architectural decision must respect the extension execution model. Vitest with jsdom is the correct test runner (native Vite integration, no Babel config), and CSS Modules are already built into Vite with zero configuration. No new runtime dependencies are needed for any part of this milestone.

The top risks are: (1) the stale closure fix is easy to implement incorrectly — `Storage.set` must receive the computed next array, not a stale snapshot; (2) the CSS Modules migration will break shared global classes (`.btn`, `.badge`, `:root` custom properties) if they are moved into scoped files; (3) Vitest tests will crash on `ReferenceError: chrome is not defined` unless a global chrome mock is installed in the setup file before any tests run. All three risks have clear, specific prevention patterns documented in PITFALLS.md.

---

## Key Findings

### Recommended Stack

The existing stack needs no runtime additions. All additions are devDependencies. Vitest + React Testing Library is the definitive test stack for this codebase — Vitest reuses `vite.config.ts` directly, shares the same ESM context as the app, and requires only a `test` block addition to the existing Vite config. CSS Modules are Vite-native and require no installation. ESLint and Prettier are out-of-scope per PROJECT.md but listed as available for the linting phase.

**Core technology additions:**
- `vitest ^2.x`: Test runner — native Vite integration, no Babel, same ESM context as the app
- `@testing-library/react ^16.x`: Component rendering and querying — tests observable behavior, not internals
- `@testing-library/user-event ^14.x`: Simulated user interaction — use async v14 API, not v13 sync
- `@testing-library/jest-dom ^6.x`: DOM assertion matchers — works with Vitest via single setup file
- `jsdom ^25.x`: DOM environment — required for `localStorage`, `FileReader`, `Blob` used in CSV logic
- CSS Modules: Style scoping — zero-config Vite built-in; no package to install
- `eslint ^9.x` + `prettier ^3.x`: Linting and formatting — flat config (eslint v9), listed as supporting infrastructure

**Version validation required before installing:** Run `npm show [package] version` for all Vitest and RTL packages — exact patch versions were based on August 2025 training data.

### Expected Features

All items below are refactoring tasks, not new features. "Table stakes" means the codebase cannot be considered maintainable without them. "Differentiators" add lasting value but do not change the app's behavior for end users.

**Must have (table stakes):**
- Vitest test infrastructure setup — unblocks all subsequent test-writing; requires chrome global mock in setupFiles
- Fix stale closure in `useJobApps` — latent data-loss bug affecting add/update/delete/import callbacks
- Extract CSV logic to `src/utils/csv.ts` — ~100 lines of pure logic buried in App.tsx; prerequisite for CSV tests
- Tests for CSV parsing — custom quote-handling and fuzzy header detection with known edge cases
- Tests for `useJobApps` hook — validates the stale closure fix; prevents regression
- Enable `noUnusedLocals` + `noUnusedParameters` in tsconfig — currently disabled; dead code accumulates silently
- ESLint with `eslint-plugin-react-hooks` — would catch the stale closure pattern automatically
- Prettier configuration — zero formatter currently; code drift is accumulating
- Replace magic status strings with constants — `'Applied'` literals in multiple files; `ALL_STATUSES` already exists in `constants.ts`
- CSS Modules migration — 400-line global `App.css` with no scoping; class name collisions are a latent risk

**Should have (low complexity, high value):**
- React Error Boundary wrapping `AppList` — no crash containment currently; single-class-component addition
- Memoize filter/search computation in `AppList` — `useMemo` on filtered apps; measurable render reduction
- Centralize feedback timeout constants — `4000`/`5000` scattered in 4 locations; `FEEDBACK_TIMEOUT_MS` in `constants.ts` fixes it
- URL validation helper `isValidUrl()` — pure function, easily testable, prevents malformed storage data

**Defer to next milestone:**
- Storage adapter tests — lower priority than hook and utility tests
- List virtualization — feature addition, not a code quality fix
- Undo on delete — requires state shape changes beyond code quality scope
- CI/CD pipeline — explicitly out of scope per PROJECT.md
- Async CSV / Web Worker — performance feature, not a refactor

### Architecture Approach

The app is a single-root component tree with no routing and no external state library. `App.tsx` is a God Component that currently owns view state, form handlers, and all CSV logic. The refactoring moves pure data transformations to `src/utils/csv.ts`, fixes the functional update pattern in `useJobApps`, and scopes CSS per-component via CSS Modules. No component moves — only logic relocation, callback pattern changes, and CSS file restructuring. The component tree topology is preserved exactly.

**Major components and their post-refactor responsibilities:**
1. `App.tsx` — View state, form handlers, composition; no longer owns CSV parsing or export string logic
2. `useJobApps` hook — CRUD state + persistence; all four callbacks use functional updater (`setApps(prev => ...)`)
3. `src/utils/csv.ts` (new) — `parseCSV(text): JobApp[]`, `exportCSV(apps): string`; pure, no React, fully testable
4. `src/styles/globals.css` (new) — `:root` custom properties, `body`, shared primitives (`.btn`, `.form-input`, `.empty`)
5. Per-component `*.module.css` files — component-private classes only; imports as `styles.foo`
6. Test files — co-located with source, using `renderHook` for hooks and `@testing-library/react` for components

**Key patterns to follow:**
- Functional state updates: `setApps(prev => { const next = ...; Storage.set(..., next); return next; })` — computes `next` once, passes to both state and storage
- CSS Module import convention: `import styles from './Component.module.css'`; shared primitives stay in `globals.css` (not scoped)
- Pure utility extraction: `csv.ts` handles text-in/text-out only; FileReader, Blob, anchor click stay in App.tsx
- Test observable behavior, not internals: assert on returned arrays and rendered output, not on whether `persist` was called

### Critical Pitfalls

1. **Stale closure fix persists stale data to storage** — The fix must compute the `next` array inside the `setApps` updater and pass it to `Storage.set` in the same operation. Applying `setApps(prev => ...)` without also moving the `Storage.set` call inside causes storage to receive one-update-behind data. Write a rapid-succession test (3 adds without awaiting) to confirm.

2. **CSS Modules break shared global classes** — `.btn`, `.badge`, `.empty`, and `:root` custom property declarations must remain in a non-module `globals.css`. If any of these are moved into a `.module.css` file, they become scoped and every other component loses those styles silently. Create `globals.css` as the first action before migrating any component.

3. **Vitest crashes on `chrome` global** — `Header.tsx` calls `chrome.runtime.sendMessage` directly. Any test that renders `Header` or a parent component will throw `ReferenceError: chrome is not defined`. Add a minimal chrome mock to `vitest.setup.ts` before writing any test files.

4. **`importApps` stale closure left unfixed** — All four `useJobApps` callbacks (`addApp`, `updateApp`, `deleteApp`, `importApps`) close over `apps`. Fix all four atomically. A partial fix (three callbacks fixed, `importApps` missed) leaves a data-loss risk in the batch import path.

5. **CSS class ownership not mapped before migration** — `App.css` contains styles for all components. Migrating one component at a time without a grep-based class-to-component map risks deleting a class that is also used elsewhere. Produce the ownership map before writing the first `.module.css` file.

---

## Implications for Roadmap

Based on the dependency graph identified across all four research files, four phases are recommended. Each phase is behavior-preserving and independently verifiable.

### Phase 1: Dev Tooling Baseline
**Rationale:** Vitest infrastructure and ESLint are the prerequisites for all subsequent work. No test can be written without the runner. No linting benefit is realized without the config. ESLint with `react-hooks` plugin also provides automated detection of the exact stale closure pattern being fixed in Phase 2. TypeScript flag cleanup belongs here because `noUnusedLocals` will surface dead code during the Phase 2 extraction.
**Delivers:** A working test runner with chrome mock, ESLint with `react-hooks/exhaustive-deps`, Prettier, and `noUnusedLocals`/`noUnusedParameters` enabled in tsconfig.
**Addresses:** Vitest setup (table stakes), ESLint/Prettier setup (table stakes), TypeScript strictness (table stakes)
**Avoids Pitfalls:** Pitfall 3 (chrome global crash) — the chrome mock in `vitest.setup.ts` is established here before any tests are written

### Phase 2: Logic Refactors
**Rationale:** Two independent refactors that share no dependencies on each other but both must land before tests are written. The stale closure fix must precede hook tests (tests written against the buggy hook would encode the bug). The CSV extraction must precede CSV tests (tests require the extracted pure function). Magic string consolidation is a companion to CSV extraction since the parser currently embeds the `'Applied'` literal.
**Delivers:** `useJobApps` with functional update pattern, `src/utils/csv.ts` with pure parsing/export functions, magic status strings replaced with `ALL_STATUSES` constants.
**Uses:** Functional updater pattern (ARCHITECTURE.md), pure utility extraction pattern (ARCHITECTURE.md)
**Avoids Pitfalls:** Pitfall 1 (stale closure → stale storage), Pitfall 5 (importApps not fixed atomically), Pitfall 12 (magic string copied into utility), Pitfall 11 (dead code from extraction surfaces when noUnusedLocals is enabled)

### Phase 3: Test Coverage
**Rationale:** Tests can only be written correctly after Phase 2 is complete. CSV tests require the extracted utility. Hook tests must validate the fixed functional update behavior, not the original buggy pattern. Component tests (AppCard, AppForm, Feedback, Badge) have no dependency on Phase 2 but benefit from the ESLint strictness established in Phase 1.
**Delivers:** `csv.test.ts` covering happy path, edge cases, empty file, ambiguous headers; `useJobApps.test.ts` covering CRUD operations and rapid-succession mutation; component tests for key UI units.
**Implements:** Test file co-location pattern (ARCHITECTURE.md); chrome mock reuse from Phase 1
**Avoids Pitfalls:** Pitfall 2 (validate the storage write with a rapid-succession test), Pitfall 9 (test pure `parseCSV(text)`, not the FileReader wrapper), Pitfall 13 (FileReader tests are async and give false green)

### Phase 4: CSS Modules Migration
**Rationale:** CSS migration is technically independent of Phases 2-3, but doing it last means Phase 3's tests provide a regression safety net for the class-name rename-heavy changes. Without tests, a typo in a CSS Module class name has no automated catch. The migration should be done leaf-to-root within Phase 4 (Badge, Feedback, Stats first; AppForm, SetupWizard, Header last).
**Delivers:** Per-component `.module.css` files, `src/styles/globals.css` with shared primitives and CSS custom properties, removal of global `App.css`.
**Avoids Pitfalls:** Pitfall 1 (shared class names broken — globals.css established first), Pitfall 4 (PascalCase naming convention), Pitfall 7 (`:root` custom properties in globals.css, not a module), Pitfall 10 (class ownership map produced before first `.module.css` is written)

**Optional Phase 5: Resilience and Performance Micro-improvements**
Small additions that each take under 30 minutes: React Error Boundary, `useMemo` on filtered list, `FEEDBACK_TIMEOUT_MS` constant, `isValidUrl()` utility. These can be bundled into a single lightweight phase or appended to Phase 3 if scope allows.

### Phase Ordering Rationale

- Phase 1 before all others: Vitest infrastructure is a prerequisite for test writing; ESLint with `react-hooks` provides live feedback during Phase 2 changes
- Phase 2 before Phase 3: Tests written against unfixed hook behavior would encode the stale closure bug as expected behavior
- Phase 3 before Phase 4: Tests provide the regression net that makes the class-name-heavy CSS migration safe to verify
- Phase 4 last: Behavior-preserving style isolation; visual regression check (before/after popup screenshots) is the validation mechanism

### Research Flags

Phases with well-documented patterns — skip `/gsd:research-phase`:
- **Phase 1 (Vitest setup):** Standard Vitest + RTL configuration, well-established; the chrome mock pattern is documented in STACK.md
- **Phase 2 (Logic refactors):** Functional update pattern and pure utility extraction are standard React patterns with specific implementation in ARCHITECTURE.md
- **Phase 3 (Test coverage):** Testing patterns for React hooks and utilities are well-documented; specific edge cases are enumerated in FEATURES.md
- **Phase 4 (CSS Modules):** Vite CSS Modules behavior is fully documented; migration steps and ownership map process are detailed in PITFALLS.md

No phase in this milestone requires deeper research. All patterns are established and verified against the actual codebase.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | CSS Modules are Vite-native (zero config). Vitest + RTL is the definitive pairing for this stack. Package major versions are correct; exact patch versions need `npm show` validation before install. |
| Features | HIGH | Based on direct codebase inspection. Every table-stakes item corresponds to a confirmed gap in the actual source files. |
| Architecture | HIGH | Derived from direct source file inspection. Component tree, hook internals, stale closure pattern, and CSS class distribution were all confirmed against live code. |
| Pitfalls | HIGH | All critical pitfalls were identified by reading actual code, not inferring from docs. The stale closure pattern is confirmed at `useJobApps.ts:22-40`. The chrome global usage is confirmed in `Header.tsx:31,40`. |

**Overall confidence: HIGH**

### Gaps to Address

- **Package version pinning:** Exact versions for `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom` must be validated with `npm show [package] version` before installation. Major version ranges are correct; patch versions are not. External tools were unavailable during research.
- **`vi.stubGlobal` API availability:** Confirmed present in Vitest >=0.26; verify against the actually-installed version before writing tests that rely on it.
- **`storage.ts` lazy evaluation:** The `isExtension` check evaluated at module load time (Pitfall 6) is the one architectural fix with the most test-design impact. If storage adapter tests are added, refactoring `storage.ts` to lazy-evaluate `isExtension` may be required. This is flagged as a possible addition within Phase 3 planning.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `src/App.tsx` — God component structure, CSV logic location, callback patterns
- `src/hooks/useJobApps.ts` — Stale closure confirmed at lines 22-40
- `src/hooks/useWebhook.ts` — Webhook state and syncToSheets
- `src/App.css` — 320 lines global; class distribution across components
- `src/utils/constants.ts` — `STATUS_MAP`, `ALL_STATUSES`, `genId`, `emptyForm` confirmed
- `src/utils/storage.ts` — `isExtension` module-load evaluation confirmed
- `src/types.ts` — `JobApp`, `StatusInfo`, `FeedbackMessage`
- `vite.config.ts` — Single bundle constraint, `manualChunks: undefined`
- `tsconfig.json` — `noUnusedLocals: false`, `noUnusedParameters: false` confirmed
- `.planning/codebase/CONCERNS.md` — Stale closure and CSS debt documented
- `.planning/PROJECT.md` — Explicit out-of-scope constraints

### Secondary (MEDIUM confidence — training knowledge, August 2025)
- Vitest documentation patterns and configuration API
- React Testing Library v14 user-event async API conventions
- ESLint v9 flat config format and `@typescript-eslint` integration
- CSS Modules scoping behavior in Vite (compiled to atomic class names in single output file)
- jsdom environment limitations for browser APIs (`URL.createObjectURL`, `FileReader`)

### Tertiary (external verification blocked)
- Exact package versions for Vitest ecosystem — `npm show [package] version` required before install
- `vi.stubGlobal` availability in specific Vitest release — verify against installed version

---

*Research completed: 2026-03-18*
*Ready for roadmap: yes*
