# Architecture Patterns: Google Drive API Integration

**Domain:** Google Drive API integration for ARESWEB dashboard
**Researched:** 2026-05-12
**Overall confidence:** HIGH

## Executive Summary

Google Drive API integration into ARESWEB follows existing service account authentication patterns established by Google Calendar integration. The architecture requires:

1. **New API router** (`functions/api/routes/drive/index.ts`) following OpenAPI/Hono patterns
2. **D1 schema extension** for Drive file metadata caching (optional but recommended)
3. **Service account JWT authentication** reusing `gcalSync.ts` utilities
4. **R2 storage pipeline** for imported images using existing media infrastructure
5. **Dashboard UI components** for file browser and import functionality

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Dashboard UI                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ File Browser │  │ File Preview │  │ Import to R2 Button  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │ ts-rest client
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Hono API Routes (drive/)                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │GET /status  │  │GET /files    │  │POST /import-to-r2   │   │
│  └─────────────┘  └──────────────┘  └─────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
         ┌────────────────────┴────────────────────┐
         │                                         │
         ▼                                         ▼
┌──────────────────────┐              ┌─────────────────────────┐
│  Google Drive API    │              │   R2 Storage            │
│  (Service Account)   │              │   (ARES_STORAGE)        │
└──────────────────────┘              └─────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **driveRouter** (new) | All Drive API endpoints, JWT auth, file listing | Google Drive API, D1 (cache), R2 |
| **gcalSync.ts** (existing) | JWT signing for service account OAuth | Google OAuth token endpoint |
| **D1 drive_files_cache table** (new) | Cache Drive file metadata, reduce API calls | driveRouter |
| **Media Router** (existing) | Handle R2 uploads, validation, optimization | R2 bucket |
| **Dashboard UI** (new) | File browser, selection, import interface | driveRouter via ts-rest |

### Data Flow

**Authentication Flow (Service Account JWT):**
```
1. Cloudflare Worker starts request
2. Retrieve GCAL_SERVICE_ACCOUNT_EMAIL and GCAL_PRIVATE_KEY from env
3. Call getGcalAccessToken() from gcalSync.ts
4. JWT signed with RS256, sent to oauth2.googleapis.com/token
5. Receive access_token (valid 1 hour)
6. Use access_token in Authorization: Bearer header for Drive API calls
```

**File Listing Flow:**
```
1. UI calls GET /api/drive/files?q=mimeType contains 'image/'
2. driveRouter checks D1 cache for recent listings (optional)
3. If cache miss or expired, call Drive API v3 /files endpoint
4. Filter by mime types (image/jpeg, image/png, etc.) and folders
5. Return paginated results with nextPageToken support
6. Store in D1 cache with TTL (5 minutes)
```

**Image Import Pipeline:**
```
1. User selects file in Drive browser
2. UI calls POST /api/drive/import-to-r2 with { fileId, fileName }
3. driveRouter fetches file metadata from Drive API
4. driveRouter downloads file content using ?alt=media
5. Validate image magic bytes (reusing media validation)
6. Upload to R2 bucket using existing media infrastructure
7. Return R2 key to UI for immediate use
8. Log audit action
```

## OAuth 2.0 Integration with Existing Patterns

### YouTube Pattern (User Credentials) - NOT USED

The YouTube integration uses **user OAuth 2.0** with refresh tokens:
- User clicks "Connect YouTube"
- Redirected to Google OAuth consent screen
- Authorization code exchanged for access_token + refresh_token
- Refresh token stored in `settings` table (`youtube_refresh_token`)
- Access token refreshed on-demand using refresh token

**Why NOT this pattern for Drive:**
- Requires user to manually authorize
- Tied to individual user's Google account
- Refresh tokens can be revoked
- More complex UI flow (need disconnect/reconnect)

### Google Calendar Pattern (Service Account) - REUSE THIS

The Google Calendar integration uses **service account JWT authentication**:
- Service account created in Google Cloud Console
- Private key stored as environment variable (`GCAL_PRIVATE_KEY`)
- No user interaction required
- Domain-wide delegation enables access to organization Drive
- JWT minted on-demand using RS256 signing
- Access token valid for 1 hour

**Why this pattern for Drive:**
- ✅ Already implemented in `gcalSync.ts` (reuse code)
- ✅ No user authorization UI needed
- ✅ Works across entire organization (Google Workspace domain)
- ✅ More reliable for background operations
- ✅ Aligns with existing Calendar integration

### Implementation: Reuse `gcalSync.ts`

