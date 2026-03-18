# Technology Stack

**Project:** Job Tracker Chrome Extension — Code Quality Milestone
**Researched:** 2026-03-18
**Note:** All external tools (WebSearch, WebFetch, Context7) were unavailable during this research session. Version recommendations are based on training data through August 2025 and ecosystem patterns known to be stable. Versions MUST be validated before installation.

---

## Recommended Stack (Additions Only)

This milestone adds dev tooling to the existing Vite 5.4.21 + React 18.2.0 + TypeScript 5.9.3 stack. No runtime dependencies are added. All additions are devDependencies or zero-config Vite built-ins.

### Testing Framework

| Technology | Version (verify) | Purpose | Why |
|------------|------------------|---------|-----|
| vitest | ^2.x | Test runner | Native Vite integration — shares vite.config.ts, no separate Babel config, runs in the same ESM context as the app. Significantly faster startup than Jest. Same `describe/it/expect` API means no new mental model. |
| @vitest/ui | ^2.x | Browser-based test UI | Optional but highly recommended for navigating test results during active development. |
| @testing-library/react | ^16.x | Component rendering + querying | The standard for React component tests. Works with Vitest via jsdom. Queries by accessible role/text rather than implementation details, producing tests that survive refactoring. |
| @testing-library/user-event | ^14.x | Simulated user interactions | Simulates real browser events (mousedown → mouseup → click) unlike `fireEvent`. Required for accurate form interaction tests. Use v14.x (async API) not v13 (sync). |
| @testing-library/jest-dom | ^6.x | DOM assertion matchers | Extends Vitest's expect with matchers like `toBeInTheDocument()`, `toHaveValue()`, `toBeDisabled()`. Works with Vitest via a single setup file import. |
| jsdom | ^25.x | DOM environment for tests | Vitest's default environment for browser-like tests. Simulates `document`, `window`, `localStorage`. Required for React component rendering in Node. |

**Confidence:** MEDIUM — The package names and major version ranges are correct based on training data. Exact patch versions need `npm show [package] version` verification before pinning.

### CSS Scoping

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| CSS Modules | Built into Vite | Per-component style scoping | Zero additional dependencies. Vite processes any file ending in `.module.css` automatically. Class names get hashed at build time (`styles.card` → `card_a1b2c3`). The existing CSS custom properties (design tokens in `:root`) continue to work globally — only component-level classes get scoped. |

**Confidence:** HIGH — CSS Modules have been first-class in Vite since v1. No version to track. Configuration-free.

### Linting and Formatting (Supporting)

These are not in scope per PROJECT.md, but the codebase currently has no ESLint or Prettier. The milestone focuses on tests and CSS Modules. These are listed here as "available when ready" rather than "install now."

| Technology | Version (verify) | Purpose | Why |
|------------|------------------|---------|-----|
| eslint | ^9.x | Static analysis | v9 ships the new flat config (`eslint.config.js`). The codebase uses `.tsx` + TypeScript strict, so `@typescript-eslint` integration is the expected companion. |
| prettier | ^3.x | Code formatting | The existing style (2 spaces, semicolons, single quotes) is consistent enough to formalize with Prettier. |

**Confidence:** MEDIUM — Out of scope for this milestone. Listed for awareness only.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Test runner | Vitest | Jest | Jest requires Babel transform for ESM + TypeScript. Vite already handles both. Vitest reuses vite.config.ts directly, making `import.meta.env`, path aliases, and plugins available in tests with no extra config. |
| Test runner | Vitest | Playwright (component tests) | Playwright component tests are excellent but overkill for unit-level utility function tests and hook behavior tests. This codebase's primary test targets (CSV parser, storage utils, stale closure fix) are unit-level concerns. |
| DOM environment | jsdom | happy-dom | happy-dom is faster but has less complete spec coverage. jsdom is the safe default for projects with `localStorage`, `FileReader`, and `Blob` — all of which the CSV import/export logic uses. |
| CSS scoping | CSS Modules | Tailwind CSS | Explicitly out of scope per PROJECT.md. Also a larger migration — every JSX element would need class name changes, and the existing design token system (CSS custom properties) would conflict with Tailwind's utility model. |
| CSS scoping | CSS Modules | styled-components | Adds a runtime dependency (packages > 12kb), requires a Babel plugin for SSR, and changes the programming model significantly. CSS Modules are zero-runtime and work with the existing CSS file structure. |
| CSS scoping | CSS Modules | vanilla-extract | Type-safe but requires a Vite plugin and changes the authoring model to TypeScript files. Overkill for a ~400-line CSS migration. |

---

## Vite Configuration Required

Vitest requires one addition to `vite.config.ts` — the `test` block. CSS Modules require no Vite config changes.

```typescript
// vite.config.ts addition
/// <reference types="vitest" />

export default defineConfig({
  // ... existing config unchanged ...
  test: {
    environment: 'jsdom',
    globals: true,              // makes describe/it/expect available without imports
    setupFiles: ['./src/test/setup.ts'],
    css: true,                  // processes CSS Modules in tests
    exclude: ['**/node_modules/**', '**/build/**'],
  },
})
```

**Why `globals: true`:** Removes the need to import `describe`, `it`, `expect`, `vi` in every test file. Standard practice for RTL-style tests. TypeScript needs `"types": ["vitest/globals"]` in tsconfig for type support.

