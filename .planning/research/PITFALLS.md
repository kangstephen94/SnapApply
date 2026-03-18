# Domain Pitfalls

**Domain:** React/TypeScript Chrome extension — code quality refactoring
**Researched:** 2026-03-18
**Scope:** CSS Modules migration, Vitest setup, utility extraction, stale closure fix

---

## Critical Pitfalls

Mistakes that cause regressions, data loss, or full rereworks.

---

### Pitfall 1: CSS Modules Break Global Selectors Used by Multiple Components

**What goes wrong:** `App.css` uses global class names like `.btn`, `.card`, `.form-input`, `.badge`, `.empty`. These are used by many components via `className="card"`, `className="btn btn-primary"`, etc. When migrating to CSS Modules, a developer creates per-component `.module.css` files but forgets that some classes are intentionally shared across components — the `button` base styles, the `.empty` state, the `.badge` base. After moving `.btn` into `Button.module.css`, any component that renders a button but imports a different module will silently get unstyled buttons because the class name is now hashed.

**Why it happens:** CSS Modules scope every class name to its importing file. A class defined in `AppCard.module.css` compiles to `AppCard_card__x3k2p`. If `AppList.tsx` also needs `.card`, it cannot just reference `AppCard.module.css`'s hashed name.

**Consequences:** Invisible style regressions. Elements lose their styles with no TypeScript or console error. Only caught visually. The extension popup may look completely broken.

**Specific risk in this codebase:**
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-sm`, `.btn-danger`, `.btn-icon` are rendered across `Header.tsx`, `AppCard.tsx`, `AppForm.tsx`, `SetupWizard.tsx`, `Filters.tsx`
- `.empty` is rendered by both `AppList.tsx` and `App.tsx`
- `.badge` base styles are in `App.css`; dynamic `style=` overrides color/bg per status — the base layout must survive migration

**Prevention:**
- Keep a `global.css` (or `base.css`) for truly shared classes: `body`, `:root` custom properties, `.btn` base, `.empty`
- Create component-scoped modules only for classes private to that component
- When a class is used in two or more components, it belongs in global scope — not in either component's module
- Run a visual regression check (screenshot before and after each component migration) before moving to the next

**Detection:** After migrating each component's module, load the extension popup and visually inspect every interactive state. Any unstyled element signals a missing global class.

**Phase:** CSS Modules migration

---

### Pitfall 2: The Stale Closure Fix Introduces a New Bug in `persist`

**What goes wrong:** The planned fix is to use functional update form: `setApps(prev => ...)` inside `addApp`, `updateApp`, `deleteApp`. However, `persist` is the shared function that both calls `setApps` AND calls `Storage.set`. If `persist` is refactored naively to accept a function argument instead of a value, the `Storage.set` call will be given the wrong snapshot — it will be called with `prev` before React batches the update, meaning storage may receive a stale array.

**Specific code at risk (`useJobApps.ts:16-19`):**
```ts
const persist = useCallback(async (next: JobApp[]) => {
  setApps(next);
  await Storage.set('job-apps', JSON.stringify(next));
}, []);
```

If the fix is applied as `setApps(prev => [...])` without also ensuring `Storage.set` receives the final computed array, the in-memory state and persisted storage diverge.

**Consequences:** Data written to `chrome.storage.local` / `localStorage` is one update behind. The next page load reads stale data. On rapid sequential operations (deleting multiple items quickly), deletions are silently lost.

**Why it happens:** `setApps` is asynchronous in the sense that React batches it — but `Storage.set` must receive the computed next value synchronously in the same operation. The functional update form `prev => next` only gives you `next` inside the setter callback, not outside it.

**Prevention:** The correct pattern is to compute the next array inline, then pass it to both `setApps` and `Storage.set`:
```ts
const addApp = useCallback((app: JobApp) => {
  setApps(prev => {
    const next = [app, ...prev];
    Storage.set('job-apps', JSON.stringify(next)); // called inside setter
    return next;
  });
}, []); // no `apps` dependency — closure-free
```
This is the only pattern that satisfies both requirements: React gets the functional updater (stale-closure-safe), and storage gets the computed value.

**Detection:** Write a Vitest test that calls `addApp` three times in rapid succession without awaiting, then asserts the stored value contains all three entries. If it fails, the fix is incomplete.

**Phase:** Stale closure fix (useJobApps hook)

---

### Pitfall 3: Vitest Cannot Import `chrome` Global — Tests Fail Before Running

**What goes wrong:** `src/utils/storage.ts` evaluates `typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local` at module load time (line 1-4). When Vitest imports any file that directly or transitively imports `storage.ts`, it runs this check in jsdom/Node, where `chrome` is undefined. So far, no crash — the check passes as `false`. But any test that imports a hook (`useJobApps`, `useWebhook`) will also exercise the mock boundary. More critically, `Header.tsx` references `chrome.runtime.sendMessage` directly in component code (not behind an import-time guard). Vitest will throw `ReferenceError: chrome is not defined` when rendering `Header`.

**Specific components with direct `chrome` usage:**
- `Header.tsx:31` — `typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage`
- `Header.tsx:40` — `chrome.runtime.sendMessage({ type: 'SCAN_PAGE' }, ...)` — called at runtime

**Consequences:** Without a `chrome` global mock, any test that renders `Header` (or any parent component) crashes immediately. Tests for `App.tsx` become impossible unless `Header` is either mocked or the chrome global is polyfilled.

**Prevention:**
1. Add a Vitest setup file (`vitest.setup.ts`) that defines a minimal `chrome` global mock before tests run:
   ```ts
   global.chrome = {
     storage: { local: { get: vi.fn(), set: vi.fn() } },
     runtime: { sendMessage: vi.fn() },
   } as unknown as typeof chrome;
   ```
2. Configure `vitest.config.ts` to reference the setup file: `setupFiles: ['./vitest.setup.ts']`
3. Prefer testing hooks and utilities in isolation (not through full component renders) to limit chrome API surface

**Detection:** Run `npx vitest run` on any file that imports a hook. If output contains `ReferenceError: chrome is not defined` or `Cannot read properties of undefined (reading 'storage')`, the global mock is missing.

**Phase:** Vitest setup

---

### Pitfall 4: CSS Module File Naming Breaks Build on Case-Sensitive File Systems

**What goes wrong:** macOS uses a case-insensitive file system by default. A developer creates `AppCard.module.css` and imports it as `import styles from './appcard.module.css'` — this works locally but fails in any Linux CI environment (and on any case-sensitive volume). Conversely, creating `app-card.module.css` but importing it as `AppCard.module.css` has the same problem in reverse.

**Why it matters here:** There is no CI pipeline yet (out of scope for this milestone), but the naming convention is established now and will be hard to fix later. The build artifacts are committed (`build/` is in the repo), suggesting the developer may build locally and commit — making consistency critical.

**Prevention:** Use PascalCase module filenames matching the component file exactly: `AppCard.tsx` imports `./AppCard.module.css`. Establish this as the convention in `CONVENTIONS.md` before writing the first module file.

**Detection:** Import paths that differ from the component filename in case are the warning sign. Grep for `import styles from './` and verify each module filename matches its component's case exactly.