The existing `getGcalAccessToken()` function works for both Calendar and Drive:

```typescript
// Existing function in functions/utils/gcalSync.ts
export async function getGcalAccessToken(config: GCalConfig): Promise<string> {
  const alg = "RS256";
  const formattedKey = config.privateKey.replace(/\\n/g, "\n");
  const pk = await importPKCS8(formattedKey, alg);
  const jwt = await new SignJWT({ 
    scope: "https://www.googleapis.com/auth/drive.readonly"  // CHANGE SCOPE
  })
    .setProtectedHeader({ alg, typ: "JWT" })
    .setIssuer(config.email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(pk);
  
  const res = await fetch("https://oauth2.googleapis.com/token", { ... });
  // ... returns access_token
}
```

**Required scope changes:**
- Calendar: `https://www.googleapis.com/auth/calendar`
- Drive (read-only): `https://www.googleapis.com/auth/drive.readonly`
- Drive (full access): `https://www.googleapis.com/auth/drive`

**Recommendation:** Start with `drive.readonly` scope, upgrade to full `drive` only if write operations needed.

## API Route Structure

### New File: `functions/api/routes/drive/index.ts`

```typescript
import { OpenAPIHono } from "@hono/zod-openapi";
import { ensureAdmin } from "../../middleware";
import { AppEnv, getDb } from "../../middleware";
import { getGcalAccessToken } from "../../../utils/gcalSync";
import { eq } from "drizzle-orm";
import { driveFilesCache } from "../../../src/db/schema"; // New table
import { ApiError } from "../../middleware/errorHandler";
import { logAuditAction } from "../../middleware";

const driveApp = new OpenAPIHono<AppEnv>();
driveApp.use("*", ensureAdmin);

// GET /api/drive/status - Check service account config
driveApp.openapi(checkDriveStatusRoute, async (c) => {
  const env = c.env;
  const hasEmail = !!env.GCAL_SERVICE_ACCOUNT_EMAIL;
  const hasKey = !!env.GCAL_PRIVATE_KEY;
  return c.json({ 
    configured: hasEmail && hasKey,
    serviceAccountEmail: env.GCAL_SERVICE_ACCOUNT_EMAIL || null
  });
});

// GET /api/drive/files - List files with filters
driveApp.openapi(listDriveFilesRoute, async (c) => {
  const { q, pageToken, pageSize, folderId } = c.req.valid("query");
  const db = getDb(c);
  const env = c.env;

  // Check cache first
  const cacheKey = `drive_files_${q || 'all'}_${folderId || 'root'}`;
  const cached = await db.select()
    .from(driveFilesCache)
    .where(eq(driveFilesCache.key, cacheKey))
    .execute();
  
  if (cached.length > 0 && new Date(cached[0].updatedAt).getTime() > Date.now() - 300000) {
    return c.json(JSON.parse(cached[0].value));
  }

  // Get access token
  const accessToken = await getGcalAccessToken({
    email: env.GCAL_SERVICE_ACCOUNT_EMAIL,
    privateKey: env.GCAL_PRIVATE_KEY,
    calendarId: "primary" // Not used for Drive
  });

  // Build query
  const searchParams = new URLSearchParams({
    corpora: "drive",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
    pageSize: pageSize || "50",
    fields: "nextPageToken,files(id,name,mimeType,webContentLink,thumbnailLink,iconLink,parents,modifiedTime,size)",
    q: q || ""
  });
  
  if (pageToken) searchParams.append("pageToken", pageToken);
  if (folderId) searchParams.append("driveId", folderId);

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?${searchParams}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new ApiError("Failed to list Drive files", 502, "DRIVE_API_ERROR");
  }

  const data = await response.json();

  // Cache result
  await db.insert(driveFilesCache)
    .values({ key: cacheKey, value: JSON.stringify(data), updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: driveFilesCache.key,
      set: { value: JSON.stringify(data), updatedAt: new Date().toISOString() }
    })
    .execute();

  return c.json(data);
});

// POST /api/drive/import-to-r2 - Import selected file to R2
driveApp.openapi(importToR2Route, async (c) => {
  const { fileId, fileName, mimeType } = c.req.valid("json");
  const db = getDb(c);
  const env = c.env;

  const accessToken = await getGcalAccessToken({
    email: env.GCAL_SERVICE_ACCOUNT_EMAIL,
    privateKey: env.GCAL_PRIVATE_KEY,
    calendarId: "primary"
  });

  // Download from Drive
  const downloadResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!downloadResponse.ok) {
    throw new ApiError("Failed to download file from Drive", 502, "DRIVE_DOWNLOAD_ERROR");
  }

  const fileBuffer = await downloadResponse.arrayBuffer();

  // Validate image (reusing media validation logic)
  // ... validation code ...

  // Upload to R2
  const r2Key = `drive-imports/${Date.now()}-${fileName}`;
  await env.ARES_STORAGE.put(r2Key, fileBuffer, {
    httpMetadata: { contentType: mimeType }
  });

  // Log audit
  if (c.executionCtx) {
    c.executionCtx.waitUntil(
      logAuditAction(c, "drive_import", "drive_file", fileId, `Imported ${fileName} from Drive to R2`)
    );
  }

  return c.json({ r2Key, fileName, mimeType });
});

export const driveRouter = driveApp;
```

