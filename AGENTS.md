# ARESWEB Agent Guide

This repository is a Vite + React 19 frontend with Firebase Hosting, Firestore,
Storage, and second-generation Cloud Functions. Read the relevant skill under
`.agents/skills/` before changing a protected area.

## Required engineering boundaries

- Treat every client and every Firestore document as untrusted. Authorization
  belongs in Cloud Functions middleware and Firebase rules, never only in UI.
- Keep secrets in Firebase/Google Secret Manager. Never store credentials in
  Firestore, source files, logs, URLs, or browser storage.
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
- Do not deploy, rotate secrets, or change production data without explicit user
  approval. Record required operational steps in documentation instead.

## Verification gate

Use Node 22.13 or newer in the Node 22 line (the Cloud Functions runtime),
pnpm 11.21.0, and run all of the following
before handing off a code change:

```text
pnpm install --frozen-lockfile
pnpm run lint
pnpm exec tsc --noEmit
pnpm run test
pnpm --filter functions build
pnpm --filter functions test
pnpm run build
pnpm audit --prod --audit-level=high
```

Add Vitest coverage for utilities and API routes. Use Playwright for major user
flows, and Firebase Emulator Suite tests for Firestore or Storage rule behavior.

See `docs/SECURITY_OPERATIONS.md` for required secret and deployment controls.
