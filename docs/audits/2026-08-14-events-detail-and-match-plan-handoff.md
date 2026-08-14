# Event Detail and Printable Match Plan Strategy Handoff Audit

- Date: August 14, 2026
- Branch: `codex/cycle-19-events-detail`
- Base: `origin/master`
- Supported verification runtime: Node `22.13.1`, pnpm `11.21.0`, OpenJDK `21.0.12`
- Scope: Event detail page handling (`src/app/events/[id]/page.tsx`), metadata and Rich Text AST rendering, realtime RSVPs and volunteer prep hours workflows, media gallery and accessible lightbox, Zulip feed integration, 404/loading error boundaries, and printable event-day match plan strategy handoff (`src/app/tournaments/[id]/TournamentMatchPrintDialog.tsx`).
- Production mutation: none

## Subsystem Audit & Architecture Overview

### 1. Event Detail Lifecycle & 404 / Error Boundaries
- **Route & Resolution**: The dynamic route `src/app/events/[id]/page.tsx` consumes the public event API via `fetchPublicEvent(id)`.
- **Loading State**: An accessible spinner and loading skeleton is rendered during initial state hydration.
- **404 Handling**: Unfound calendar items (detected via `CalendarApiError` with HTTP status `404`) render an accessible, branded `Event Record Lost` fallback page with explicit SEO noindex tagging and a prominent navigation escape link back to `/calendar`.
- **Network / API Fault Tolerance**: Non-404 network or server errors transition the view into a resilient `PublicDataState` boundary containing diagnostic information and an interactive retry callback.

### 2. Event Metadata, Calendar Integrations, and Rich Text
- **Temporal Categorization**: Distinguishes between upcoming operations and historical records (past events display a `Historical Record` badge while suppressing action buttons for calendar sync).
- **Calendar Exports**:
  - `Add to calendar (.ics)` dynamically constructs a compliant `VCALENDAR`/`VEVENT` payload with `DTSTART`, `DTEND` (falling back to +2 hours if omitted), `SUMMARY`, and `LOCATION` fields, managing temporary Object URL lifecycle safely.
  - `Add to Google Calendar` links generate properly encoded URLs with parsed AST text summaries and public venue locations.
- **Tiptap AST Rendering**: Detects and parses structured Tiptap JSON AST node trees through `EventDescription`, falling back to safe plain-text rendering for unstructured content.
- **SEO & Social Sharing**: Complete schema.org structured metadata (startDate, endDate, venue) and `ShareButtons` integration.

### 3. Realtime RSVP, Volunteer Tracking, and Role-Based Clearance
- **Zero-Trust Access Boundary**: Sign-up forms, attendance lists, and Zulip discussion feeds enforce strict verification gates (`isVerified`), preventing unauthenticated or unverified visitors from viewing internal roster details.
- **Volunteer & Potluck Logistics**: Captures potluck contributions (`isPotluck`) and volunteer preparation hours (`isVolunteer`), aggregating total prep contributions across all registered attendees.
- **Check-in & Attendance**: Provides self check-in actions for attendees and administrative check-in overrides for team leadership (`admin`/`coach` roles).
- **RSVP Cancellation**: Integrated with a Radix Dialog modal ensuring confirmation before executing document deletion.

### 4. Media Gallery & Photo Lightbox Privacy
- **Public DTO Boundaries**: Public event photos are bounded to safe fields (`id`, `url`, `thumbnailUrl`, `mediumUrl`, `filename`, `uploadedBy`) without exposing PII (e.g. email addresses or private student identifiers).
- **Client-Side Compression**: New uploads are compressed and resized via `resizeAndCompressImage` before posting to `/api/photos/upload-unified`.
- **Accessible Lightbox**: `PhotoLightbox` wraps media in a focused dialog with trap focus, keyboard closing, and clear metadata captions.

### 5. Printable Match Plan Strategy Handoff
- **Tournament Strategy Integration**: `TournamentMatchPrintDialog` provides a dedicated Radix UI printable handoff modal within the match checklist workflow (`TournamentMatchesList`).
- **Complete Strategy Preservation**: The printable view preserves the full saved match schedule and internal scouting notes regardless of active search filter criteria in the UI.
- **Print Optimization**: Print CSS rules isolate the formatted match plan table, summary statistics (checklist completion, record, average scores), and team headers for clean single-action PDF generation and physical printing.

## Test Coverage & Acceptance Verification

The comprehensive test suite in [`src/test/EventDetailPage.test.tsx`](../../src/test/EventDetailPage.test.tsx) exercises:
1. **Loading, 404, & Error Boundaries**: Verifies loading spinners, HTTP 404 "Event Record Lost" states, and `PublicDataState` error recovery.
2. **Metadata & Hero**: Verifies upcoming vs. past temporal flags, cover images, ICS generation/download, Google Calendar links, and Tiptap AST parsing.
3. **Locations & Venues**: Verifies location lookup by ID, directions links, and fallback venues.
4. **Zulip Discussions**: Verifies verified member access and deep linking to Zulip streams.
5. **Realtime RSVPs**: Verifies submission of potluck notes, volunteer prep hours, snapshot updates, cancel confirmation dialogs, and attendance toggles.
6. **Gallery & Lightbox**: Verifies thumbnail rendering, image compression upload pipeline, and lightbox open/close keyboard interactions.
7. **Inline Drawer**: Verifies event management editor opening.
8. **Printable Match Plan Strategy**: Verifies match table rendering, complete checklist preservation under filters, metric calculations, and `window.print()` triggers.

## Local Verification Gate Summary

- `validate:agents`: Passed.
- Root ESLint (`eslint . --max-warnings=0`): Passed with 0 warnings.
- Functions ESLint (`eslint src --max-warnings=0`): Passed with 0 warnings.
- Root TypeScript (`tsc --noEmit`): Passed with 0 errors.
- Functions Build (`tsc`): Passed with 0 errors.
- Authored test suite: `src/test/EventDetailPage.test.tsx` implemented with comprehensive coverage across all event detail and printable match plan handoff flows.
