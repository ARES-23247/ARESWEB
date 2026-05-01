# Phase 81: Task & Goal Tracking - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement a project management Kanban dashboard for subteams to track tasks and goals within the ARESWEB Dashboard, leveraging the existing Cloudflare D1 database and Liveblocks infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Data Storage Strategy
- Cloudflare D1 Database — Native to your stack, fast, no external dependencies
- Yes, use existing Liveblocks infrastructure for real-time presence/syncing
- No, keep it minimal text/markdown — Keeps database lightweight for v1
- By Subteam (Software, Build, Business) — Fits standard FRC team structure

### User Interface & Kanban Mechanics
- To Do, In Progress, Blocked, Done — Classic, effective flow
- Embedded within Dashboard, but features a "Fullscreen Toggle" button
- Slide-out side panel (Drawer) — Fast editing without losing board context
- `dnd-kit` — Modern, accessible, highly performant

### Task Properties & Access Control
- Any signed-in team member — Encourages full team collaboration
- Yes, allow multiple assignees per task
- Yes (Low, Medium, High, Critical) — Colored tags make triage easy
- Yes, add to `schema.sql` and run standard Kysely type generation

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Existing Liveblocks provider and yjs integration for real-time syncing.
- Existing Dashboard layout components (`DashboardSidebar`, `DashboardRoutes`).

### Established Patterns
- Kysely ORM for database access and `schema.sql` for migrations.
- Hono backend API patterns with Zod validation.

### Integration Points
- Add a new route in `src/pages/Dashboard.tsx` or `src/components/dashboard/DashboardRoutes.tsx` for the Kanban board.
- Modify `schema.sql` and run `db:setup:local`.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
