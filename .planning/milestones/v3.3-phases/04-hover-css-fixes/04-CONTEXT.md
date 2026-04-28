# Phase 04: Calendar Hover CSS Fixes - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

## Phase Boundary

Resolve calendar layout regressions caused by hover-induced expansion and event content overflow. Prevent scrollbars from appearing on event hover.

## Implementation Decisions

### Hover Style
- **D-01:** Ensure the event item expands visually but does not push adjacent layout nodes. Use `position: absolute` with a high `z-index` (e.g. `z-50`) during hover.
- **D-02:** Remove any CSS grid layout expansions that force the calendar cell's content height to overflow. The cell container should remain fixed in dimensions during hover interactions.

### Cell Overflow
- **D-03:** Prevent scrollbar generation in calendar cells (e.g., `overflow: visible` for calendar cell bounding boxes to allow absolute positioned events to pop out, rather than scrolling inside the cell).

### The Agent's Discretion
- Adjust Tailwind classes (z-index scaling, shadow depth, padding changes) as appropriate to make the hover effect look good without layout shift.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source Code References
- `app/routes/events.$eventId.tsx` — Event details UI (where users land from calendar)
- Calendar grid component containing `react-calendar` / custom cell implementations (must locate via codebase search).

No external specs — requirements fully captured in decisions above.

## Existing Code Insights

### Reusable Assets
- TailwindCSS z-index and shadow utilities are already in the project and should be leveraged.

### Established Patterns
- We typically use tailwind `group-hover:` or native `hover:` utilities rather than custom CSS stylesheets.

### Integration Points
- Calendar rendering components.

## Specific Ideas

No specific requirements — open to standard CSS approaches as long as layout doesn't shift and scrollbars don't appear.

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 04-Calendar Hover CSS Fixes*
*Context gathered: 2026-04-28*
