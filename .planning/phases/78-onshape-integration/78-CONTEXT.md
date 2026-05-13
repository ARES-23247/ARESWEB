# Phase 78: Onshape CAD Integration - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers Onshape CAD platform integration for the ARES Web Portal, enabling FTC team members to view 3D CAD models, export STL/STEP files for 3D printing and manufacturing, and synchronize Bill of Materials (BOM) data with the team's inventory system. The integration uses OAuth2 for user authentication (not service account) since Onshape APIs operate on behalf of specific users with their own document permissions.

**Core Capabilities:**
- Display CAD model thumbnails and metadata from Onshape documents
- Export parts and assemblies to STL (3D printing) and STEP (manufacturing) formats
- Synchronize BOM data including part names, materials, and quantities
- Role-based access control (public models vs. team-only documents)

</domain>

<decisions>
## Implementation Decisions

### Authentication Strategy
- **D-01:** Use OAuth2 3-legged flow (not API keys) — users authenticate with their own Onshape credentials
- **D-02:** Store OAuth tokens per-user in D1 (not service account pattern like Google integrations)
- **D-03:** Token storage: `onshape_credentials` table with user_id, access_token, refresh_token, expires_at
- **Rationale:** Onshape's permission model is user-scoped; each user has access to different documents based on their Onshape team permissions. Service accounts would require sharing all documents publicly.

### Document Access Model
- **D-04:** Public documents — cache metadata in `onshape_documents` table, no auth required to view
- **D-05:** Private documents — require user OAuth token, real-time API calls (no caching of private data)
- **D-06:** Public flag set by document owner through admin interface or Onshape sharing settings
- **Rationale:** FTC CAD models can be shared publicly (outreach, sponsors) while keeping designs-in-progress private.

### API Proxy Pattern
- **D-07:** All Onshape API calls go through backend routes (`/api/onshape/*`)
- **D-08:** Never expose Onshape API base URL or authentication headers to client
- **D-09:** Stream export responses (STL/STEP) directly from Onshape to client
- **Rationale:** Zero Trust security compliance, prevents CORS issues, hides API keys/tokens.

### Export Workflow
- **D-10:** Synchronous export for STL (faster, simpler)
- **D-11:** Asynchronous export for STEP and other formats (requires polling)
- **D-12:** Export URLs are temporary — generate signed URLs through Onshape, don't store files permanently
- **Rationale:** STL is smaller and faster to generate; STEP files may take time for complex assemblies.

### BOM Synchronization
- **D-13:** Fetch BOM data on-demand (not cached) since it changes frequently during design iterations
- **D-14:** Store sync history in `onshape_bom_history` table for audit trail
- **D-15:** Map Onshape part IDs to inventory system (future Phase 999.3)
- **Rationale:** Design data changes often; stale BOMs are worse than no BOMs.

### Rate Limiting
- **D-16:** Implement per-user rate limiting (Onshape API has strict limits)
- **D-17:** Cache `X-Rate-Limit-Remaining` header from responses
- **D-18:** Queue expensive operations (exports) when rate limit near
- **Rationale:** Onshape API returns 429 when limits exceeded; need graceful degradation.

