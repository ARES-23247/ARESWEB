# Phase 41: Notification State Fix - Context

**Status:** Ready for planning

<domain>
## Phase Boundary

Resolve the persistent notification state issue in the UI and notification bar where notifications persist even when handled or marked read.
</domain>

<decisions>
## Implementation Decisions

### Client-Side Cache Invalidation
- UI Update on "Mark Read": Invalidate the `react-query` cache for the notification key to ensure immediate sync.
- "Mark All as Read" Action: Yes, invalidate the entire notification list cache.
- Mutation Failure Handling: Rollback the optimistic UI update to prevent false positives.
- Badge Count Derivation: Automatically derived from the length of unread items in the query cache for a single source of truth.

### the agent's Discretion
- All implementation choices and detailed hook modifications are at the agent's discretion.

</decisions>

<code_context>
## Existing Code Insights

- `src/hooks/useDashboardNotifications.ts` handles the notification fetching logic.
- `src/hooks/useMergedNotifications.ts` merges notification logic.
- `src/components/Navbar.tsx` and `DashboardSidebar.tsx` display the notification badges.

</code_context>

<specifics>
## Specific Ideas

- The user mentioned: "notifications persist in the notification bar even wehn handled/marked read"
- Ensure that the "action-items" and "notifications" query keys are invalidated correctly.

</specifics>

<deferred>
## Deferred Ideas

- None
</deferred>