### Register Router in `functions/api/[[route]].ts`

```typescript
import { driveRouter } from "./routes/drive/index";

// In the main app setup:
app.route("/api/drive", driveRouter);
```

## D1 Schema Extensions

### New Table: `drive_files_cache`

```sql
-- In src/db/schema.ts
export const driveFilesCache = sqliteTable("drive_files_cache", {
  key: text().primaryKey(),
  value: text().notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
},
(table) => [
  index("idx_drive_cache_updated").on(table.updatedAt),
]);
```

**Purpose:** Cache Drive API responses to reduce quota usage and improve latency.

**TTL Strategy:**
- File listings: 5 minutes
- Individual file metadata: 10 minutes
- Cleanup: Cron job to delete entries older than 1 hour

**Alternative:** Use Cloudflare KV instead of D1 for caching (better TTL support, but adds dependency).

## Image Import Pipeline: Drive → Worker → R2

### Step 1: Download from Drive API

```typescript
const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
const response = await fetch(downloadUrl, {
  headers: { Authorization: `Bearer ${accessToken}` }
});
const buffer = await response.arrayBuffer();
```

### Step 2: Validate Image (Reuse Media Logic)

```typescript
// Reuse functions from functions/api/routes/media/index.ts
import { isValidImage, normalizeFileNameExtension } from "../../routes/media";

if (!isValidImage(buffer)) {
  throw new ApiError("Invalid image file", 400, "INVALID_IMAGE");
}

const normalizedName = normalizeFileNameExtension(fileName, mimeType);
```

### Step 3: Upload to R2

```typescript
const r2Key = `drive-imports/${Date.now()}-${normalizedName}`;
await env.ARES_STORAGE.put(r2Key, buffer, {
  httpMetadata: { contentType: mimeType },
  customMetadata: {
    source: "google-drive",
    originalFileId: fileId,
    importedAt: new Date().toISOString()
  }
});
```

### Step 4: Return to UI

```typescript
return c.json({
  r2Key,
  url: `/api/media/${r2Key}`,
  fileName: normalizedName,
  mimeType,
  size: buffer.byteLength
});
```

## Integration with Existing Dashboard UI

### New React Components

**1. DriveBrowser.tsx** - File explorer interface
```typescript
interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webContentLink?: string;
  thumbnailLink?: string;
  modifiedTime: string;
  size?: number;
}

export function DriveBrowser() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);

  // useQuery to fetch files from /api/drive/files
  // Display grid/list view with thumbnails
  // Filter controls (images only, folders, date range)
  // Pagination with nextPageToken
}
```

**2. DriveImportButton.tsx** - Import action handler
```typescript
export function DriveImportButton({ file, onImportSuccess }) {
  const importMutation = useDriveImportMutation();

  const handleImport = () => {
    importMutation.mutate(
      { fileId: file.id, fileName: file.name, mimeType: file.mimeType },
      {
        onSuccess: (data) => {
          onImportSuccess(data.r2Key);
        }
      }
    );
  };

  return <button onClick={handleImport}>Import to R2</button>;
}
```

### UI Route: `/dashboard/drive`

Add to existing dashboard routing structure:
```typescript
// In src/pages/dashboard/
export default function DrivePage() {
  return (
    <DashboardLayout>
      <DriveBrowser />
    </DashboardLayout>
  );
}
```

## Patterns to Follow

