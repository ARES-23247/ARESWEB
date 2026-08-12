# API Authentication

ARESWEB uses Firebase Authentication for identity and Cloud Functions middleware
for authorization. Better Auth, Hono, Cloudflare Access, and cookie sessions are
not part of the current application.

## Browser requests

Use `authenticatedFetch` from `src/lib/api.ts`. It sends the current Firebase ID
token and, for protected browser mutations, a Firebase App Check token.

```ts
const response = await authenticatedFetch("/api/profiles/me", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(update),
});
```

Never build authorization decisions from browser roles, email addresses,
`Origin`, `Referer`, or forwarded headers.

## Cloud Functions middleware

- `ensureAuth` verifies a Firebase ID token.
- `ensureTeamMember` also requires an active, known role from
  `authorized_users/{uid}`.
- `ensureAdmin` requires an active `admin` or `coach` authorization.
- `observeAppCheck` verifies App Check for browser mutations.
- `enforceAppCheck` fails closed in production unless an emergency
  `ENFORCE_APP_CHECK=false` override is deliberately configured.

Canonical active roles are `admin`, `coach`, `mentor`, and `member`. Legacy role
mapping exists only to support migration. Archived, unknown, missing, and
unverified authorization records are denied.

## Server integrations

Two server-to-server endpoints cannot obtain browser App Check tokens:

- `POST /api/profiles/sync` authenticates with `PROFILE_SYNC_SECRET`.
- `POST /api/webhooks/zulip` authenticates with `ZULIP_WEBHOOK_TOKEN`.

Keep those endpoints narrowly exempt from App Check and validate their own
secrets before parsing or changing data.

## Error handling

Throw `ApiError` from an `asyncHandler` route. The shared error middleware
returns `{ error, code }`. Use 401 for missing or invalid identity, 403 for an
authenticated user without permission, 400 for invalid input, 429 for rate
limits, and 502/503 for failed dependencies. Never return HTTP 200 with
`success: false` for a failed write.

See `docs/SECURITY_OPERATIONS.md` before changing secrets, App Check policy,
rules, or production authentication.