**Phase:** CSS Modules migration

---

## Moderate Pitfalls

---

### Pitfall 5: Extracting CSV Logic Breaks the `importApps` Stale Closure

**What goes wrong:** `importCSV` in `App.tsx` closes over `importApps` from `useJobApps`. After the stale closure fix is applied to `useJobApps`, `importApps` will also need the same functional-update treatment:
```ts
const importApps = useCallback(
  (newApps: JobApp[]) => persist([...newApps, ...apps]),
  [apps, persist]
);
```
This still closes over `apps`. If the CSV utility extraction is done first (Phase 1) and the stale closure fix is done later (Phase 2 or 3), tests written in Phase 1 for the extracted CSV utility will pass — but the integration between `importCSV` and `importApps` will still be broken until Phase 3. The test suite will give false confidence.

**Prevention:** Fix `importApps` at the same time as `addApp`/`updateApp`/`deleteApp`. Treat all `useJobApps` callbacks as a single atomic change. Do not commit a partial fix.

**Detection:** A test that calls `importApps` twice in succession and asserts both sets are merged correctly will catch this if the second call overwrites the first.

**Phase:** Stale closure fix

---

### Pitfall 6: Testing the `storage.ts` Dual-Path Without Isolating the Module-Level Side Effect

**What goes wrong:** `const isExtension = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local` runs once when the module is first imported. If the chrome mock is set up in `vitest.setup.ts` as a global, the `isExtension` check may cache `true` for all tests in a session. A test that expects `localStorage` behavior (non-extension path) will fail because `isExtension` was already evaluated as `true` from the mock.

**Consequences:** It becomes impossible to test the localStorage fallback path without module isolation or resetting the mock between test files.

**Prevention:** Use `vi.resetModules()` before tests that need to test the non-extension storage path, or restructure `storage.ts` to check `isExtension` lazily (inside the `get`/`set` functions rather than at module load time). The lazy check is also the correct long-term fix per CONCERNS.md.

**Detection:** A test checking that `Storage.get` uses `localStorage` when `chrome` is absent will still pass when it should fail if the module was already evaluated with the chrome mock in scope.

