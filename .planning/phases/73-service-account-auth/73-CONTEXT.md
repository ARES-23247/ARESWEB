# Phase 73: Service Account Authentication - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers OAuth 2.0 service account authentication for Google Photos Library API and Google Drive API. It includes JWT-based token generation, D1 token storage with expiry tracking, automatic lazy refresh, retry logic with exponential backoff, and error handling.

</domain>

<decisions>
## Implementation Decisions

### Service Account Strategy
- **D-01:** Reuse existing Google Calendar service account (add Photos/Drive scopes to GCAL_SERVICE_ACCOUNT)
- **D-02:** Unified scope approach — single JWT with Calendar, Photos, and Drive scopes
- **Rationale:** Simpler credential management, one set of environment variables, consistent with existing gcalSync.ts pattern

### Token Storage
- **D-03:** Store OAuth tokens and metadata in D1 `settings` table (key-value pattern)
- **D-04:** Store access token, expiry timestamp (`drive_access_token`, `drive_token_expires_at`, etc.)
- **Rationale:** Matches existing pattern, no new tables needed, simple get/set operations

### Refresh Strategy
- **D-05:** Lazy refresh — check token expiry before API call, refresh if near expiry (within 5 minutes)
- **D-06:** Track token expiry timestamp in D1 settings (`drive_token_expires_at`, `photos_token_expires_at`)
- **Rationale:** Simpler than cron, no background jobs needed, tokens are 1-hour valid so checking is cheap

### Error Handling
- **D-07:** Retry with exponential backoff on token refresh failures (3 retries, 100ms → 200ms → 400ms)
- **D-08:** Throw standardized ApiError to caller after retries exhausted
- **D-09:** Log errors to console for debugging
- **Rationale:** Standard pattern matches gcalSync.ts, propagates errors to UI for user feedback

### Caching Strategy
- **D-10:** Always fetch from D1 settings (no Workers KV caching)
- **Rationale:** Simpler, source of truth, no cache invalidation complexity, D1 reads are fast enough

### Claude's Discretion
- Exact retry timing and backoff multiplier (default: 3 retries, 2x backoff)
- Token expiry buffer (default: 5 minutes before actual expiry)
- Key names in D1 settings table (e.g., `drive_access_token` vs `google_drive_token`)

### Google Photos Upload (New Capability)
- **D-11:** Add upload to Google Photos capability through website (requires `photoslibrary.appendonly` or `photoslibrary.edit` scope)
- **D-12:** Upload flow similar to YouTube upload — file selection, metadata (title, description), album selection
- **D-13:** Mirror Google Photos albums as R2 folder structure (e.g., `R2://photos/2024/competition/`)
- **Rationale:** Users shouldn't need direct Google Photos login; your website becomes the interface

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research & Requirements
- `.planning/research/STACK_GOOGLE_DRIVE.md` — Stack research showing zero new dependencies needed
- `.planning/research/ARCHITECTURE.md` — Architecture patterns for service account auth
- `.planning/research/PITFALLS.md` — Common pitfalls (OAuth race conditions, rate limits, thumbnail expiration)
- `.planning/REQUIREMENTS.md` — Full v8.1 requirements (AUTH-01 through AUTH-04)

### Existing Patterns
- `functions/utils/gcalSync.ts` — Service account JWT authentication pattern (reuse for Photos/Drive)
- `functions/api/routes/youtube/index.ts` — User OAuth flow (different pattern, reference for contrast)
- `shared/errors/api.ts` — Standardized error structure for ApiError

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `functions/utils/gcalSync.ts` — `getGcalAccessToken()` function demonstrates JWT signing with `jose`, token refresh pattern, Google OAuth endpoint
- `jose` package — Already installed, used for JWT signing (`SignJWT`, `importPKCS8`)
- D1 `settings` table — Already used for key-value storage, has get/set patterns

### Established Patterns
- Service account auth uses `RS256` algorithm with PKCS8 private key
- JWT expires in 1 hour (`setExpirationTime("1h")`)
- Private key from environment has literal `\n` that must be preserved
- Token request to `https://oauth2.googleapis.com/token` with grant type `urn:ietf:params:oauth:grant-type:jwt-bearer`

### Integration Points
- Environment variables: `GCAL_SERVICE_ACCOUNT_EMAIL`, `GCAL_PRIVATE_KEY` (will add scopes)
- New D1 settings keys: `drive_access_token`, `drive_token_expires_at`, `photos_access_token`, `photos_token_expires_at`
- New utility functions: `getDriveAccessToken()`, `getPhotosAccessToken()` (extend gcalSync.ts)
- API routes will consume these utilities in Phases 74-77

</code_context>

<specifics>
## Specific Ideas

- Extend `functions/utils/gcalSync.ts` with `getDriveAccessToken()` and `getPhotosAccessToken()` functions
- Add helper function `getOrRefreshToken(type: "drive" | "photos")` that checks expiry and refreshes if needed
- Scope string: `https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/photoslibrary.readonly`

</specifics>

<deferred>
## Deferred Ideas

- **Durable Objects for token locking:** Research mentioned this for OAuth race condition prevention, but deferred for this phase since service account auth (not multi-user OAuth) eliminates most race conditions
- **Workers KV caching:** Deferred for simplicity, can add later if D1 read latency becomes an issue
- **Token refresh monitoring/alerting:** Deferred to future phase, logging is sufficient for now

### New Requirements (add to ROADMAP)
The following requirements emerged during discussion and should be added to REQUIREMENTS.md and ROADMAP.md:

**Google Photos Upload (new phase or extend Phase 75/76):**
- User can upload photos through website to Google Photos
- Upload requires write scope (`photoslibrary.edit` or `photoslibrary.appendonly`)
- Upload flow: file selection, metadata entry, album selection
- Service account must have domain-wide delegation for write access

**Album Structure Preservation (Phase 76):**
- Fetch Google Photos albums structure
- Mirror albums as R2 folders (e.g., `photos/{albumName}/{filename}`)
- Store album metadata in D1 for lookup

</deferred>

---

*Phase: 73-Service Account Authentication*
*Context gathered: 2026-05-12*
