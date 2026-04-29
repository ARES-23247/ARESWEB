# Phase 02: Event API & Schema - Plan

**Status:** Verified
**Verification:** Codebase audit confirmed existing backend infrastructure; scope adapted to frontend integration.

## 1. Goal

Integrate the `Events.tsx` page with the live `api.events.getEvents` data, removing the hardcoded `mockCalendarEvents` and establishing end-to-end typed event flow for the local calendar ecosystem.

## 2. Approach

1. **Transform Live Data**: Since `MonthViewGrid` and `AgendaViewList` expect a `CalendarEvent` object (which requires actual `Date` objects for `start` and `end`), we need to map the `events` array retrieved from the `ts-rest` client into this format.
2. **Update Components**: Pass the mapped live data into the `<MonthViewGrid events={liveEvents} />` and `<AgendaViewList events={liveEvents} />` components instead of the mock data.
3. **Handle Edge Cases**: If `date_end` is null from the backend, default the end date to 1 hour after `date_start` for UI purposes. Ensure the `type` property maps correctly from the backend's `category` property.
4. **Cleanup**: Remove `mockCalendarEvents` from the `Events.tsx` import.

## 3. Tasks

- [ ] **Task 1: Implement Data Transformer in `Events.tsx`**
  - Update `src/pages/Events.tsx`.
  - Add a `useMemo` block to transform the existing `events` array (which already pulls from `api.events.getEvents`) into `CalendarEvent[]`.
  - Parse `date_start` into a `Date`.
  - Parse `date_end` into a `Date`, or default to `addHours(date_start, 1)` if null.
  - Map `category` to `type` (ensuring it falls into `'internal' | 'outreach' | 'external'`).
- [ ] **Task 2: Inject Live Data into Calendar UI**
  - Update `src/pages/Events.tsx`.
  - Replace `mockCalendarEvents` with the transformed `mappedEvents` array in both the `MonthViewGrid` and `AgendaViewList` component props.
- [ ] **Task 3: Clean up Mock Data**
  - Remove the import for `mockCalendarEvents` in `Events.tsx`.
  - Delete `src/components/calendar/EventMockData.ts` if no longer used by any other component (or just leave it unimported).

## 4. Acceptance Criteria

- [ ] The `MonthViewGrid` and `AgendaViewList` components successfully render events fetched from the live database.
- [ ] All dates are correctly parsed and displayed in the local timezone without crashing date-fns functions.
- [ ] Hardcoded mock data is no longer utilized in the production `Events.tsx` rendering path.