**Phase:** Vitest setup and utility testing

---

### Pitfall 7: CSS Custom Properties (`--card-bg`, `--border`, etc.) Must Stay in Global Scope

**What goes wrong:** During CSS Modules migration, a developer moves `:root { --card-bg: ...; --border: ... }` into a component module file because it appears near the top of `App.css`. CSS custom properties defined in a CSS Module file are not globally available — they are scoped to the component's generated selector. Every component that uses `var(--card-bg)` or `var(--border)` will fall back to the browser default (usually transparent or inherited) and the design system collapses.

**Consequences:** The entire visual design breaks silently. All components using CSS custom properties lose their colors and borders simultaneously. This is catastrophic — it affects every component at once.

**Prevention:** Keep the `:root { }` block with all custom properties in a non-module global file (e.g., `src/globals.css` or `src/index.css`), imported in `main.tsx` rather than in any component. This file must not be renamed with `.module.css`.

**Detection:** After migration, if `var(--card-bg)` resolves to `transparent` in DevTools, the `:root` block was moved into a module.

**Phase:** CSS Modules migration — first action, before any component migration

---

### Pitfall 8: `useCallback` Deps Arrays Break After Functional Update Refactor

**What goes wrong:** `App.tsx`'s `handleFormSubmit` depends on `[editing, addApp, updateApp]`. After the stale closure fix removes `apps` from `addApp` and `updateApp`'s deps arrays, those functions become stable (same reference across renders). This is good — but if a developer enables `eslint-plugin-react-hooks` (likely during this milestone since no linting exists yet), the linter will report that the now-stable `addApp`/`updateApp` could be removed from `handleFormSubmit`'s deps. Removing them is correct — but only after the hook is fixed. Removing them before the fix will cause the stale closure problem to manifest in the consumer, not the hook.

**Prevention:** Apply the hook fix first, verify tests pass, then address any `react-hooks/exhaustive-deps` warnings in consumers. Never adjust consumer deps arrays to silence lint warnings without understanding why the warning exists.

**Detection:** If the `react-hooks/exhaustive-deps` rule fires on `handleFormSubmit` in `App.tsx` and `addApp` appears in the deps array, this is the warning sign that the refactor may be partially done.

**Phase:** Stale closure fix, then linting setup

---

### Pitfall 9: Vitest `jsdom` Environment Missing `URL.createObjectURL` — Export CSV Tests Fail

