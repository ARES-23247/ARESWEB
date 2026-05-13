# Technology Stack: Google Drive API Integration

**Project:** ARESWEB v8.1 Google Drive API Integration
**Researched:** 2026-05-12
**Overall confidence:** HIGH

## Executive Summary

Google Drive API integration for ARESWEB requires NO new npm dependencies. The existing Cloudflare Workers + Hono infrastructure already has all required libraries. The critical decision is to use **direct REST API calls via native `fetch`** instead of the `googleapis` npm package, which is incompatible with Workers edge runtime.

**Key findings:**
1. **Zero new dependencies needed** — all required packages already in `package.json`
2. **DO NOT use `googleapis`** — requires Node.js runtime (streams, crypto modules) not available in Workers
3. **Follow YouTube OAuth pattern** — existing integration provides proven template for user OAuth flow
4. **D1 `settings` table** — already supports OAuth token storage (no migration needed)
5. **Image filtering by MIME type** — server-side query excludes non-image files automatically

## Recommended Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Cloudflare Workers** | Latest | Edge runtime for API routes | Already in use, enables OAuth flow without Node.js dependencies |
| **Hono** | ^4.12.16 | Web framework for API routes | Already integrated, provides OpenAPI and typed routing |
| **@hono/zod-openapi** | ^1.3.0 | Contract definitions and type inference | Current standard for ARESWEB, ensures end-to-end type safety |
| **Drizzle ORM** | ^1.0.0-beta.22 | Database queries and schema | Existing D1 integration, type-safe queries |

### Google Drive API Client
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Direct REST API (fetch)** | N/A | Google Drive API calls | **MUST use REST**, NOT `googleapis` npm package (incompatible with Workers edge runtime) |
| **Native fetch API** | Built-in | HTTP requests to Google APIs | Available in Workers, no external dependencies needed |

### Authentication
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **OAuth 2.0 Authorization Code Flow** | N/A | User authentication with Google | Standard pattern for delegated access to user's Drive files |
| **Refresh Token Storage** | N/A | Persistent access in D1 `settings` table | Follows existing pattern from YouTube integration (`youtube_refresh_token`) |

### Image Processing
| Technology | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Native fetch + R2 PUT** | Built-in | Downloading images from Drive, uploading to R2 | Leverages existing R2 infrastructure |
| **Sharp** | **DO NOT ADD** | Image optimization | Already handled by existing media pipeline (`heic2any`, WebP conversion) |
| **heic2any** | ^0.0.4 | HEIC to JPEG conversion (existing) | Use existing pipeline for Apple format images |

### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **jose** | ^6.2.3 | JWT signing (if service account needed) | Only if using service account auth instead of user OAuth |
| **zod** | ^4.4.3 | Schema validation for API contracts | Already in use, required for typed handlers |
| **p-retry** | ^8.0.0 | Retry logic for Google API calls | Use for transient failures (network, rate limits) |

## OAuth 2.0 Implementation for Cloudflare Workers

### Recommended Approach: User Account OAuth 2.0 (Not Service Account)

**Use authorization code flow** for user-delegated access to Google Drive:

1. **Authorization URL Generation** (`GET /api/drive/auth`)
   - Redirect to Google OAuth consent screen
   - Scope: `https://www.googleapis.com/auth/drive.readonly`
   - Redirect URI: `${origin}/api/drive/callback`
   - `access_type=offline` + `prompt=consent` to ensure refresh token

2. **Callback Handler** (`GET /api/drive/callback`)
   - Exchange authorization code for access + refresh token
   - Store refresh token in D1 `settings` table as `drive_refresh_token`
   - Follow existing YouTube pattern in `functions/api/routes/youtube/index.ts`

3. **Access Token Refresh** (utility function)
   - Use stored refresh token to get short-lived access token
   - POST to `https://oauth2.googleapis.com/token` with `grant_type=refresh_token`
   - Cache access token in Workers KV for 5-minute TTL (optional optimization)

4. **Drive API Calls**
   - Use `Authorization: Bearer ${access_token}` header
   - All calls via native `fetch` API

### Why NOT Service Account?

- **User context required**: Service accounts authenticate as the app, not the user
- **Shared Drive access only**: Service accounts can't access user's personal Drive without complex delegation
- **Existing pattern**: YouTube integration already uses user OAuth, maintain consistency

### Environment Variables Required

Add to `.dev.vars` (local) and Cloudflare Pages environment (production):

```bash
# Google Drive OAuth 2.0 Credentials
GOOGLE_DRIVE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=your-client-secret
```

**Setup steps:**
1. Create OAuth 2.0 client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Application type: Web application
3. Authorized redirect URIs: `https://aresweb.pages.dev/api/drive/callback` (production)
4. Authorized JavaScript origins: `https://aresweb.pages.dev`

## D1 Schema Additions

### Existing Pattern (Reuse)
The `settings` table already supports OAuth token storage:

```typescript
// src/db/schema.ts (existing)
export const settings = sqliteTable("settings", {
  key: text().primaryKey(),
  value: text().notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});
```

### New Settings Entries
No schema migration needed. Store:

| Key | Value | Purpose |
|-----|-------|---------|
| `drive_refresh_token` | `string` (encrypted recommended) | OAuth refresh token for Drive API access |
| `drive_token_expires_at` | `ISO timestamp` | Track when access token expires (optional, for proactive refresh) |

**Note on encryption**: Existing architecture audit notes social credentials stored as plain JSON strings in `settings`. Consider encrypting OAuth tokens before storage using Cloudflare's WebCrypto API for production security.

