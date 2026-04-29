---
phase: 01
status: active
---

# Phase 01: Calendar UI Foundation

## Objective
Build the themed React calendar components (month/agenda views) and subscription links, enforcing the ARES brand aesthetic defined in the UI-SPEC. This phase focuses entirely on the frontend UI, mocking the event data until the backend API is built in Phase 02.

## Tasks

### 1. `components/calendar/CalendarSubscriptionBanner.tsx`
- **Objective:** Create a CTA component for users to subscribe to the Google `.ics` feed.
- **Details:** 
  - Render a prominent banner or card using the `.hero-card` class.
  - Button uses `bg-ares-red` with text "Subscribe to Google Calendar".
  - Icon: `CalendarPlus` from `lucide-react`.
- **Validation:** Component renders correctly in storybook or a test page with proper ARES branding.

### 2. `components/calendar/EventMockData.ts`
- **Objective:** Create mock event data to build the calendar views before the backend is ready.
- **Details:**
  - Export an array of event objects: `{ id, title, start, end, description, location, type }`.
  - Include multi-day events, single-day events, and past/future events for thorough UI testing.

### 3. `components/calendar/MonthViewGrid.tsx`
- **Objective:** Build the core month-view calendar grid.
- **Details:**
  - Build a 7-column CSS grid for days of the week.
  - Calculate the current month's days and pad with previous/next month's trailing days.
  - Render day cells with `bg-obsidian` and borders (`border-ares-bronze/20`).
  - Render mock events inside the day cells. Limit to 3 events per day with a "+X more" indicator if overflow occurs.
  - Use `text-ares-red` to highlight the current active date.

### 4. `components/calendar/AgendaViewList.tsx`
- **Objective:** Build an agenda/list view for upcoming events.
- **Details:**
  - Render a list of events grouped by date.
  - Use `.hero-card` or simple `border-b` dividers to separate events.
  - Show event times, titles, and locations clearly using `text-marble` and `text-ares-gold` for highlights.

### 5. `pages/calendar/index.tsx` (or equivalent Next.js App Router page)
- **Objective:** Assemble the calendar page.
- **Details:**
  - Integrate `CalendarSubscriptionBanner`, `MonthViewGrid`, and `AgendaViewList`.
  - Add state to toggle between "Month" and "Agenda" views.
  - Add state for navigating between months (Prev/Next buttons).
  - Empty state (if no events): "No Events Scheduled" / "There are no events for this timeframe."

## Requirements Satisfied
- **CAL-01:** Custom ARES-branded calendar UI (month/agenda views)
- **CAL-05:** Provide UI for users to easily subscribe to the Google `.ics` feed

## Out of Scope
- Fetching real data from D1 or Google Calendar (Phase 02/03).
- Editing or creating events (Phase 02).
