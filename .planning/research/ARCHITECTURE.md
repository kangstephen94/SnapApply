# Architecture Patterns

**Domain:** React/TypeScript Chrome Extension — Code Quality Refactoring
**Researched:** 2026-03-18
**Confidence:** HIGH (derived from direct code inspection of the live codebase)

---

## Current Architecture

The app is a single-root React component tree with two custom hooks supplying all state. No external state library, no routing. Chrome extension constraints (520px popup, single JS bundle, `chrome.storage` API) shape every architectural decision.

```
main.tsx
  └── App.tsx (God Component — view state, form handlers, CSV logic, all composition)
        ├── useJobApps    (CRUD state + chrome.storage/localStorage persistence)
        ├── useWebhook    (Google Sheets URL + sync state)
        ├── Header        (nav buttons, file input, scan, export triggers)
        ├── Feedback      (toast message display)
        ├── Stats         (aggregate counts)
        ├── Filters       (status filter buttons + search input)
        ├── AppList       (renders AppCard list)
        │     └── AppCard (expand/collapse, status inline edit, edit/delete actions)
        │           ├── Badge         (status color pill)
        │           └── StatusSelect  (status dropdown)
        ├── AppForm       (add/edit form, useEffect syncs to editing prop)
        │     └── StatusSelect
        └── SetupWizard   (multi-step Google Sheets connection flow)

Shared utils:
  src/utils/storage.ts    (async get/set, chrome.storage.local vs localStorage)
  src/utils/constants.ts  (STATUS_MAP, APPS_SCRIPT_CODE, genId(), emptyForm())
  src/types.ts            (JobApp, StatusInfo, FeedbackMessage)
  src/App.css             (all ~320 lines, global, consumed by every component)
```

---

## Component Boundaries (After Refactoring)

These boundaries describe what each unit owns and what it does NOT own. The refactoring
does not move components — it moves logic out of App.tsx and scopes CSS per component.

### App.tsx (after extract)
| Owns | Does Not Own (after refactor) |
|------|-------------------------------|
| View state (`list / form / settings`) | CSV parsing logic |
| Editing state | CSV export logic |
| Filter + search state | Any CSS class strings beyond layout |
| Form handlers (submit, cancel, edit) | |
| Composition of all child components | |
| Merging feedback messages (syncMsg + scanMsg) | |

### useJobApps (after fix)
| Owns | Does Not Own |
|------|-------------|
| `apps: JobApp[]` array state | CSV parsing |
| `loading: boolean` state | ID generation |
| `persist()` — write state + storage | Any UI concerns |
| `addApp`, `updateApp`, `deleteApp`, `importApps` | |

**Fix required:** `persist` currently reads `apps` from closure. Replace with functional
update: `setApps(prev => next(prev))`. Remove `apps` from all callback deps. This
eliminates the stale closure risk on rapid sequential mutations.

```typescript
// Before (stale closure risk — apps captured at callback creation time)
const addApp = useCallback(
  (app: JobApp) => persist([app, ...apps]),
  [apps, persist]
);

// After (functional update — always operates on latest state)
const addApp = useCallback(
  (app: JobApp) => persist(prev => [app, ...prev]),
  [persist]
);
```

### CSV Utilities (new: src/utils/csv.ts)
| Owns | Does Not Own |
|------|-------------|
| `parseCSV(text: string): JobApp[]` | State management |
| `exportCSV(apps: JobApp[]): string` | File I/O (FileReader, Blob, anchor) |
| `parseRow(line: string): string[]` (internal) | Feedback messages |
| Column detection / header normalization | |

App.tsx retains file I/O orchestration (FileReader, Blob creation, anchor click)
because those touch DOM and async lifecycle — not pure data transformation.

### CSS Modules Layout

Each component gets one `.module.css`. Shared primitives stay in a `globals.css`
imported at the root (App.tsx or main.tsx).

