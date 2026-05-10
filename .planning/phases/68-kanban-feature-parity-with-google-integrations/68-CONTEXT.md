# Phase 68: Kanban Feature Parity with Google Integrations - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrading the Kanban system with Checklists, Labels, Google Attachments, Date/Estimates, Covers, and Task Dependencies to achieve parity with Trello.
</domain>

<decisions>
## Implementation Decisions

### Google Link Processing
- **D-01:** Server-side unfurling to fetch actual document titles to bypass CORS restrictions.
- **D-02:** Rich preview cards with document title, type, and thumbnail/icon.
- **D-03:** Support unlimited attachments per task.
- **D-04:** No access control checks; just store the link and rely on Google's native permission denied screens.

### Zulip Integration
- **D-05:** Automatically post to the task's Zulip topic when a Google Doc is attached.
- **D-06:** Post a message when a checklist reaches 100% completion.
- **D-07:** Cross-link tasks in Zulip when Task A is marked as blocking Task B.

### Label Scope & Colors
- **D-08:** Global workspace labels to keep the board organized and prevent duplicates.
- **D-09:** Restrict to ARES brand palette (defined in Tailwind config).
- **D-10:** Display as full pill badges with text always visible.

### Dependency Enforcement
- **D-11:** Visual warnings only; no strict physical locks on dragging blocked tasks.

### Checklist Complexity
- **D-12:** Plain strings only to keep checklists lightweight and fast.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Schema
- `src/db/schema.ts` — Base database schema for adding new task fields and tables.
- `shared/routes/tasks.ts` — Existing API contract definition for tasks.
- `src/components/kanban/TaskDetailsModal.tsx` — Target UI for the new parity features.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/kanban/GenericKanbanBoard.tsx`: Reusable drag-and-drop context for adding label pills.
- `src/api/tasks.ts`: Existing react-query hooks to be extended.

### Established Patterns
- **Database Schema**: Kysely schemas are migrating to Drizzle; use Drizzle definitions.
- **Zulip Sync**: Re-use existing Zulip integrations to post messages directly to threads.

### Integration Points
- `TaskDetailsModal` will house the new Attachment, Label picker, and Checklist components.
</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>

---

*Phase: 68-kanban-feature-parity-with-google-integrations*
*Context gathered: 2026-05-10*