### Claude's Discretion
- Exact rate limit thresholds (Onshape doesn't publish them; will infer from testing)
- Export timeout values (default: 30 seconds for STL, 5 minutes for async exports)
- Cache TTL for public document metadata (default: 1 hour)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Onshape API Documentation
- [Onshape REST API Introduction](https://onshape-public.github.io/docs/api-intro/) — Base URL, request/response format, versioning
- [Onshape OAuth Documentation](https://onshape-public.github.io/docs/auth/oauth/) — OAuth2 3-legged flow, token endpoints
- [Onshape Assemblies API](https://onshape-public.github.io/docs/api-adv/assemblies/) — BOM retrieval, assembly structure
- [Onshape Import/Export API](https://onshape-public.github.io/docs/api-adv/translation/) — STL/STEP export endpoints
- [Glassworks API Explorer](https://cad.onshape.com/glassworks/explorer) — Interactive API testing

### Project Requirements
- `.agents/skills/aresweb-zero-trust-security/SKILL.md` — Security requirements (proxy pattern, no client-side secrets)
- `.planning/REQUIREMENTS.md` — Full project requirements
- `.planning/ROADMAP.md` — Phase 78 context within milestone

### Existing Patterns
- `functions/api/routes/google-drive/index.ts` — OAuth integration pattern (Phase 73/74)
- `functions/utils/gcalSync.ts` — Token management patterns (reference only, different auth flow)
- `src/db/schema.ts` — D1 database schema patterns

</canonical_refs>

<onshape_api_context>
## Onshape API Key Facts

### Base URLs
- Standard: `https://cad.onshape.com/api`
- Enterprise: `https://{companyName}.onshape.com/api`

### API Versioning
- Current versions: v6, v7, v8, v9, v10, v15 (latest as of 2026-04-24)
- Version format: `https://cad.onshape.com/api/v{version}/{endpoint}`
- **Recommendation:** Use v10 for stability, or v15 for latest features

### ID Format
- Document ID (did): 24 characters, uniquely identifies a document
- Workspace ID (wid): 24 characters, mutable editing context
- Version ID (vid): 24 characters, immutable snapshot
- Microversion ID (mid): 24 characters, auto-created on each edit
- Element ID (eid): 24 characters, identifies Part Studio/Assembly/Drawing

### URL Pattern
```
https://cad.onshape.com/api/v{version}/documents/{did}/{w|v|m}/{wvmid}/e/{eid}
```

### Key Endpoints
- `GET /documents` — List all documents accessible to user
- `GET /documents/{did}` — Get document details
- `GET /documents/{did}/{wvm}/{wvmid}/elements` — List elements in document
- `GET /assemblies/{eid}/bom` — Get Bill of Materials
- `GET /partstudios/{eid}/stl` — Export STL (synchronous)
- `POST /partstudios/{eid}/export` — Start async export (STEP, etc.)

### Authentication Methods
1. **OAuth2** — For multi-user apps (our choice)
   - Authorization endpoint: `https://cad.onshape.com/oauth/oauth/authorize`
   - Token endpoint: `https://cad.onshape.com/oauth/oauth/token`
   - Scopes: Request user-specific permissions

2. **API Keys** — For server-to-server (not suitable for our use case)

### Rate Limiting
- Indicated by `X-Rate-Limit-Remaining` header
- Returns 429 when exceeded
- Plan-specific limits (not publicly documented)

</onshape_api_context>

<code_context>
## Existing Code Insights

### Reusable Assets
- `functions/api/routes/google-drive/` — Similar OAuth integration pattern (Phase 74)
- Hono route patterns — `typedHandler`, zod schema validation
- D1 database utilities — Prepared statements, error handling

### Integration Points
- New D1 tables: `onshape_credentials`, `onshape_documents`, `onshape_parts`, `onshape_bom_history`
- New environment variables: `ONSHAPE_CLIENT_ID`, `ONSHAPE_CLIENT_SECRET`, `ONSHAPE_REDIRECT_URI`
- New utility module: `functions/utils/onshapeAuth.ts`
- New API routes: `functions/api/routes/onshape/`

### Dependencies to Add
- OAuth client library (may need to add simple fetch-based implementation)

</code_context>

<specifics>
## Specific Ideas

### Database Schema
```sql
-- User OAuth tokens
CREATE TABLE onshape_credentials (
  user_id TEXT PRIMARY KEY,  -- Maps to cf-access-authenticated-user-email
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,  -- Unix timestamp
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP
);

-- Cached public document metadata
CREATE TABLE onshape_documents (
  document_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  owner_name TEXT,
  is_public BOOLEAN DEFAULT false,
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- BOM sync history
CREATE TABLE onshape_bom_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL,
  element_id TEXT NOT NULL,
  part_count INTEGER NOT NULL,
  synced_by TEXT NOT NULL,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### API Route Structure
```
functions/api/routes/onshape/
├── index.ts           # Main router
├── auth.ts            # OAuth flow endpoints
├── documents.ts       # List/get documents
├── exports.ts         # STL/STEP export
└── bom.ts             # Bill of Materials
```

### Frontend Components
```
src/components/onshape/
├── OnshapeAuthButton.tsx   # Connect to Onshape
├── ModelGallery.tsx        # Grid of CAD models
├── ModelCard.tsx           # Single model with thumbnail
├── ExportButton.tsx        # Download STL/STEP
└── BOMViewer.tsx           # Bill of Materials table
```

</specifics>

<deferred>
## Deferred Ideas

- **3D Model Viewer:** Embed actual 3D viewer (Three.js or onshape-viewer-embed) deferred to future phase
- **Webhook Support:** Onshape webhooks for CAD change notifications deferred to future phase
- **Inventory Integration:** Mapping parts to physical inventory (Phase 999.3)
- **Version History:** Tracking document versions and changes over time
- **Multi-Document BOM:** Aggregated BOM across multiple documents

</deferred>

---

*Phase: 78-Onshape CAD Integration*
*Context gathered: 2026-05-12*