```
src/
  styles/
    globals.css           ← :root vars, body, .btn variants, .form-input, .form-label
  components/
    Header.module.css     ← .header, .headerActions, .sub
    Feedback.module.css   ← .feedback, .feedbackSuccess, .feedbackError
    Stats.module.css      ← .stats, .stat, .statValue, .statLabel
    Badge.module.css      ← .badge
    Filters.module.css    ← .filters, .filterBtn, .search
    AppList.module.css    ← (minimal — likely just .list wrapper)
    AppCard.module.css    ← .card, .cardHeader, .cardCompany, .cardRole,
                             .cardDate, .cardExpand, .cardDetail,
                             .cardDetailLabel, .cardActions
    AppForm.module.css    ← .formPanel, .formTitle, .formGrid, .full, .formActions
    SetupWizard.module.css ← .wizard, .wizardHeader, .wizardTitle, .wizardClose,
                              .steps, .stepDot, .stepLabel, .stepContent,
                              .stepTitle, .stepText, .stepNav, .codeBlock, .copyBtn
```

### Test Infrastructure (new: src/__tests__/ and component co-location)

```
src/
  utils/
    csv.test.ts           ← pure unit tests, no React needed
  hooks/
    useJobApps.test.ts    ← renderHook from @testing-library/react
  components/
    AppCard.test.tsx      ← render, userEvent for expand/collapse/actions
    AppForm.test.tsx      ← render + userEvent, submit validation
    Feedback.test.tsx     ← conditional render, ok vs error styles
    Badge.test.tsx        ← status-to-color mapping snapshot
```

---

## Data Flow

### Current (read-only, no mutations needed)
```
chrome.storage / localStorage
    ↓  Storage.get('job-apps')
useJobApps.useEffect
    ↓  JSON.parse → JobApp[]
    ↓  setApps
App.tsx (apps prop)
    ↓  passed as props
AppList → AppCard[]   (read display)
Stats                 (aggregate counts)
Filters               (filter/search client-side)
```

### Mutation Flow (CRUD)
```
User action in AppCard / AppForm
    ↓  onEdit / onDelete / onUpdateStatus / onSubmit callback
App.tsx handler (handleEdit, handleFormSubmit, handleUpdateStatus)
    ↓  addApp / updateApp / deleteApp from useJobApps
persist(next: JobApp[])
    ↓  setApps(next)          — immediate React state update
    ↓  Storage.set(JSON)      — async write (fire-and-forget)
React re-render cascade
```

### CSV Import Flow (post-refactor)
```
User selects file → Header file input onChange
    ↓  onImport(file: File) callback
App.tsx importCSV handler
    ↓  FileReader.readAsText (IO — stays in App.tsx)
    ↓  parseCSV(text) from utils/csv.ts (pure — extracted)
    ↓  importApps(newApps) from useJobApps
    ↓  setScanMsg(feedback)
```

### CSS Data Flow (after CSS Modules)
```
globals.css  →  imported once in App.tsx or main.tsx
                provides: CSS custom properties, body, .btn, .form-input, .form-label

Component.module.css  →  imported in Component.tsx
                          provides: component-private class names via styles.foo
                          Vite hashes to avoid collisions: .card → .AppCard_card__x7k2
```

---

## Patterns to Follow

### Pattern 1: Functional State Updates in Hooks

**What:** Use `setApps(prev => f(prev))` instead of closing over `apps` in callbacks.
**When:** Any hook callback that modifies array state and could be called multiple times
in rapid succession (e.g., batch import, undo).
**Why:** Prevents stale closure bugs where a callback captures an old `apps` snapshot
before a previous update has been applied to React state.

```typescript
// In persist — accepts a transform function, not a final array
const persist = useCallback(async (transform: (prev: JobApp[]) => JobApp[]) => {
  setApps(prev => {
    const next = transform(prev);
    Storage.set('job-apps', JSON.stringify(next)); // async side-effect inside updater is OK
    return next;
  });
}, []);

const addApp = useCallback(
  (app: JobApp) => persist(prev => [app, ...prev]),
  [persist]
);

const updateApp = useCallback(
  (id: string, patch: Partial<JobApp>) =>
    persist(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a)),
  [persist]
);
```

**Alternatively**, keep `persist` accepting a final array but move the `apps` read
inside the updater. Either approach eliminates the stale reference.

### Pattern 2: CSS Module Import Convention

**What:** Import the module as `styles`, access class names as `styles.camelCaseName`.
**When:** Every component that needs scoped styles.

```typescript
import styles from './AppCard.module.css';
// …
<div className={styles.card}>
<span className={`${styles.cardExpand} ${expanded ? styles.open : ''}`}>
```

