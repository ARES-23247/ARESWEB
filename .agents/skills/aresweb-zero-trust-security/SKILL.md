---
name: aresweb-zero-trust-security
description: Implement or review ARESWEB access controls, uploads, secrets, and private-data boundaries.
---

# ARESWEB security and youth privacy

Treat clients, unverified Firebase tokens, Firestore documents, Storage objects,
webhooks and third-party responses as untrusted. Apply the contracts relevant to
the changed boundary.

## Identity and access

Verify Firebase ID tokens server-side and authorize from the current
authorized_users/{uid} record with an explicit role allowlist. Reject missing,
unknown, unverified and archived records; UI state and email are not authority.
Enforce equivalent access controls in Functions, Firestore and Storage rules.
Sensitive or abuse-prone browser endpoints need App Check; document temporary
exceptions and fail closed in production.

## Data and integrations

Encrypt inquiry names/contact details before the first Firestore write. Limit
private youth data to the minimum admin/coach workflow; public minor identity
is an approved nickname and avatar. Explicit public DTOs must exclude raw
documents, contact fields, internal UIDs, receipts, encryption and operational
metadata.

Authenticate uploads before buffering; bound size, validate content and prevent
active-content execution with safe response headers. Rate-limit public/costly
operations before expensive work. Authenticate webhook authors and derive
task/comment authors from verified identity. Upstream write failures must remain
visible failures.

Keep secrets in Google Secret Manager/Firebase secret bindings, never source,
Firestore, logs, URLs, browser storage or GitHub. Use shared redacting loggers.

## Verification and authorization

Test applicable allow/deny, cross-role, archived-user, abuse/replay,
malformed-input and data-minimization cases. Permission changes need emulator
coverage. Complete authorized local fixes and verification; rotating secrets or
applying production data/rule changes requires explicit session approval for
that action. Do not request approval again when it already covers the action.