**What goes wrong:** `exportCSV` in `App.tsx` calls `URL.createObjectURL(blob)` and `link.click()`. jsdom (Vitest's default environment) does not implement `URL.createObjectURL` — it throws `TypeError: URL.createObjectURL is not a function`. Tests that render the full `App` component and trigger export will fail before any assertion runs.

**Consequences:** Either the CSV export utility cannot be tested at all, or developers add a brittle workaround that tests the implementation detail rather than the behavior.

**Prevention:** After extracting `exportCSV` to a utility module, test only the pure transformation logic (the array-to-CSV-string conversion), not the browser download mechanism. Mock `URL.createObjectURL` only for integration tests that specifically cover the download path:
```ts
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();
```
Do not attempt to test `link.click()` behavior in jsdom.

**Detection:** Test output shows `TypeError: URL.createObjectURL is not a function` when any test imports or exercises the export function.

**Phase:** CSV utility extraction and Vitest setup

---

### Pitfall 10: Migrating CSS File-by-File Without a Clear Ownership Map

**What goes wrong:** `App.css` contains styles for every component, but ownership is not 1:1. Some classes like `.wizard-*` clearly belong to `SetupWizard.tsx`. Others like `.btn-*` are used everywhere. Without a pre-migration map of "which classes are used where", a developer migrates `AppCard.module.css`, moves `.card-*` classes in, deletes them from `App.css` — then discovers `App.tsx` also uses `className="empty"` which was located near the `.card-*` block and got deleted accidentally.

**Consequences:** Silent style regression on the `loading` state in `App.tsx:180` which uses `className="empty"`. The loading spinner disappears with no error.

**Prevention:** Before writing any `.module.css` file, grep every class name in `App.css` against the component files and produce a class-to-component ownership table. Only migrate classes that are used in exactly one component. Explicitly mark shared classes as "global, do not move".

**Detection:** Running a CSS coverage report (Chrome DevTools Coverage tab) before and after migration will show which rules are used. Any rule that was used before but is unused after is a regression.

**Phase:** CSS Modules migration — planning step before first file is created

---

## Minor Pitfalls

---

### Pitfall 11: `noUnusedLocals: false` Hides Dead Variables After Extraction

**What goes wrong:** When `importCSV` and `exportCSV` are extracted from `App.tsx`, any helper variables or intermediate values left behind in `App.tsx` will not cause TypeScript errors because `noUnusedLocals` is disabled. Dead code can accumulate silently.

**Prevention:** Enable `noUnusedLocals: true` and `noUnusedParameters: true` in `tsconfig.json` as part of this milestone. Clean up any resulting errors before merging. This is documented as tech debt in CONCERNS.md.

**Detection:** Run `tsc --noUnusedLocals` to surface unused variables. This is the correct time to enable the flag since the extraction makes previously-used variables unused.

**Phase:** CSV utility extraction — enable TS strictness after extraction is complete

---

### Pitfall 12: Magic String `'Applied'` Reappears in Extracted CSV Utility

**What goes wrong:** The CSV parser in `App.tsx:133` uses the fallback `|| 'Applied'` for rows with no status column. When this logic is extracted to a utility, it is easy to copy the magic string along with it. CONCERNS.md already flags hardcoded status strings as tech debt. Extraction is the ideal moment to replace `'Applied'` with `ALL_STATUSES[0]` or a named constant — but only if `ALL_STATUSES` is already defined (it is, in `constants.ts`).

**Prevention:** When writing the extracted `parseCSV` utility, import `ALL_STATUSES` from `constants.ts` and use `ALL_STATUSES[0]` as the fallback status. Document the dependency explicitly in the utility's JSDoc.

**Detection:** Grep the extracted utility file for the string `'Applied'` after writing it. Any literal occurrence is a missed constant.

**Phase:** CSV utility extraction

---

### Pitfall 13: `FileReader` Tests Are Async — Easy to Write a Test That Always Passes

**What goes wrong:** `FileReader.onload` is event-driven and asynchronous. A Vitest test that calls `importCSV(file)` and immediately asserts `importApps` was called will always pass — because the assertion runs before `onload` fires. jsdom's `FileReader` implementation requires the test to either await a promise or use `waitFor` from React Testing Library to observe the state change.

**Consequences:** The test suite shows green but provides no coverage. The CSV parser is untested despite appearing to be tested.

**Prevention:** After extracting CSV parsing to a pure function that takes a string and returns `JobApp[]`, test the pure function directly — no `FileReader` involved. Only test `FileReader` interaction at the integration level using `waitFor` or polling.

**Detection:** A test that passes in under 1ms when testing `FileReader`-based logic is almost certainly not waiting for the async callback.

**Phase:** CSV utility extraction and Vitest coverage

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| CSS Modules migration start | `:root` custom properties moved into a module file | Create `globals.css` as the first action, before any component migration |
| CSS Modules migration (shared classes) | `.btn`, `.empty`, `.badge` copied to multiple modules, creating drift | Establish global classes list before migrating any component |
| CSS Modules migration (ownership) | Classes deleted from `App.css` without verifying all usage sites | Grep-based ownership map before any deletion |
| Stale closure fix | `Storage.set` receives stale data because fix only updates `setApps` | Compute `next` array once, pass to both `setApps` and `Storage.set` |
| Stale closure fix scope | `importApps` not included in the fix | Fix all four callbacks (`addApp`, `updateApp`, `deleteApp`, `importApps`) atomically |
| Vitest setup | `chrome` global missing, all component tests crash | Add `vitest.setup.ts` with chrome mock as the first Vitest task |
| Vitest setup | `isExtension` evaluated at module load time breaks storage path isolation | Refactor `storage.ts` to lazy-evaluate the extension check |
| Vitest setup | `URL.createObjectURL` missing in jsdom breaks export tests | Mock or test only the pure transformation, not the browser download |
| CSV extraction | Magic string `'Applied'` copied into utility | Import and use `ALL_STATUSES[0]` constant in extracted utility |
| CSV extraction | `FileReader` tests give false confidence | Test the pure `parseCSV(text: string)` function directly, not the `FileReader` wrapper |
| TS strictness | Dead code from extraction accumulates silently | Enable `noUnusedLocals`/`noUnusedParameters` after extraction, fix all errors |

## Sources

- Direct codebase analysis: `/Users/stephenkang/Desktop/job-tracker-vite/src/` (all hooks, components, utilities)
- Known issues: `.planning/codebase/CONCERNS.md`
- Project constraints: `.planning/PROJECT.md`
- React 18 `useState` functional update semantics: training data (HIGH confidence — core API, stable since React 16)
- CSS Modules scoping behavior in Vite: training data (HIGH confidence — fundamental CSS Modules spec)
- Vitest jsdom environment limitations: training data (MEDIUM confidence — jsdom behavior with browser APIs is well-documented but version-dependent)
- `isExtension` module-load-time evaluation risk: direct code inspection (HIGH confidence)
