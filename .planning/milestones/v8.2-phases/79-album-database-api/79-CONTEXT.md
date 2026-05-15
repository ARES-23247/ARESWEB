# Phase 79: Album Database & API - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the D1 schema and Hono API handlers for the core Album entity.
</domain>

<decisions>
## Implementation Decisions

### Database Identity & Routing
- UUID (`id: text().primaryKey()`) — avoids URL conflicts and follows existing patterns for resources like events and tasks.
- `/[id]` in the frontend / API — robust against title changes since authors will likely rename albums.
- Not strictly enforced title uniqueness — allows multiple albums with the same generic name (e.g., "Build Season", "Champs").

### Album Metadata & Relations
- Store an optional text `description`.
- Cover Photo: Store a `coverImageId` linking to a `media` record. If null, we will fallback to the first media item linked to the album.
- Track creation date and the user ID of the author.

### API Deletion Semantics
- Use Soft Delete (`isDeleted` flag) for the Album record itself to allow undo/recovery.
- Keep the media records intact in R2 when an Album is deleted; simply soft delete the Album which hides the Album-to-Media associations.

### Claude's Discretion
You decide the exact API endpoint patterns (e.g., `/api/albums`), relying on existing Hono routing standards found in the ARESWEB API.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Drizzle ORM setup in `src/db/schema.ts`
- Error handling patterns in `src/api/` via generic exception handling wrappers.

### Established Patterns
- Most tables use text IDs and `isDeleted` / `createdAt` columns.
- Standard UUID `crypto.randomUUID()` generation on API side.

### Integration Points
- `schema.ts` for database exports.
- D1 Database router in Hono setup.
</code_context>

<specifics>
## Specific Ideas

No specific user-requested requirements for this backend phase beyond the ROADMAP goals.
</specifics>

<deferred>
## Deferred Ideas

None
</deferred>
