---
name: aresweb-identity-safety
description: Unified ARESWEB security: Zero Trust identity and Youth Data Protection (YPP/COPPA).
---

# ARES Identity & Safety

## 1. Zero Trust Identity
- **Never Trust Clients**: Do not rely on `Referer`, `Host`, or `Origin` headers.
- **Server Validation**: Use **Better-Auth** via `getSessionUser(c)`.
- **RBAC Enforcement**: Use `ensureAuth` (any session) or `ensureAdmin` (`admin`/`author` roles).
- **Exceptions**: `ENVIRONMENT === "development"` + localhost allowed ONLY for local testing.

## 2. Youth Data Protection (PII Stripping)
For `member_type === 'student'`, strict protections apply:
- **Redaction**: Never expose `email`, `phone`, or `full name` in public API/UI.
- **Naming**: Use `nickname` (fallback: "ARES Member"). Never use `user.name`.
- **Sanitization**: Public endpoints MUST apply `sanitizeProfileForPublic` filters.
- **UI**: Students see banner: "🛡️ Your contact information is protected."

## 3. Governance & Persistence
- **Audit**: Use `logAuditAction(c, action, type, id, details)` for sensitive mutations.
- **Deletes**: Prohibit hard `DELETE`. Use soft-deletion via `isDeleted = 1`.
- **Consent**: Adult PII fields must default to **OPT-OUT**.

## 4. Reference
- **Middleware**: `functions/api/middleware/auth.ts`
- **Sanitizer**: `functions/api/utils/sanitizers.ts`
