# Simulation Registry & Sandbox Isolation Architecture Audit

- Date: August 14, 2026
- Audited baseline: `87240fc7775bb266a0ad0b09a3a004d6f978895e` (`origin/master`)
- Branch: `codex/cycle-14-simulations-sandbox`
- Scope: Simulations manager dashboard (`src/app/dashboard/simulations/page.tsx`), simulation registry (`src/components/SimManager.tsx`), sandbox preview frame (`src/components/editor/SimPreviewFrame.tsx`), playground preview (`src/components/SimulationPlaygroundPreview.tsx`), and test coverage
- Production mutation: none

---

## Confirmed Findings and Remediation

### SIM-01 — Missing Integration Tests for Simulation Registry & Dashboard UX

- **Severity**: low
- **Confidence**: high
- **Evidence**: While `SimPreviewFrame.test.tsx` tested low-level iframe sandbox attribute isolation and postMessage origin checks, `src/components/SimManager.tsx` and `src/app/dashboard/simulations/page.tsx` lacked comprehensive unit and integration test coverage for auto-discovered catalog rendering, JSON export copying, modal preview opening, and dashboard tab switching between Active Registry and AI Simulation IDE.
- **Impact**: Potential regressions in simulation catalog discovery and dashboard navigation went unverified.
- **Remediation**: Created integration test suite `src/test/SimManager.test.tsx` (4 tests) validating registry rendering, metadata export, preview dialog modals, share links, and dashboard tab navigation.
- **Acceptance test**: `src/test/SimManager.test.tsx` passes with 4/4 tests.
- **Status**: fixed.

---

## Verification Evidence

- `pnpm vitest run src/test/SimManager.test.tsx`: 4/4 tests passed.
- Scoped ESLint & TypeScript: 0 warnings, 0 errors.
