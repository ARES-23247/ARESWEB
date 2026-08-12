# Evidence-backed audit protocol

Use the `aresweb-comprehensive-audit` skill for repository-wide reviews. Derive
architecture, routes, roles, and data boundaries from live source and
configuration rather than historical reports.

Review security and youth privacy, correctness, WCAG 2.2 AA accessibility,
performance, SEO, test fidelity, maintainability, documentation, delivery, and
feature truthfulness. Treat automated scans as supporting evidence, not proof of
conformance.

Every finding must include severity, confidence, exact file/line evidence,
impact, remediation, and an acceptance test. Separate confirmed defects from
inference. Before calling anything orphaned, check imports, dynamic registries,
routes, Firebase configuration, scripts, CI, tests, generated files, URL
construction, and documentation.

Publish one deduplicated report under `docs/audits/`. Record the audited commit,
branch, dirty state, runtime versions, and commands actually executed. Never
claim complete security, WCAG conformance, or zero violations from partial
evidence.
