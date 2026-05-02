# Phase 88: refactor-recurring-events-fix-calendar-overflow-add-repeat-f - Discussion Log

> **Note:** This log is for human reference, retrospective analysis, and audits. It is NOT consumed by downstream agents (researcher, planner, executor). Downstream agents read `CONTEXT.md` instead.

**Date:** 2026-05-01

## 1. Calendar Overflow UI

**Options presented:**
- A) Show a maximum of 3 events per day, and display a "+X more" button that opens a popup/drawer with the full list.
- B) Make the calendar cell vertically scrollable so the user can just scroll through all events on that day.
- C) Another approach?

**User selected:** A

**Follow-up notes:**
- Will display up to 3 cards per day in the grid and a "+X more" overlay for the remainder.

## 2. Deletion & Exceptions

**Options presented:**
- A) Should we just allow admins to delete/edit any individual row directly from the UI? (This is the simplest approach and treats them as independent events once created).
- B) Or do you want them tightly linked, where deleting one requires complex "Exception Date" logic tied back to a single "Master Event"?

**User selected:** A

**Follow-up notes:**
- Decided to treat individual recurrences as independent rows.

## 3. Recurrence Limits UX

**Options presented:**
- A) Add an "End after X occurrences" input (e.g., repeat 10 times).
- B) Add an "End by date" input (e.g., repeat until Dec 31st).
- C) Add both options and let the user pick which one they want to use.

**User selected:** C

**Follow-up notes:**
- Need to implement both occurrence count and end date limiters on the form.

---

*End of discussion log for Phase 88.*