## API Endpoints to Create

### 1. GET /api/drive/auth
**Purpose**: Generate OAuth authorization URL
**Response**: `{ url: string }`

### 2. GET /api/drive/callback
**Purpose**: Handle OAuth callback from Google
**Redirect**: To admin media page with success/error

### 3. GET /api/drive/files
**Purpose**: List image files from user's Google Drive
**Query params**: `?pageToken=&pageSize=50`
**Response**:
```typescript
{
  files: Array<{
    id: string;
    name: string;
    mimeType: string;
    thumbnailLink: string;
    webViewLink: string;
  }>;
  nextPageToken: string;
}
```

### 4. POST /api/drive/import
**Purpose**: Download selected image from Drive and upload to R2
**Body**: `{ fileId: string; filename: string; mimeType: string }`
**Response**: `{ r2Key: string; url: string }`

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| **Drive API Client** | Direct REST API via `fetch` | `googleapis` npm package | **INCOMPATIBLE** with Cloudflare Workers edge runtime (requires Node.js stream, crypto modules) |
| **Authentication** | User OAuth 2.0 | Service Account (JWT) | Loses user context, can't access personal Drive without delegation |
| **Image Download** | Server-side fetch to Drive then R2 PUT | Client-side download + R2 upload | Exposes access token, violates Zero Trust architecture |
| **Token Storage** | D1 `settings` table | Cloudflare KV | KV is for caching, not durable storage; D1 matches existing pattern |

## Google Drive API Query Patterns

### List Only Images
Use MIME type query to filter image files:

```
GET https://www.googleapis.com/drive/v3/files?q=mimeType%20contains%20'image/'
```

**Supported image MIME types** (from [Google Drive docs](https://developers.google.com/drive/api/v3/mime-types)):
- `image/jpeg`
- `image/png`
- `image/gif`
- `image/webp`
- `image/bmp`
- `image/svg+xml`

**Exclude Google Workspace files** (they use different MIME types like `application/vnd.google-apps.document`).

### Pagination
- Use `pageToken` from previous response to fetch next page
- `pageSize` max: 100 (default: 100)
- Fields to request: `files(id,name,mimeType,thumbnailLink,webViewLink),nextPageToken`

### Download File
```
GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media
Authorization: Bearer {access_token}
```

## Integration Points with Existing Infrastructure

### Reuse Existing Patterns
1. **YouTube OAuth flow** (`functions/api/routes/youtube/index.ts`): Copy token refresh logic
2. **Media upload pipeline** (existing R2 integration): Use for storing imported images
3. **Error handling** (`ApiError` class from middleware): Maintain consistent error responses
4. **Audit logging** (`logAuditAction`): Track Drive API usage for security

### R2 Integration
Use existing R2 binding pattern from `functions/api/routes/videos/index.ts`:

```typescript
// Upload to R2
const r2Key = `drive-imports/${nanoid()}-${filename}`;
await c.env.R2.put(r2Key, imageBuffer, {
  httpMetadata: { contentType: mimeType },
});
```

### Frontend Integration
- Create new route: `/admin/media/drive` (alongside existing `/admin/media`)
- React component for file browser (similar to existing gallery management)
- Import button triggers `/api/drive/import` endpoint

## What to Avoid

### Do NOT Add
- ❌ **`googleapis` npm package**: Incompatible with Workers edge runtime
- ❌ **`@google-cloud/storage`**: Not needed, we use R2
- ❌ **`sharp`**: Existing pipeline already handles image optimization
- ❌ **Client-side Drive API calls**: Exposes access token, violates security architecture
- ❌ **Video handling**: Focus on images only (per milestone requirements)

### Anti-Patterns
- ❌ Storing access token in D1 (store refresh token only)
- ❌ Hardcoding OAuth credentials in code (use environment variables)
- ❌ Ignoring pagination (Drive can have thousands of files)
- ❌ Downloading non-image files (filter by MIME type server-side)

## Installation

```bash
# No new dependencies required
# Uses existing packages in package.json:
# - hono, @hono/zod-openapi, drizzle-orm, zod, jose, p-retry
```

**Note**: All required libraries are already in `package.json`. The Google Drive API integration can be implemented with ZERO new npm dependencies by using native `fetch` for REST API calls.

## Sources

- [Google Drive API REST Documentation](https://developers.google.com/drive/api/v3/reference/files/list) - HIGH confidence (official docs, verified 2026)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2) - HIGH confidence (official docs)
- [Google Drive MIME Types](https://developers.google.com/drive/api/v3/mime-types) - HIGH confidence (official docs)
- [How to Authenticate Google APIs on Cloudflare Workers](https://medium.com/@tamnvhustcc/how-to-authenticate-google-apis-on-cloudflare-workers-in-2025-a-complete-guide-with-custom-jwt-80614398425a) - MEDIUM confidence (community resource, 2025)
- [Google OAuth 2.0 for Service Accounts using CF Worker](https://community.cloudflare.com/t/example-google-oauth-2-0-for-service-accounts-using-cf-worker/258220) - MEDIUM confidence (community discussion)
- [Edge Runtime vs Node.js Runtime](https://juejin.cn/post/7551997631111888906) - MEDIUM confidence (explains why googleapis doesn't work in Workers)
- [Existing ARESWEB YouTube Integration](functions/api/routes/youtube/index.ts) - HIGH confidence (internal codebase, verified pattern)