### Pattern 3: Shared Primitive Classes in globals.css

**What:** Classes used across multiple components (`.btn`, `.btn-primary`, `.btn-secondary`,
`.btn-sm`, `.btn-icon`, `.btn-danger`, `.form-input`, `.form-label`) stay as global
classes, not scoped.
**When:** A class must be shared across 3+ components with identical semantics.
**Why:** CSS Modules scoping a `.btn` class would require every consumer to import the
same module — defeating the purpose. Global utility classes are a deliberate exception.

```css
/* src/styles/globals.css — imported once */
:root { --card-bg: #FFFFFF; /* … */ }
* { box-sizing: border-box; }
body { width: 520px; /* … */ }
.btn { padding: 7px 14px; /* … */ }
.btn-primary { background: #111827; color: #fff; }
/* etc. */
```

### Pattern 4: Pure Utility Extraction

**What:** Move pure data-transformation code from components/handlers into `src/utils/`.
**When:** A function takes data in, returns data out, with no React state, no side effects.
**Example candidates:** `parseRow`, full CSV parse pipeline, `exportCSV` string builder.
**Keep in App.tsx:** FileReader (async IO), Blob + anchor click (DOM side effect), feedback
state updates (React state).

### Pattern 5: Test File Co-location

**What:** Place test files adjacent to the module they test.
**When:** Unit tests for a utility or component.
**Exception:** Integration-level tests (e.g., full App flow) go in `src/__tests__/`.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Scoping Shared Primitives in CSS Modules

**What:** Moving `.btn`, `.form-input`, `.form-label` into individual component modules.
**Why bad:** Creates import coupling — `AppCard` would need to import from `AppForm.module.css`
for shared input styles. Breaks the single-responsibility of a CSS module.
**Instead:** Keep shared primitives in `globals.css`. Scope only component-specific classes.

### Anti-Pattern 2: Moving File I/O Into the CSV Utility

**What:** Putting `FileReader`, `Blob`, `URL.createObjectURL`, anchor `.click()` into `csv.ts`.
**Why bad:** Makes the utility untestable in Vitest (JSDOM has partial support; Blob/anchor
behavior is fragile). Pure data functions are trivially testable.
**Instead:** `csv.ts` handles text-in/text-out. App.tsx orchestrates the IO wrapper.

### Anti-Pattern 3: Testing Implementation Details

**What:** Writing tests that assert on internal hook state variables or component internals.
**Why bad:** Tests break on refactor even when behavior is preserved, creating maintenance
drag exactly when the code is changing most.
**Instead:** Test observable behavior — rendered output, user interactions, returned values.
For `useJobApps`, test that calling `addApp` makes the new app appear in the returned array;
don't assert on whether `persist` was called.

### Anti-Pattern 4: Refactoring Features and Code Quality Simultaneously

**What:** Using CSS Modules migration as an opportunity to also change layout, add new
classNames, or restructure components beyond what scoping requires.
**Why bad:** Introduces regression risk; blurs the diff; makes rollback harder.
**Instead:** Each refactoring task should be behavior-preserving. The CSS migration output
must be visually identical to the current global-CSS output.

---

## Suggested Build Order (Phase Dependencies)

The four refactoring tasks have a dependency graph that dictates safe sequencing:

```
Step 1: Fix useJobApps stale closures
    No dependencies. Self-contained hook change.
    Required first: tests written later will assert on correct behavior.
    Risk if deferred: any test written against current hook behavior tests the bug.

Step 2: Extract CSV utilities (src/utils/csv.ts)
    Depends on: nothing (pure extraction, no hook or CSS changes needed).
    Enables: CSV unit tests in Step 3.
    App.tsx importCSV and exportCSV shrink significantly.

Step 3: Add test coverage
    Depends on: Steps 1 and 2 (test correct hook behavior, test extracted CSV).
    Do in this order within Step 3:
      a. csv.test.ts — no React, fastest feedback loop
      b. useJobApps.test.ts — renderHook, verifies Step 1 fix
      c. Component tests — AppForm, AppCard, Feedback, Badge
    Do NOT write hook tests before Step 1 (would encode the stale-closure bug).

Step 4: CSS Modules migration
    Depends on: nothing technically, but safest last.
    Rationale: tests from Step 3 provide regression safety net for the rename-heavy
    className changes. Doing CSS migration before tests means any typo in a className
    rename has no automated catch.
    Order within Step 4:
      a. Create globals.css, move shared primitives, verify build
      b. Migrate leaf components first (Badge, Feedback, Stats — small, few classes)
      c. Migrate mid-complexity components (Filters, AppList, AppCard)
      d. Migrate large components (AppForm, SetupWizard, Header)
      e. Remove App.css import, verify nothing broke
```

