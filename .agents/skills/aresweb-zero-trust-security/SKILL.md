---
name: aresweb-zero-trust-security
description: Secure ARESWEB authentication, authorization, App Check, Firestore and Storage rules, secrets, uploads, youth data, inquiry PII, public DTOs, and external integrations. Use for any trust-boundary, identity, privacy, or security-sensitive change.
---

# ARESWEB security and youth privacy

Treat clients, Firebase tokens until verified, Firestore documents, Storage
objects, webhook payloads, and third-party responses as untrusted.

## Authorization

- Verify Firebase ID tokens server-side and authorize from the current
  `authorized_users/{uid}` record.
- Use an explicit role allowlist. Reject missing, unknown, unverified, and
  archived records. Never infer access from a UI state or email address.
- Enforce equivalent rules in Cloud Functions, Firestore rules, and Storage
  rules. Test allow and deny cases with emulators.
- Enforce App Check on browser-originated sensitive or abuse-prone endpoints.
  Document any temporary exception and fail closed in production.

## Data protection

- Encrypt inquiry names and contact details before the first Firestore write.
- Restrict private youth data to the minimum admin/coach workflow. Public minor
  identity is limited to an approved nickname and avatar.
- Return explicit public DTOs; never return raw documents, contact fields,
  internal UIDs, receipts, encryption metadata, or operational fields.
- Prevent active-content execution from user uploads. Validate authenticated
  uploads before buffering, bound file sizes, and use safe response headers.
- Keep secrets only in Google Secret Manager/Firebase Functions secret bindings.
  Never put them in source, Firestore, logs, URLs, browser storage, or GitHub.

## Failure and verification

Rate-limit public and costly operations before expensive work. Authenticate
webhook authors and derive task/comment authors from the verified identity, not
request fields. Do not return fake-success responses for failed upstream writes.

Log only redacted operational context through shared loggers. Add abuse, replay,
cross-role, archived-user, malformed-input, and data-minimization tests. Obtain
explicit approval before rotating secrets or changing production data or rules.
