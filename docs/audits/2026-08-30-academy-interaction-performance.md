# Academy interaction performance refactor

Date: 2026-08-30  
Branch: `codex/areslib-reference-learning-depth`  
Starting commit: `5e132a63`  
Worktree at measurement: modified by this bounded refactor; no unrelated files
were present before the batch.

## Scope

This batch did not add, remove, publish, or migrate curriculum. It reduced
repeated React code in six existing conceptual checklist labs:

- Hardware Topology Diagnostic
- Capstone Evidence Board
- Commissioning Boundary Checklist
- Post-Match Triage Lab
- Scouting Evidence Quality Lab
- Wiring Plan Diagnostic Lab

Their state, reset, native-checkbox, live-result, summary, and evidence-limit
rendering now use one tested `AcademyChecklistLab` component. Each lesson keeps
its own ordered decision function, labels, next actions, and explicit fidelity
limits. The shared shell now provides the same reset icon and focus treatment
to every consumer.

## Measured result

The production build and unchanged bundle budgets measured:

| Measurement | Before | After | Change |
| --- | ---: | ---: | ---: |
| Academy interaction JavaScript, raw | 252,739 B | 245,793 B | -6,946 B |
| Academy interaction JavaScript, gzip | 94,342 B | 91,320 B | -3,022 B |
| Remaining gzip budget | 658 B | 3,680 B | +3,022 B |

The aggregate limit remains 261,000 raw / 95,000 gzip bytes. No threshold was
raised or excluded. The largest individual Academy interaction remains below
its 8,000 raw / 2,600 gzip budget.

## Verification evidence

Focused evidence before the full repository gate:

- frontend TypeScript passed;
- focused ESLint passed;
- 35 component and decision-logic tests passed across the shared UI and all six
  migrated interactions;
- the production build and bundle-size checker passed; and
- the refactor preserved deterministic reset, ordered feedback, accessible
  native controls, live status output, and truthful model/evidence limits.

The complete ARESWEB verification gate is required before this batch is
committed. This work does not claim physical hardware validation, curriculum
review, website publication approval, or production deployment.
