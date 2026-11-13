---
name: aresweb-zero-trust-security
description: Implement or review ARESWEB access controls, uploads, secrets, and private-data boundaries.
---

# ARESWEB security and youth privacy

Treat clients, unverified Firebase tokens, Firestore documents, Storage objects,
webhooks, localStorage outboxes, and third-party responses as untrusted. Apply
the contracts relevant to the changed boundary.

## Identity and access

Verify Firebase ID tokens server-side and authorize from the current
`authorized_users/{uid}` record with an explicit role allowlist (`admin`,
`coach`, `mentor`, `member`). Reject missing, unknown, unverified, and archived
records; UI state and email are not authority.

Ensure custom role helpers across `functions/src/routes/` (for example
tournaments, portfolio, calendar, seasons, robots) call
`linkAuthorizedUserByEmail` before denying invited users on first direct API
request, and never mutate an archived user's stored `role` during session sync.
Enforce equivalent access controls across UI, Functions middleware,
`firestore.rules`, and `storage.rules`. Sensitive or abuse-prone browser
endpoints require App Check and fail closed in production.

## Data, integrations, and client state

Encrypt inquiry names and contact details before the first Firestore write, and
keep `inquiries/{id}` locked (`allow read, write: if false`) in
`firestore.rules`. Limit private youth data (including travel-readiness and PII
reveal logs) to the minimum `admin`/`coach` workflow; public minor identity is
limited to an approved nickname and avatar. Explicit public DTOs must exclude
raw documents, contact fields, internal UIDs, receipts, encryption metadata,
and operational fields.

Escape or enum-map untrusted metadata before sending outbound Zulip/Bluesky
messages, emit canonical `https://aresfirst.org` links rather than legacy domains
or 404 admin paths, and scope shared-tablet offline queues (`src/lib/pitModeOutbox.ts`)
by verified user and tournament identity.

Authenticate uploads before buffering; bound size, validate content, and
prevent active-content execution with safe response headers. Rate-limit
public/costly operations before expensive work. Authenticate webhook authors and
derive task/comment authors from verified identity. Upstream write failures must
remain visible failures.

Keep secrets in Google Secret Manager / Firebase Functions secret bindings,
never source, Firestore, logs, URLs, browser storage, or GitHub. Use
`functions/src/lib/logger.ts` for redacted logging.

## Verification and authorization

Test applicable allow/deny, cross-role, pre-authorized link, archived-user,
abuse/replay, malformed-input, CSV/Markdown injection, and data-minimization
cases. Permission changes require emulator coverage (`pnpm run test:rules` /
`pnpm run test:functions-emulator`). Complete authorized local fixes and
verification; rotating secrets or applying production data/rule changes requires
explicit session approval covering that exact action.
