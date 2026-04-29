---
wave: 1
depends_on: []
files_modified:
  - .planning/phases/01-calendar-subscriptions/01-VERIFICATION.md
  - .planning/phases/01-calendar-subscriptions/01-SUMMARY.md
  - .planning/phases/02-finance-manager-fixes/02-VERIFICATION.md
  - .planning/phases/02-finance-manager-fixes/02-SUMMARY.md
autonomous: true
requirements:
  - CAL-01
  - FIN-01
  - FIN-02
  - TST-01
---

# Phase 03: Retroactive Verification Generation - Plan

## Verification Criteria
- [ ] Phase 01 directory exists with `01-VERIFICATION.md` and `01-SUMMARY.md`
- [ ] Phase 02 directory exists with `02-VERIFICATION.md` and `02-SUMMARY.md`
- [ ] Frontmatter in SUMMARY files lists the correct requirements completed
- [ ] Requirement tables in VERIFICATION files list requirements as passed

## Goal-Backward Verification (must_haves)
- `01-SUMMARY.md` contains `requirements-completed:\n  - CAL-01`
- `02-SUMMARY.md` contains `requirements-completed:\n  - FIN-01\n  - FIN-02\n  - TST-01`

<task type="execute">
<name>Generate Phase 01 Artifacts</name>
<description>Create the directory and GSD lifecycle verification files for Phase 01.</description>
<read_first>
- .planning/phases/03-retroactive-verification/03-RESEARCH.md
</read_first>
<action>
1. Create the directory `.planning/phases/01-calendar-subscriptions/`.
2. Write `.planning/phases/01-calendar-subscriptions/01-SUMMARY.md` with:
```yaml
---
requirements-completed:
  - CAL-01
---
# Phase 01 Summary
Implemented direct subscription links for Apple and Google calendars and enabled click-to-navigate for event views.
```
3. Write `.planning/phases/01-calendar-subscriptions/01-VERIFICATION.md` with a requirements table showing CAL-01 as passed.
</action>
<acceptance_criteria>
- `ls .planning/phases/01-calendar-subscriptions/01-SUMMARY.md` succeeds.
- `cat .planning/phases/01-calendar-subscriptions/01-SUMMARY.md` contains `CAL-01`.
</acceptance_criteria>
</task>

<task type="execute">
<name>Generate Phase 02 Artifacts</name>
<description>Create the directory and GSD lifecycle verification files for Phase 02.</description>
<read_first>
- .planning/phases/03-retroactive-verification/03-RESEARCH.md
</read_first>
<action>
1. Create the directory `.planning/phases/02-finance-manager-fixes/`.
2. Write `.planning/phases/02-finance-manager-fixes/02-SUMMARY.md` with:
```yaml
---
requirements-completed:
  - FIN-01
  - FIN-02
  - TST-01
---
# Phase 02 Summary
Fixed budget item deletion 500 errors by adding execution context checks. Enforced idempotency for Kanban sponsor drag-and-drop. Achieved 100% test coverage.
```
3. Write `.planning/phases/02-finance-manager-fixes/02-VERIFICATION.md` with a requirements table showing FIN-01, FIN-02, and TST-01 as passed.
</action>
<acceptance_criteria>
- `ls .planning/phases/02-finance-manager-fixes/02-SUMMARY.md` succeeds.
- `cat .planning/phases/02-finance-manager-fixes/02-SUMMARY.md` contains `FIN-01`.
</acceptance_criteria>
</task>
