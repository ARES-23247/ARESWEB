---
wave: 1
depends_on: []
files_modified:
  - "src/components/calendar/MonthViewGrid.tsx"
autonomous: true
---

# Phase 04: Calendar Hover CSS Fixes - Plan

## Requirements
- CAL-02: Hovering over calendar events should not cause scrollbars to appear in the calendar cells or disrupt the month view grid layout.

## Verification Criteria
- [x] Hovering over a calendar event does not trigger a scrollbar on the parent cell.
- [x] The calendar layout remains stable and does not shift.

## Tasks

```xml
<task>
  <action>
    Modify `src/components/calendar/MonthViewGrid.tsx` to fix the layout shift and scrollbar appearance on event hover.
    
    1. In the `MonthViewGrid` component, locate the container for events: `className="flex flex-col gap-1 overflow-y-auto max-h-[80px] scrollbar-thin scrollbar-thumb-white/10"`.
    2. Change the container's classes to remove `overflow-y-auto` and `max-h-[80px]` since we only display up to 3 events and a "+X more" text, which naturally fit without needing internal scrolling. Use: `className="flex flex-col gap-1 relative z-10"`.
    3. Modify the event `<Link>` elements. To prevent `hover:scale-105` from clipping or triggering scrollbars, ensure the container does not clip them.
    4. Change the `<Link>` class string to include relative positioning and higher z-index on hover:
       Change: `className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm truncate block transition-transform hover:scale-105 ..."`
       To: `className="relative text-[10px] font-bold px-1.5 py-0.5 rounded-sm truncate block transition-all hover:scale-105 hover:z-50 hover:shadow-lg origin-left ..."` (Make sure to preserve the event color utility).
    5. Also add `z-10` natively so hovering brings it to `z-50`.
  </action>
  <read_first>
    - src/components/calendar/MonthViewGrid.tsx
  </read_first>
  <acceptance_criteria>
    - src/components/calendar/MonthViewGrid.tsx contains `flex flex-col gap-1` without `overflow-y-auto`.
    - The `<Link>` for events has `hover:z-50` and `relative` applied.
  </acceptance_criteria>
</task>
```
