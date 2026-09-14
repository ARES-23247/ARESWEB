---
name: aresweb-comprehensive-audit
description: Audit ARESWEB repository quality, technical debt, or suspected orphaned code and assets.
---

# ARESWEB audit

Match the investigation to the requested scope. Use live source and configuration
as evidence; record commit, branch, worktree state, date, runtime versions and
commands used.

## Review scope

For a broad repository audit, cover entry points, trust boundaries and primary
user journeys across security/privacy, correctness, accessibility, performance,
SEO, tests, maintainability, truthful UX and delivery controls. Check active
routes, rules, registries, scripts, workflows, public assets and documentation.
Team assets and claims must have authentic provenance, including hardware,
3D parts, datasets, sponsors, alumni and awards.

For an orphan investigation, trace static/dynamic imports, lazy registries,
routes, Firebase configuration, scripts, CI, tests, generated copies, dynamic
URLs and documentation before declaring anything unused. Validate any authorized
deletion with affected builds and tests.

Run checks that resolve the investigation's uncertainties. Distinguish executed
results from static inspection and inference. Use parallel specialists only
when the user requests delegation and scopes are independent.

## Deliverable

Publish one deduplicated report under docs/audits/; keep temporary notes in
scratch/. Each finding needs severity, confidence, exact file/line evidence,
affected behavior, impact, remediation and an acceptance test. Separate confirmed
defects from risks needing reproduction; reconcile contradictory findings.

State the scope and evidence limits. Partial evidence does not establish total
security, WCAG conformance or zero violations. An audit does not authorize
deployment or production mutations.
