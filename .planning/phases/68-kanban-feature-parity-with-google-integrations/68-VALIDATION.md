---
phase: 68
slug: 68-kanban-feature-parity-with-google-integrations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-10
---

# Phase 68 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest / playwright |
| **Config file** | vitest.config.ts / playwright.config.ts |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test && npx playwright test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test && npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 68-01-01 | 01 | 1 | Schema Migration | — | N/A | Drizzle | `npm run db:generate` | ✅ | ⬜ pending |
| 68-01-02 | 01 | 1 | API Updates | — | N/A | Unit | `npm run test` | ✅ | ⬜ pending |
| 68-02-01 | 02 | 2 | Server Unfurling | — | No open proxy | Unit | `npm run test` | ❌ W0 | ⬜ pending |
| 68-03-01 | 03 | 3 | UI Components | — | N/A | Component | `npm run test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/unfurl.test.ts` — stubs for testing server-side unfurling
- [ ] `src/__tests__/kanban.test.ts` — stubs for testing Kanban label/checklist features

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Zulip Notifications | Zulip Integration | E2E hard | Create task attachment locally and check #kanban Zulip channel. |
| Google Docs Permissions | Attachments | External Auth | Verify clicking document respects Google's native permission screen. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
