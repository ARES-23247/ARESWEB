---
wave: 1
depends_on: [83]
files_modified:
  - schema.sql
  - shared/schemas/contracts/eventContract.ts
  - functions/api/routes/events.ts
  - src/components/events/EventEditDrawer.tsx
autonomous: true
---

# Phase 84: Make Recurring Calendar Events

## Goal
Implement recurring calendar events by adding an `rrule` field to track recurrence and auto-generating child events in the database.

## Tasks

<task>
<id>84-1</id>
<title>Schema Update for Recurrence</title>
<read_first>
- schema.sql
</read_first>
<action>
Modify `schema.sql` to add `recurrence_rule TEXT` and `parent_event_id TEXT` to the `events` table. Run `npm run db:setup:local` and `npm run db:generate-types`.
</action>
<acceptance_criteria>
- `schema.sql` includes `recurrence_rule` and `parent_event_id`.
- Types generated successfully.
</acceptance_criteria>
</task>

<task>
<id>84-2</id>
<title>Update Event Contracts</title>
<read_first>
- shared/schemas/contracts/eventContract.ts
</read_first>
<action>
Add `recurrence_rule` and `parent_event_id` to Zod validation schemas for event creation and fetching.
</action>
<acceptance_criteria>
- Schemas accept the new fields.
</acceptance_criteria>
</task>

<task>
<id>84-3</id>
<title>Backend Route for Recurring Event Generation</title>
<read_first>
- functions/api/routes/events.ts
</read_first>
<action>
Update the `POST` route in `events.ts`. If an event is created with `recurrence_rule`, use a basic generator (or `rrule.js` library if installed, else implement simple weekly/monthly) to insert the parent event and N child events into the database. Update `DELETE` to also cascade.
</action>
<acceptance_criteria>
- Backend parses `recurrence_rule` and saves child events.
</acceptance_criteria>
</task>

<task>
<id>84-4</id>
<title>UI Implementation</title>
<read_first>
- src/components/events/EventEditDrawer.tsx (or modal)
</read_first>
<action>
Add a recurring UI select (None, Daily, Weekly, Bi-Weekly, Monthly) mapped to `recurrence_rule` string in the Event creation UI.
</action>
<acceptance_criteria>
- UI provides recurring options.
</acceptance_criteria>
</task>
