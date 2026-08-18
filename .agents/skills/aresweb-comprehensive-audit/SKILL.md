---
name: aresweb-comprehensive-audit
description: Audit the complete ARESWEB repository for security, privacy, correctness, accessibility, performance, SEO, tests, maintainability, documentation, CI/CD, dead code, and feature truthfulness. Use for broad audits, technical-debt reviews, or orphan-code investigations.
---

# ARESWEB audit protocol

Record the commit, branch, worktree state, date, runtime versions, and commands
used. Derive architecture and behavior from active source and configuration.

## Method

1. Inventory entry points, routes, rules, workflows, registries, scripts, tests,
   public assets, and documentation.
2. Trace trust boundaries and primary user journeys before reviewing details.
3. Review security/privacy, correctness, accessibility, performance/assets,
   SEO/crawl behavior, test fidelity, maintainability, UX truthfulness, and
   delivery controls. Specifically audit for and reject any fabricated 3D parts,
   mock datasets, invented sponsors, alumni, awards, or false team capabilities.
4. Run applicable static checks and focused tests. Distinguish executed evidence
   from inspection and inference.
5. Reconcile duplicate or contradictory findings and publish one report under
   `docs/audits/`. Use `scratch/` only for temporary working notes.

## Evidence contract

For each finding include severity, confidence, exact file and line evidence,
affected behavior, impact, remediation, and an acceptance test. Separate confirmed
defects from risks requiring reproduction. Do not claim total security, WCAG
conformance, or zero violations from partial evidence.

Before calling code or an asset orphaned, check static and dynamic imports, lazy
registries, routes, Firebase configuration, scripts, CI, tests, generated files,
URL construction, and documentation. Confirm deletions with builds and tests.

Use parallel specialists only when the user asks for delegation and the scopes
are independent. The lead agent owns deduplication and final conclusions. Never
deploy or change production state as part of an audit without separate approval.
