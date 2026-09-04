# ARESWEB Agent Guide

This repository is a Vite + React 19 frontend with Firebase Hosting, Firestore,
Storage, and second-generation Cloud Functions. Read the relevant skill under
`.agents/skills/` before changing a protected area.

The same `.agents/skills/` tree is the canonical workspace skill source for
Codex, Gemini CLI, and Google Antigravity. `GEMINI.md` and the Antigravity rule
under `.agents/rules/` import this guide; do not duplicate skill contents into
vendor-specific directories.

## Required engineering boundaries

- Treat every client and every Firestore document as untrusted. Authorization
  belongs in Cloud Functions middleware and Firebase rules, never only in UI.
- Keep secrets in Firebase/Google Secret Manager. Never store credentials in
  Firestore, source files, logs, URLs, or browser storage.
- Production GitHub Actions must authenticate with the repository-restricted
  Workload Identity Federation provider. Never add service-account JSON or a
  Firebase refresh token to GitHub secrets.
- Public APIs must return explicit DTOs. Do not expose raw Firestore documents,
  student PII, receipt URLs, internal user IDs, or operational metadata.
- Encrypt inquiry PII at rest and restrict access to admin/coach roles. Public
  student identity is limited to nickname and approved avatar.
- Authenticate and rate-limit large uploads before parsing their bodies. Use
  bounded queries, cursor pagination, and bounded cleanup batches.
- Route failures through `asyncHandler`, `ApiError`, and `globalErrorHandler`.
  Log diagnostic context server-side and return generic unexpected 5xx errors.
- User-authored simulation code must run in an opaque-origin iframe sandbox.
  Never combine `allow-scripts` with `allow-same-origin`.
- Public Firestore reads must filter to published, non-deleted records. When a
  collection contains private fields, expose it through a server-side DTO API.
- Preserve explicit error states in the UI. Never turn authorization, network,
  or upstream failures into empty data or zero values.
- Never fabricate data, assets, or claims. Do not invent mock 3D parts, hardware
  designs, CAD models, sponsors, alumni, students, mentors, awards, or technical
  specs. Do not create static mock data files pretending to be real team artifacts.
  All team content must originate from authenticated Firestore records, verified
  team handles, or explicit user-supplied data. When an inventory or catalog is
  empty, render a truthful empty state or direct profile link instead of mock items.
- Do not deploy, rotate secrets, or change production data without explicit user
  approval. Record required operational steps in documentation instead.

## Standing approval for ARES version refreshes

The owner grants agents standing approval to refresh this repository's ARES
version references during requested maintenance or release work. Do not ask
again for each version bump, including a major version, when all of these
conditions are met:

- Resolve the official ARES-Robotics source to an immutable public commit;
  verify its release manifest and source blob hashes. Never use unrelated local
  monorepo edits as release evidence.
- Review changed referenced source and make the bounded lesson corrections
  required to keep existing guidance accurate. Update catalog provenance,
  version text, curriculum plans, and unapproved review-candidate digests together.
  Preserve historical screenshot identities and other captured evidence.
- Run the required gates, remote provenance validation, and release-candidate
  validation. Preserve human-review flags and record the source comparison.
- Commit and push the refresh through a normal pull request. When the user has
  already authorized deployment for the active task, include the refresh in that
  release and continue through protected merge and deployment without asking again.

This approval covers source maintenance, not new curriculum scope, fabricated
review or test evidence, production Academy document publication/migration,
secret rotation, or bypassing branch protections, CI, sandbox policy, or managed
approval controls. Standalone production deployment still needs user authorization.

## Verification gate

Use Node 24.15 or newer in the Node 24 line (the Cloud Functions runtime),
pnpm 11.21.0, and Java 21 or newer for Firebase emulators. Run all of the
following before handing off a code change:

```text
pnpm install --frozen-lockfile
pnpm run validate:agents
pnpm run check:route-security
pnpm run validate:functions-deploy-lock
pnpm run lint
pnpm --filter functions lint
pnpm run typecheck
pnpm run test:coverage
pnpm --filter functions build
pnpm --filter functions test:coverage
pnpm run test:rules
pnpm run build
node scripts/check-bundle-size.mjs
pnpm run test:e2e
pnpm audit --prod --audit-level=high
```

Coverage floors are ratchets, not targets. New utilities and API routes must meet
85% line and 100% function coverage. Use Playwright for major user flows, and
Firebase Emulator Suite tests for Firestore or Storage rule behavior.

See `docs/SECURITY_OPERATIONS.md` for required secret and deployment controls.

## Agent and audit quality

- Derive the current architecture, routes, roles, and data boundaries from live
  source and configuration. Planning archives and generated output are not
  authoritative.
- Audit findings must include severity, confidence, exact file/line evidence,
  impact, remediation, and an acceptance test. Separate confirmed defects from
  inference and record the audited commit and worktree state.
- Do not label code or public assets orphaned from a filename search alone.
  Check imports, lazy registries, scripts, CI, tests, Firebase configuration,
  dynamic URL construction, and documentation.
- Parallel audits must respect the available concurrency limit and use staged,
  non-overlapping scopes. The lead agent reconciles contradictions and writes
  one deduplicated report under `docs/audits/`.
- Never hide DOM nodes, disable pseudo-elements, weaken contrast checks, lower
  coverage, or broaden authorization merely to make a quality gate pass.
- Diagnostics use shared redacting loggers. Never log secrets, request bodies,
  student names, email addresses, phone numbers, raw user IDs, or encrypted PII.
- Do not claim WCAG conformance, a perfect score, zero violations, or complete
  security without a dated scope and reproducible automated and manual evidence.
