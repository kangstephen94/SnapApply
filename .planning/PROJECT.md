# Job Tracker Chrome Extension — Code Quality Milestone

## What This Is

A Chrome extension for tracking job applications, built with React 18 + TypeScript + Vite. It supports CRUD operations, CSV import/export, status filtering/search, and Google Sheets sync via webhook. This milestone focuses on refactoring the existing codebase to improve code quality, maintainability, and test coverage.

## Core Value

The app continues to work exactly as it does today — all existing functionality preserved — while the codebase becomes easier to maintain, extend, and trust.

## Requirements

### Validated

- ✓ CRUD for job applications (company, role, date, status, location, URL, notes) — existing
- ✓ Status filtering and search — existing
- ✓ CSV import with flexible header detection — existing
- ✓ CSV export with quoted fields — existing
- ✓ Google Sheets sync via Apps Script webhook — existing
- ✓ Dual storage (chrome.storage.local / localStorage) — existing
- ✓ Setup wizard for Google Sheets connection — existing
- ✓ Status badges with color/icon mapping — existing

### Active

- [ ] Extract CSV parsing/export logic from App.tsx into dedicated utility modules
- [ ] Migrate from single App.css to CSS Modules (scoped per component)
- [ ] Add test coverage with Vitest + React Testing Library
- [ ] Fix stale closure risk in useJobApps hook callbacks

### Out of Scope

- New features (location autocomplete, new UI, etc.) — this milestone is purely code quality
- Changing the tech stack (no Tailwind, no state management library, no router)
- CI/CD pipeline setup — focus on local test infrastructure first

## Context

- This is a brownfield refactoring project — existing working Chrome extension
- React 18.2.0, Vite 5.4.19, TypeScript 5.9.3
- ~10 components, 2 hooks, 2 utility modules, 1 CSS file (~400 lines)
- No existing tests, linting, or formatting configuration
- Fixed 520px popup width (Chrome extension constraint)
- Build outputs single JS bundle (no code splitting) for extension compatibility
- CSV parser in App.tsx is ~100 lines with custom quote handling
- useJobApps callbacks (addApp, updateApp, deleteApp) close over `apps` state, creating stale closure risk on rapid sequential calls

## Constraints

- **Compatibility**: All refactoring must preserve existing Chrome extension behavior exactly
- **No new runtime deps**: CSS Modules are built-in to Vite; Vitest is dev-only
- **Build output**: Must remain single JS bundle + single CSS file for extension loading

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| CSS Modules over Tailwind | No new dependencies, natural per-component scoping, works with Vite out of the box | — Pending |
| Vitest over Jest | Native Vite integration, faster startup, same assertion API | — Pending |
| Extract CSV to utils, not a hook | CSV logic is pure data transformation, not stateful — utility is the right home | — Pending |
| Fix closures with functional updates | `setApps(prev => ...)` pattern eliminates stale reference without adding deps | — Pending |

---
*Last updated: 2026-03-18 after initialization*
