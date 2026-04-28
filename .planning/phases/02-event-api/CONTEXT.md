# Phase 02: Event API & Schema - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning
**Source:** System Verification

<domain>
## Phase Boundary

The original requirement for Phase 02 was "Construct D1 database tables and tRPC routes for local event management". Upon auditing the codebase, it was discovered that the backend `events` table (in `schema.sql`) and the API contract (`shared/schemas/contracts/eventContract.ts`) alongside its Hono handler (`functions/api/routes/events/handlers.ts`) **already exist and are fully featured**.

Therefore, the scope of Phase 02 is adapted to wire the newly created `MonthViewGrid` and `AgendaViewList` React components (from Phase 01) to the actual data source provided by `api.events.getEvents` via `ts-rest`, deprecating the `mockCalendarEvents` usage.
</domain>

<decisions>
## Implementation Decisions

### Data Integration
- Map the response from `api.events.getEvents.useQuery` to the `CalendarEvent` interface expected by `MonthViewGrid` and `AgendaViewList`.
- Ensure date strings returned from the API (`date_start`, `date_end`) are properly instantiated as JavaScript `Date` objects before being passed to the calendar components.
- Delete `EventMockData.ts` or remove its usage from `Events.tsx`.

### the agent's Discretion
- Consider whether `EventMockData.ts` should be deleted entirely or kept for Storybook/testing purposes. If kept, ensure it is no longer imported in the production `Events.tsx` module.
</decisions>

<canonical_refs>
## Canonical References

### Data Contracts
- `shared/schemas/contracts/eventContract.ts` — Defines the `eventResponseSchema` expected from the backend.
- `src/components/calendar/MonthViewGrid.tsx` — Defines the `CalendarEvent` interface structure required for UI rendering.
</canonical_refs>

<specifics>
## Specific Ideas

- The mapping logic should gracefully handle nullish values in the API response (e.g., fallback `end` date if `date_end` is null, perhaps defaulting to 1 hour after `start`).
</specifics>

<deferred>
## Deferred Ideas

- Full Google Calendar bidirectional sync (reserved for Phase 03).
</deferred>