### Pattern 1: Service Account JWT Authentication
**What:** Mint signed JWTs and exchange for OAuth access tokens
**When:** Calling Google APIs from server-side code
**Example:**
```typescript
// From functions/utils/gcalSync.ts
const accessToken = await getGcalAccessToken({
  email: env.GCAL_SERVICE_ACCOUNT_EMAIL,
  privateKey: env.GCAL_PRIVATE_KEY,
  calendarId: "primary" // Not used for Drive
});

const response = await fetch("https://www.googleapis.com/drive/v3/files", {
  headers: { Authorization: `Bearer ${accessToken}` }
});
```

### Pattern 2: OpenAPI/Hono Route Definitions
**What:** Define routes with Zod schemas for type safety
**When:** All API route definitions
**Example:**
```typescript
import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

export const listDriveFilesRoute = createRoute({
  method: "get",
  path: "/files",
  request: {
    query: z.object({
      q: z.string().optional(),
      pageToken: z.string().optional(),
      pageSize: z.string().optional()
    })
  },
  responses: {
    200: {
      content: { "application/json": { schema: driveFilesResponseSchema } },
      description: "List of Drive files"
    },
    ...standardErrors
  },
  tags: ["drive", "admin"]
});
```

### Pattern 3: Audit Logging
**What:** Log all admin actions for accountability
**When:** Modifying data or external systems
**Example:**
```typescript
if (c.executionCtx) {
  c.executionCtx.waitUntil(
    logAuditAction(c, "drive_import", "drive_file", fileId, `Imported ${fileName}`)
  );
}
```

### Pattern 4: Error Handling with ApiError
**What:** Consistent error response format
**When:** API failures or validation errors
**Example:**
```typescript
if (!response.ok) {
  throw new ApiError(
    "Failed to download from Drive", 
    502, 
    "DRIVE_DOWNLOAD_ERROR"
  );
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Using User OAuth for Drive
**What:** Implementing user authorization flow like YouTube
**Why bad:** 
- Unnecessary when service account works
- Requires user to manually authorize
- Tied to individual user's account (revocation risk)
- More complex UI flow

**Instead:** Use service account JWT authentication (same as Google Calendar)

### Anti-Pattern 2: Not Caching Drive API Responses
**What:** Calling Drive API for every file listing request
**Why bad:**
- Google Drive API has quota limits (100 queries/100 seconds/user)
- Slower response times
- Unnecessary API costs

**Instead:** Cache responses in D1 or KV with 5-minute TTL

### Anti-Pattern 3: Storing Large Files in Memory
**What:** Loading entire file into Worker memory before uploading
**Why bad:**
- Cloudflare Workers have 128MB memory limit
- Large files (>50MB) will cause OOM errors
- Wasteful for small files too

**Instead:** Stream directly from Drive API to R2 (if possible) or process in chunks

### Anti-Pattern 4: Using thumbnailLink Directly in UI
**What:** Displaying Google's thumbnailLink in <img> tags
**Why bad:**
- Links expire after hours
- Not intended for production use
- Will result in broken images

**Instead:** Import to R2 and serve from there, or use webContentLink with proper caching

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| API Quota | Fine (100 req/100s) | Need caching | Implement KV + rate limiting |
| Memory | 128MB limit sufficient | Still OK | Stream large files |
| D1 Cache | Fast enough | Consider KV | Use KV for cache |
| R2 Storage | Negligible cost | Monitor usage | Set lifecycle policies |

**Recommendations:**
- **Caching:** Start with D1, migrate to KV if cache hit rate < 80%
- **Rate Limiting:** Use existing `checkPersistentRateLimit` middleware
- **File Size:** Limit imports to 50MB (Workers memory limit)
- **Pagination:** Always use Drive API pagination (pageSize max 100)

## Environment Variables

### Required

```bash
# Existing (reused from Google Calendar)
GCAL_SERVICE_ACCOUNT_EMAIL=ares-web@ares-23247.iam.gserviceaccount.com
GCAL_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Existing R2 binding
ARES_STORAGE=(R2 bucket binding in wrangler.toml)
```

### Optional (for caching)

```bash
# D1 binding (already exists)
DB=(D1 database binding in wrangler.toml)

