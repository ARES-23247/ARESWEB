# Canonical Audit Report Template (`docs/audits/YYYY-MM-DD-<slug>.md`)

Every repository audit produces one deduplicated report under `docs/audits/`
using this structure:

```markdown
# <Title> — <Date>

## 1. Scope, Environment & Release Identity
- **Repository:** `ARES-23247/ARESWEB`
- **Audited Commit / Branch:** `<sha>` (`<branch>`)
- **Initial Worktree State:** Clean / `<details>`
- **Audit Date:** `<YYYY-MM-DD>`
- **Runtime Versions:** Node `<v>`, pnpm `<v>`, Java `<v>`, OS `<os>`

### Verification Ledger (Executed vs. Live vs. Static Inspection)
| Check / Surface | Type | Command or Method | Outcome & Exact Scope |
| --- | --- | --- | --- |
| ... | Executed Gate / Read-Only Live / Browser / Static | ... | Pass / Fail / Exact counts |

## 2. Audit of Agent & Audit Skills (if in scope)
- Gaps found, skill/validator upgrades applied, and remaining limits.

## 3. Summary of Site Findings
| ID | Severity | Status | Domain | Summary |
| --- | --- | --- | --- | --- |
| **FA-01** | P1 High | Confirmed Defect | ... | ... |

*Severity scale:* **P0 Critical** (active compromise, data breach, or outage),
**P1 High** (auth/PII boundary flaw, broken core flow, or major data loss),
**P2 Medium** (bounded security hardening gap, role UI mismatch, a11y/SEO bug),
**P3 Low** (technical debt, orphan, test gap, minor UX/perf polish).

## 4. Detailed Findings
### FA-01 — <Title>
- **Severity & Confidence:** `P<0-3>` — `Confirmed Defect` | `Risk / Needs Reproduction`
- **Evidence:** Exact `<path>:<line-range>` references and/or observed command/HTTP output
- **Affected Behavior / Trigger:** Concrete step-by-step path or input
- **Impact:** Who is affected and how
- **Remediation:** Minimal, architecture-aligned fix
- **Acceptance Test:** Exact unit/emulator/E2E or verification check proving the fix

## 5. Verified Clean Boundaries & Scope Limits
- List surfaces/controls verified clean in this audit run.
- State explicit scope and evidence limits (no blanket claims of complete
  security, full WCAG 2.2 AA conformance, or zero defects across unexecuted flows).
```
