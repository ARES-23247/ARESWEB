# Phase 78-01 Summary: OAuth2 Authentication and D1 Schema Setup

**Completed:** 2026-05-13
**Status:** ✅ Complete

---

## Completed Tasks

### Task 1: D1 Database Schema ✅
Created three new tables in [src/db/schema.ts](src/db/schema.ts):

- **`onshape_credentials`** - Stores OAuth tokens per user
  - `userId` (primary key, foreign key to user)
  - `accessToken`, `refreshToken`, `expiresAt`
  - `createdAt`, `lastUsedAt`
  - Index on `lastUsedAt`

- **`onshape_documents`** - Caches public document metadata
  - `documentId` (primary key)
  - `name`, `description`, `thumbnailUrl`, `ownerName`
  - `isPublic` flag
  - `lastSyncedAt` timestamp
  - Index on `isPublic`

- **`onshape_bom_history`** - Audit trail for BOM syncs
  - `id` (auto-increment)
  - `documentId`, `elementId`, `partCount`
  - `syncedBy` (foreign key to user)
  - `syncedAt` timestamp
  - Indexes on `documentId` and `syncedAt`

### Task 2: Database Migration ✅
Generated migration file: [drizzle/20260513115455_gray_mentor/migration.sql](drizzle/20260513115455_gray_mentor/migration.sql)

Migration includes all three tables with proper foreign key relationships and indexes.

**Note:** Migration not yet applied to production D1 (awaiting deployment).

### Task 3: OAuth Utility Functions ✅
Created [functions/utils/onshapeAuth.ts](functions/utils/onshapeAuth.ts):

Key exports:
- `getOnshapeConfig()` - Retrieves configuration from environment
- `generateAuthUrl()` - Generates OAuth authorization URL with state
- `exchangeCodeForTokens()` - Exchanges auth code for access/refresh tokens
- `refreshOnshapeToken()` - Refreshes expired tokens with retry logic
- `storeOnshapeTokens()` - Stores tokens in D1 with upsert pattern
- `getOnshapeToken()` - Lazy token retrieval with auto-refresh
- `hasOnshapeCredentials()` - Checks if user has connected
- `clearOnshapeCredentials()` - Disconnects user account

Features:
- 5-minute expiry buffer for token refresh
- Retry logic with exponential backoff (3 attempts)
- Automatic `lastUsedAt` timestamp updates
- Proper error handling with ApiError

### Task 4: OAuth API Endpoints ✅
Created Onshape route files:

- [functions/api/routes/onshape/auth.ts](functions/api/routes/onshape/auth.ts) - OAuth flow endpoints
  - `GET /authorize` - Initiates OAuth flow with state validation
  - `GET /callback` - Handles OAuth callback and token storage
  - `GET /status` - Check connection status
  - `POST /logout` - Disconnect account

- [functions/api/routes/onshape/index.ts](functions/api/routes/onshape/index.ts) - Main router
  - `GET /health` - Health check endpoint

Routes registered in [functions/api/[[route]].ts](functions/api/[[route]].ts) under `/api/onshape`.

### Task 5: Environment Configuration ✅
Updated [wrangler.toml](wrangler.toml):

- Added KV namespace `ONSHAPE_OAUTH_STATE` for OAuth state validation
- Added preview environment KV binding
- Documented required environment variables:
  - `ONSHAPE_CLIENT_ID` - Required secret
  - `ONSHAPE_CLIENT_SECRET` - Required secret
  - `ONSHAPE_REDIRECT_URI` - Optional (has default)
  - `ONSHAPE_BASE_URL` - Optional (has default)

requirements_completed: []
---

## Threat Mitigation

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-78-01 | Client Secret stored as Cloudflare secret | ✅ Configured |
| T-78-02 | HTTPS enforced for all Onshape API calls | ✅ Hardcoded |
| T-78-03 | State parameter validation with KV | ✅ Implemented |
| T-78-07 | Rate limiting ready (per-user tracking) | ⏳ Next phase |

---

## Remaining Work (Manual Steps)

### Before Deployment
1. Create KV namespace: `wrangler kv:namespace create "ONSHAPE_OAUTH_STATE"`
2. Update `wrangler.toml` with actual KV IDs
3. Apply database migration to production

### Onshape Developer Portal
1. Create OAuth application at [cad.onshape.com](https://cad.onshape.com)
2. Configure redirect URI: `https://aresweb.pages.dev/api/onshape/callback`
3. Request scopes:
   - `https://cad.onshape.com/api/documents/read`
   - `https://cad.onshape.com/api/assemblies/read`
4. Copy Client ID and Secret

### After OAuth App Creation
1. Set secrets via wrangler:
   ```bash
   wrangler secret put ONSHAPE_CLIENT_ID
   wrangler secret put ONSHAPE_CLIENT_SECRET
   ```
2. Set preview secrets:
   ```bash
   wrangler secret put ONSHAPE_CLIENT_ID --env preview
   wrangler secret put ONSHAPE_CLIENT_SECRET --env preview
   ```

---

## Files Modified

- [src/db/schema.ts](src/db/schema.ts) - Added Onshape tables
- [drizzle/20260513115455_gray_mentor/migration.sql](drizzle/20260513115455_gray_mentor/migration.sql) - New migration
- [functions/utils/onshapeAuth.ts](functions/utils/onshapeAuth.ts) - New utility module
- [functions/api/routes/onshape/auth.ts](functions/api/routes/onshape/auth.ts) - OAuth endpoints
- [functions/api/routes/onshape/index.ts](functions/api/routes/onshape/index.ts) - Main router
- [functions/api/[[route]].ts](functions/api/[[route]].ts) - Registered onshape routes
- [wrangler.toml](wrangler.toml) - Added KV bindings and env var docs

---

## Next Phase

**78-02: Document Browsing and Display UI**
- Create API client utilities
- Implement document listing endpoints
- Build ModelGallery and ModelCard components
- Add Onshape page to navigation