# KV for cache (optional, better performance)
# wrangler kv:namespace create DRIVE_CACHE
DRIVE_CACHE=(KV namespace binding)
```

## Build Order & Dependencies

### Phase 1: Core Infrastructure (Dependencies First)
1. **Extend D1 Schema** - Add `drive_files_cache` table
2. **Create `shared/routes/drive.ts`** - Define OpenAPI contracts and Zod schemas
3. **Implement `driveRouter`** - Basic route skeleton with auth middleware

### Phase 2: Authentication & API Integration
4. **Extend `getGcalAccessToken()`** - Add Drive scope support (or create generic version)
5. **Implement GET /api/drive/status** - Verify service account config
6. **Implement GET /api/drive/files** - File listing with caching

### Phase 3: Import Pipeline
7. **Implement POST /api/drive/import-to-r2** - Download + upload flow
8. **Add image validation** - Reuse media validation logic
9. **Add audit logging** - Track all imports

### Phase 4: Dashboard UI
10. **Create DriveBrowser component** - File explorer UI
11. **Create DriveImportButton component** - Import action handler
12. **Add /dashboard/drive route** - Integrate into dashboard

### Phase 5: Testing & Polish
13. **Write unit tests** - Test handlers, caching, validation
14. **Write E2E tests** - Test full import flow
15. **Performance optimization** - Add streaming, optimize cache TTL

## Key Dependencies

### Existing Code to Reuse
- `functions/utils/gcalSync.ts` - JWT authentication ⭐ **CRITICAL DEPENDENCY**
- `functions/api/routes/media/index.ts` - Image validation, R2 upload patterns
- `functions/api/middleware/auth.ts` - `ensureAdmin` middleware
- `shared/routes/common.ts` - Standard error schemas
- `src/db/schema.ts` - D1 table definitions

### New Code to Create
- `functions/api/routes/drive/index.ts` - Main Drive router
- `shared/routes/drive.ts` - OpenAPI contracts
- `src/db/schema.ts` (extension) - Add `driveFilesCache` table
- Dashboard UI components (TypeScript React)

## Migration Path from Existing Infrastructure

### No Breaking Changes
- All new code (new router, new routes)
- Reuses existing auth middleware
- Reuses existing D1 database (new table only)
- Reuses existing R2 bucket (new prefix only)

### Configuration Changes
- **Service Account:** Ensure domain-wide delegation enabled for Drive API
- **Environment:** Verify `GCAL_SERVICE_ACCOUNT_EMAIL` and `GCAL_PRIVATE_KEY` set
- **Wrangler:** No changes needed (reuses existing bindings)

## Security Considerations

### Zero Trust Compliance
- **Authentication:** Uses existing `ensureAdmin` middleware (CF Access JWT validation)
- **Authorization:** Only admins can access Drive integration
- **Audit:** All imports logged to audit_log table

### Data Protection
- **Service Account Key:** Stored as Workers secret (encrypted at rest)
- **File Access:** Service account only has access to configured Google Workspace domain
- **R2 Storage:** Inherits existing R2 security (private bucket, signed URLs)
- **Cache:** No sensitive data in cache (file IDs and metadata only)

### Rate Limiting
- Use existing `checkPersistentRateLimit` middleware
- Suggested limits:
  - File listing: 30 requests/minute per IP
  - File imports: 10 requests/minute per user

## Sources

### Official Documentation
- [Google Drive API v3 - Files: list](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list) - **HIGH confidence** (official docs)
- [Google Drive API v3 - Files Resource](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) - **HIGH confidence** (official docs)
- [Using OAuth 2.0 for Server to Server Applications](https://developers.google.com/identity/protocols/oauth2/service-account) - **HIGH confidence** (official docs)
- [Download and export files | Google Drive](https://developers.google.com/workspace/drive/api/guides/manage-downloads) - **HIGH confidence** (official docs)

### Implementation Guides
- [How to Authenticate Google APIs on Cloudflare Workers in 2025](https://medium.com/@tamnvhustcc/how-to-authenticate-google-apis-on-cloudflare-workers-in-2025-a-complete-guide-with-custom-jwt-80614398425a) - **HIGH confidence** (verified, recent 2025-05-04)
- [Google Drive Index with Cloudflare Workers](https://github.com/iariaw/Google-Drive-index) - **MEDIUM confidence** (community implementation)

### ARESWEB Existing Code
- `functions/utils/gcalSync.ts` - **HIGH confidence** (internal code)
- `functions/api/routes/youtube/index.ts` - **HIGH confidence** (internal code)
- `functions/api/routes/media/index.ts` - **HIGH confidence** (internal code)
- `src/db/schema.ts` - **HIGH confidence** (internal code)

### Community Resources
- [Stack Overflow: Drive API mimeType filtering](https://stackoverflow.com/questions/62069155/how-to-filter-google-drive-api-v3-mimetype) - **MEDIUM confidence** (community knowledge)
- [Cloudflare Workers R2 documentation](https://developers.cloudflare.com/r2/) - **HIGH confidence** (official docs)