**Why a setupFiles entry:** The `@testing-library/jest-dom` matchers must be imported once globally. The setup file is `src/test/setup.ts` containing:
```typescript
import '@testing-library/jest-dom';
```

---

## Chrome Extension Mocking Strategy

This is the critical constraint that differentiates this project from a standard React app. The `chrome` global does not exist in jsdom.

| Target | Mock Approach | Rationale |
|--------|--------------|-----------|
| `chrome.storage.local` | `vi.stubGlobal('chrome', mockChrome)` | The `storage.ts` module checks `typeof chrome !== 'undefined'` at module load. Stubbing the global before the module loads sets the execution path. Alternatively, import `storage.ts` after stubbing. |
| `localStorage` | Built into jsdom | The `storage.ts` localStorage path works in jsdom automatically. Testing via the localStorage path avoids needing a full `chrome` mock for most hook tests. |
| `FileReader` | jsdom provides FileReader | The CSV import's `FileReader.onload` will work in jsdom. Mock `File` objects can be constructed with `new File(['csv content'], 'test.csv', { type: 'text/csv' })`. |
| `fetch` | `vi.stubGlobal('fetch', vi.fn())` | The webhook hook calls `fetch`. Stub it per-test to simulate success/CORS failure scenarios. |
| `navigator.clipboard` | `vi.stubGlobal('navigator', ...)` | SetupWizard uses `navigator.clipboard.writeText`. Medium priority test target. |

**Confidence:** HIGH for the strategy pattern. MEDIUM for specific Vitest API calls — verify `vi.stubGlobal` availability in the installed version.

---

## CSS Modules Migration Notes

CSS Modules work by renaming `Component.css` to `Component.module.css` and changing the import in the component.

**Before:**
```css
/* App.css */
.card { ... }
```
```tsx
import './App.css';
<div className="card">
```

**After:**
```css
/* AppCard.module.css */
.card { ... }
```
```tsx
import styles from './AppCard.module.css';
<div className={styles.card}>
```

**Critical constraint for this project:** The existing `App.css` has global styles that must remain global:
- `:root { --card-bg: ...; }` — CSS custom properties must stay in a globally imported file (e.g., `src/styles/globals.css` imported in `main.tsx`)
- `body { width: 520px; }` — Chrome extension popup width constraint, must be global
- Font-face or Google Fonts `@import` declarations — must be global

Only component-scoped class selectors (`.card`, `.btn-primary`, `.form-input`) should migrate to CSS Modules. The migration is surgical, not a wholesale replacement.

**Build output compatibility:** Vite's CSS Module processing produces a single hashed CSS file at build time. The existing single `static/css/main.css` output bundle is preserved — CSS Modules do not change the output structure, only the class name hashing.

**Confidence:** HIGH — CSS Modules + Vite build output behavior is well-documented and stable.

---

## Installation

```bash
# Test infrastructure (all devDependencies)
npm install -D vitest @vitest/ui jsdom
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom

# CSS Modules — zero install, Vite built-in
# No packages to install
```

**Version validation before running:**
```bash
npm show vitest version
npm show @testing-library/react version
npm show @testing-library/user-event version
npm show @testing-library/jest-dom version
npm show jsdom version
```

**tsconfig.json addition required:**
```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

---

## What NOT to Install

| Package | Why Not |
|---------|---------|
| `babel-jest` or any `@babel/*` transform | Vite uses esbuild for TypeScript. Adding Babel to the test pipeline creates a second transformation layer that will fight with the existing Vite + TypeScript setup. |
| `ts-jest` | Same reason — designed for Jest, not Vitest. |
| `jest` | Vitest is the correct choice for this stack. Jest's jsdom integration and ESM support is significantly more configuration-heavy. |
| `@vitejs/plugin-react-swc` | The project uses `@vitejs/plugin-react` (Babel-based). Switching to the SWC variant is a separate decision and not needed for this milestone. |
| `styled-components` or `@emotion/react` | CSS-in-JS adds runtime overhead and conflicts with the project's explicit decision to use CSS Modules. |
| Any state management library | Explicitly out of scope per PROJECT.md. |

---

## Confidence Summary

| Area | Level | Reason |
|------|-------|--------|
| CSS Modules (zero-config Vite) | HIGH | First-class Vite feature, stable since Vite 1.x |
| Vitest + RTL as the correct combo | HIGH | Industry standard for this stack, well-established |
| Specific version numbers | MEDIUM | Based on August 2025 training data; external verification tools unavailable |
| Chrome mock strategy | HIGH | Pattern is deterministic based on how `storage.ts` detects environment |
| Build output preservation | HIGH | CSS Modules do not change Vite's output bundling structure |
| `vi.stubGlobal` API | MEDIUM | Needs version confirmation — present in Vitest >=0.26 |

---

## Sources

- Training knowledge: Vitest documentation patterns, stable as of August 2025
- Training knowledge: React Testing Library v14 user-event async API patterns
- Project codebase: `/Users/stephenkang/Desktop/job-tracker-vite/.planning/codebase/TESTING.md` — mocking considerations
- Project codebase: `/Users/stephenkang/Desktop/job-tracker-vite/.planning/codebase/CONCERNS.md` — stale closure and CSS debt
- Project codebase: `/Users/stephenkang/Desktop/job-tracker-vite/package.json` — confirmed Vite 5.4.21, TS 5.9.3, React 18.2.0
- External verification: BLOCKED (WebSearch, WebFetch, Context7 unavailable in this session)
