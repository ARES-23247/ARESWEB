# Phase 88: refactor-recurring-events-fix-calendar-overflow-add-repeat-f - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Refactor recurring events: fix calendar overflow, add repeat frequency limits, and support individual instance deletion.
</domain>

<decisions>
## Implementation Decisions

### Calendar Overflow UI
- **D-01:** Show a maximum of 3 events per day, and display a "+X more" button that opens a popup/drawer with the full list.

### Deletion & Exceptions
- **D-02:** Allow admins to delete/edit any individual row directly from the UI (treating them as independent events once created).

### Recurrence Limits UX
- **D-03:** Add both "End after X occurrences" and "End by [Date]" options to the event creation form, allowing the user to pick which one they want to use.

### the agent's Discretion
None

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/pages/Events.tsx`: The main calendar view where the "+X more" logic will be implemented.

### Established Patterns
- Events are currently stored as independent rows in D1.

### Integration Points
- Update the UI to render the overflow popup/drawer instead of expanding indefinitely.
- Update the event form to capture recurrence limits.
</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope
</deferred>

---

*Phase: 88-refactor-recurring-events-fix-calendar-overflow-add-repeat-f*
*Context gathered: 2026-05-01*