**Dependency matrix:**

| Task | Blocks | Blocked by |
|------|--------|------------|
| Fix useJobApps closures | — | — |
| Extract CSV utilities | — | — |
| Add tests | — | Closure fix (for hook tests), CSV extract (for csv tests) |
| CSS Modules migration | — | Tests (for regression safety) |

The two most independent tasks (closure fix, CSV extract) can be done in either order
or in parallel branches. Tests and CSS Modules must follow.

---

## Scalability Considerations

These are Chrome extension constraints, not scale concerns in the traditional sense.
The popup loads everything synchronously; bundle size and startup time matter more
than server-side throughput.

| Concern | Current | After Refactor | Notes |
|---------|---------|----------------|-------|
| Bundle size | Single JS file | Same | CSS Modules add no runtime overhead — compiled to atomic classnames by Vite |
| CSS output | Single `main.css` | Single `main.css` | Vite merges all `.module.css` into one file per `assetFileNames` config |
| Test startup | No tests | Vitest (~200ms cold start) | Dev-only, no extension impact |
| Storage serialization | `JSON.parse/stringify` | Same | No change — under 1000 apps, negligible |
| Memory (stale closure) | Risk on rapid mutations | Fixed in Step 1 | Functional updater pattern prevents double-persistence bugs |

---

## Cross-Cutting Concerns for the Refactor

**CSS Custom Properties**: `:root` variables (`--card-bg`, `--border`, `--text-primary`, etc.)
defined in `globals.css` are global by nature — they are not scoped to modules. CSS Modules
do not need to wrap them; any component can reference `var(--accent)` directly.

**`isExtension` check in Header**: Header.tsx reimplements an `isExtension` check inline
(`chrome.runtime && chrome.runtime.sendMessage`) rather than reusing the one in `storage.ts`.
This is a minor inconsistency; note it but do not fix it in this milestone (out of scope —
behavior-preserving only).

**`genId()` in AppForm**: AppForm imports `genId` from constants.ts but also receives
an `editing` prop. The ID is only used as a fallback for new apps. This is a minor redundancy
(App.tsx also calls `genId()` in `handleFormSubmit`) — do not change in this milestone.

**Feedback merging in App.tsx**: `const feedbackMsg = webhook.syncMsg || scanMsg` — this
coercion means only one feedback message shows at a time. This is intentional behavior;
CSS Modules migration must preserve the single `<Feedback message={feedbackMsg} />` pattern.

---

## Sources

All findings are HIGH confidence — derived from direct inspection of source files:

- `/Users/stephenkang/Desktop/job-tracker-vite/src/App.tsx` — God component structure, CSV logic location, all callbacks
- `/Users/stephenkang/Desktop/job-tracker-vite/src/hooks/useJobApps.ts` — Stale closure pattern confirmed at lines 22-40
- `/Users/stephenkang/Desktop/job-tracker-vite/src/hooks/useWebhook.ts` — Webhook state and syncToSheets
- `/Users/stephenkang/Desktop/job-tracker-vite/src/App.css` — All 320 lines global; class distribution across components mapped
- `/Users/stephenkang/Desktop/job-tracker-vite/src/utils/constants.ts` — Pure utilities confirmed (STATUS_MAP, genId, emptyForm)
- `/Users/stephenkang/Desktop/job-tracker-vite/src/utils/storage.ts` — Storage abstraction layer
- `/Users/stephenkang/Desktop/job-tracker-vite/vite.config.ts` — Single bundle constraint confirmed (`manualChunks: undefined`)
- Individual components: Header, AppCard, AppForm, Badge (className usage patterns confirmed)
- `.planning/codebase/ARCHITECTURE.md` — Data flow confirmed against code

---

*Architecture analysis: 2026-03-18*
