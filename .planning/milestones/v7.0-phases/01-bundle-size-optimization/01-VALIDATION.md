---
phase: 01
slug: bundle-size-optimization
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-06
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | vite.config.ts (vitest config) |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test -- --run` and `npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green, build must succeed
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | MON-01, D-01, D-02, D-03 | T-01-04 | Loading states respect ARES brand, include aria-live | build | `npm run build && ls dist/assets/monaco-*.js` | ✅ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | MON-02, D-04, D-06 | — | Babel lazy loads with fallback | grep | `grep "export.*lazyBabel" src/utils/lazyBabel.ts` | ✅ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | MON-01, MON-03, D-07, D-08, D-09 | T-01-02 | No prefetch hints for Monaco, react-vendor preloaded | grep | `grep -E "rel=\"modulepreload.*react-vendor|dns-prefetch.*jsdelivr" index.html` | ✅ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | MON-03 | — | Chunk isolation verified | build | `npm run build && ls -la dist/assets/ | grep -E "monaco|babel"` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.
- [x] `src/test/setup.ts` — vitest configuration with jsdom environment
- [x] `npm test` — runs 926+ tests successfully
- [x] `npm run build` — production build succeeds in ~30 seconds

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Monaco chunk not on homepage | MON-01 | Network tab inspection, cannot automate browser DevTools | 1. Open DevTools Network tab 2. Load homepage 3. Verify no `monaco-*.js` in loaded resources |
| Monaco loads on /sim-runner | MON-01 | Route-specific behavior | 1. Navigate to /sim-runner 2. Verify `monaco-*.js` loads 3. Verify editor functions |
| Editor shows ARES-red spinner | D-01 | Visual verification | 1. Navigate to /sim-runner 2. Verify red spinner (not blue/generic) |
| "Taking longer" message appears | D-02 | Timeout-based UI | 1. Throttle network to Slow 3G 2. Navigate to /sim-runner 3. Verify message after ~3 seconds |
| Babel chunk lazy loads | MON-02 | Network tab inspection | 1. Open DevTools Network tab 2. Click simulation preview 3. Verify `babel-*.js` loads only on click |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (existing infrastructure)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
