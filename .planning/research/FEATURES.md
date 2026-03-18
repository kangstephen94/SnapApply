# Feature Landscape

**Domain:** Code quality refactoring — React 18 + TypeScript Chrome extension
**Researched:** 2026-03-18
**Confidence:** HIGH (based on direct codebase inspection + domain knowledge of React/TS refactoring patterns)

---

## Table Stakes

Features users (maintainers) expect from a refactoring milestone. Missing any of these and the codebase still feels fragile or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Extract CSV logic to utility module | ~100 lines of parse/export are buried in App.tsx. Untestable, unreusable. Every refactor project extracts pure functions. | Low | `parseCSV`, `exportCSV`, `buildColMap` are all pure — no React deps needed. Straightforward extraction. |
| Fix stale closure in useJobApps | `addApp`, `updateApp`, `deleteApp`, `importApps` all close over `apps` state directly. Rapid sequential calls (import 50 rows) can lose updates. This is a latent data-loss bug, not just style. | Low | Switch all four callbacks to `setApps(prev => ...)` functional update pattern. Removes `apps` from deps arrays. One-pass change. |
| Enable `noUnusedLocals` and `noUnusedParameters` | Both are explicitly disabled in `tsconfig.json:19-20`. With `strict: true` already set, leaving these off is a gap. Dead code accumulates silently. | Low | Enable both flags, fix any resulting errors. Likely a handful of fixes in App.tsx and hooks. |
| Add ESLint with React-specific rules | Zero linting configuration exists. No eslint.config.*, no `.eslintrc`. Magic string status values, callback best-practice violations, and dead code would be caught automatically. | Low-Med | Use `@eslint/js` + `eslint-plugin-react-hooks` + `typescript-eslint`. The react-hooks plugin catches the exact stale-closure pattern in useJobApps. |
| Add Prettier for consistent formatting | No formatter configured. Mixed indentation and quote styles will drift as the codebase grows. Linting and formatting are a paired baseline. | Low | `.prettierrc` with project-agreed settings (single quotes, 2-space, trailing commas). Add `format` script to package.json. |
| Vitest test infrastructure setup | No test runner, no test files. Before writing any tests, the runner must be installed and configured to work with Vite + Chrome extension environment (jsdom, chrome mock). | Low-Med | `vitest.config.ts` with `jsdom` environment, `setupFiles` for chrome globals mock. This is the precondition for all test-writing work. |
| Tests for CSV parsing logic | CSV parser has custom quote-handling and fuzzy header detection. It is the most complex pure function in the codebase and has multiple known edge cases (ambiguous column names like `update_date`, empty rows, missing required columns). | Med | Write after extraction. Requires testing: happy path, missing required columns, quoted fields, empty file, ambiguous headers, partial rows. |
| Tests for useJobApps hook | Core data mutation hook. Currently has a data-loss bug. Tests enforce the correct `prev =>` functional update behavior and prevent regression after the stale closure fix. | Med | Use `renderHook` from React Testing Library. Needs chrome storage mock. Test: add, update, delete, import, persistence round-trip. |
| Replace magic status strings with constants | `'Applied'` appears as a literal string in App.tsx line 133, useWebhook.ts line 35, and elsewhere. `ALL_STATUSES` and `STATUS_MAP` already exist in constants.ts but aren't used consistently. | Low | Audit all files with `grep 'Applied\|Rejected\|Interviewing'`. Replace literals with `ALL_STATUSES[0]` or a named constant. One-time search-and-replace. |
| CSS Modules migration | Single 400-line App.css with no scoping. Class names are global strings — any rename risks breakage, any new component can silently collide. CSS Modules are supported by Vite natively with zero config. | Med | Rename `App.css` → `App.module.css`, update imports, rename any colliding selectors. Do per-component in sequence. Largest risk is the 400-line monolith needing decomposition. |

---

## Differentiators

Features that go beyond baseline hygiene. Not expected for a refactoring milestone, but add lasting value if included.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| React Error Boundary | Currently no crash containment. A render error in AppCard destroys the entire popup. An error boundary wrapping AppList lets the user still access the form and settings. Addresses a documented gap in CONCERNS.md. | Low | Single `ErrorBoundary` class component, wrap `<AppList>`. Not a new feature — it's crash-resilience infrastructure. Low complexity, high payoff. |
| Memoize filter/search computation | `AppList` receives `apps`, `filter`, and `search` as props. The filtered list is recomputed on every render. With `useMemo` in AppList (or App.tsx), the sort/filter only reruns when the relevant inputs change. | Low | `useMemo(() => filteredApps, [apps, filter, search])`. Single change, measurable render reduction. Pairs naturally with the hook refactor. |
| Centralize feedback timeout constants | `4000` and `5000` hardcoded in App.tsx (three locations) and `useWebhook.ts:103`. Scattered magic numbers. A single `FEEDBACK_TIMEOUT_MS = 4000` in constants.ts eliminates the drift risk. | Low | Four-line change across two files. Extremely low risk. Good signal that constants.ts is the right home for shared values. |
| URL validation helper | AppForm accepts any string for URL with no validation. A `isValidUrl(s: string): boolean` utility is a pure function, easily testable, and prevents malformed data from reaching storage. Does not change UI. | Low | Simple URL constructor check: `try { new URL(s); return true } catch { return false }`. Add to utils, call in form submit handler. |
| Tests for storage adapter | `storage.ts` has a dual-path branch (`isExtension` flag evaluated at module load). The localStorage path is easily testable with jsdom. The chrome path needs a mock. A storage test validates the abstraction layer that all hooks depend on. | Med | Requires a `chrome.storage.local` mock in vitest setup. Tests: get, set, missing key returns null, round-trip. |

---

## Anti-Features

Things to deliberately NOT build in this milestone. Including them would scope-creep the refactor into a feature milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| New UI components or redesign | Refactoring milestone's success criterion is "app works identically." Any visual change introduces risk and distraction. | CSS Modules migration should preserve all class names and visual behavior exactly. Run a visual diff check before/after. |
| State management library (Redux, Zustand, Jotai) | PROJECT.md explicitly rules this out. useJobApps + useState in App is the correct scope for this app's complexity. Adding a library adds bundle size and migration cost for no functional gain. | Functional update pattern (`setApps(prev => ...)`) fixes the real problem without introducing new dependencies. |
| Tailwind or other CSS utility frameworks | PROJECT.md explicitly rules this out. Vite CSS Modules solve the scoping problem without new dependencies or a class-name paradigm shift. | CSS Modules. Already decided. |
| List virtualization | A real performance concern for 1000+ rows. But it is a feature addition, not a refactor — requires a new library (react-window or react-virtual) and changes the AppList render model. | Flag as a future milestone concern in PITFALLS or ARCHITECTURE research. |
| Undo on delete | Architectural gap noted in CONCERNS.md. Implementing it requires state shape changes (a "deleted" bin or history stack) that go beyond code quality work. | Out of scope. Mark as a follow-on milestone task. |
| CI/CD pipeline | PROJECT.md explicitly rules this out as out-of-scope. CI setup introduces external service configuration (GitHub Actions, etc.) that belongs in a DevOps milestone. | Local test infrastructure only (`npm test`, `npm run lint`). |
| Async CSV parsing / Web Worker | The main-thread blocking issue is real but minor at typical job application volumes (< 500 rows). Fixing it requires a Worker setup that changes the build configuration. | Not a code quality fix — it is a performance feature. Flag for a future performance milestone. |
| Error handling improvements for webhook | Rate limiting, retry queue, and offline mode are architectural additions. The stale closure fix and test coverage are the right refactoring scope for the webhook hook. | Limit webhook work to: fixing closure pattern, adding a test for syncToSheets. |

---

## Feature Dependencies

```
ESLint setup → (can catch) stale closure pattern before manual fix
Vitest setup → CSV extraction (tests require runner exists first)
Vitest setup → useJobApps tests (runner + chrome mock required first)
CSV extraction → CSV tests (tests require extracted module)
Stale closure fix → useJobApps tests (tests should validate the fixed behavior)
noUnusedLocals enabled → may surface dead code in App.tsx requiring cleanup
CSS Modules migration → no dependency on other items, can run in parallel
```

**Critical path:** Vitest setup is the prerequisite for all test-writing. ESLint setup is the prerequisite for enforcing standards in subsequent changes. Both should land first.

**Can run in parallel:**
- ESLint + Prettier setup (tooling)
- TypeScript strictness fixes (compiler flags)
- Magic string consolidation (constants audit)
- CSS Modules migration (style scoping)

**Must be sequential:**
1. Vitest infrastructure configured
2. CSV logic extracted to utility
3. CSV tests written against the utility
4. Stale closure fix applied
5. useJobApps tests written against the fixed hook

---

## MVP Recommendation

A lean pass that restores trust and enables future work:

**Do first (unblocks everything else):**
1. Vitest setup with chrome mock
2. ESLint + Prettier configuration
3. Enable `noUnusedLocals` / `noUnusedParameters`

**Core refactors:**
4. Extract CSV logic to `src/utils/csv.ts`
5. Fix stale closure in useJobApps with functional updates
6. Replace magic status strings with constants

**Test coverage:**
7. CSV utility tests
8. useJobApps hook tests

**Style isolation:**
9. CSS Modules migration (per-component, in sequence)

**Reasonable additions (low complexity, high value):**
10. React Error Boundary wrapping AppList
11. Memoize filter/search computation
12. Centralize feedback timeout constants

**Defer to next milestone:**
- URL validation (not a code quality issue, it is feature behavior)
- Storage adapter tests (lower priority than hook/utility tests)
- List virtualization, undo on delete, CI/CD

---

## Sources

- Direct codebase inspection: `src/App.tsx`, `src/hooks/useJobApps.ts`, `src/utils/constants.ts`, `src/utils/storage.ts`, `src/types.ts`, `tsconfig.json`, `vite.config.ts`
- Project constraints: `.planning/PROJECT.md`
- Known issues: `.planning/codebase/CONCERNS.md`
- Domain knowledge: React 18 functional update pattern, Vitest/RTL testing conventions, ESLint flat config (eslint v9+), CSS Modules in Vite (no config required)
