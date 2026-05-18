# Milestone v8.3 Requirements: Tournament Awards & Robot Version Tracking

## Category: Tournament Awards Integration (AWARDS)

- [ ] **AWARDS-01**: Link tournament awards won to the existing team awards database entity to ensure data integrity and avoid duplication.
- [ ] **AWARDS-02**: Admin sub-form inside the Tournament Manager dashboard to associate/dissociate awards won with specific tournaments.
- [ ] **AWARDS-03**: Display a dedicated "Awards Won" section on the public tournament detail page showcasing award name, details, and team attribution.

## Category: Robot Version Tracking (ROBOT)

- [ ] **ROBOT-01**: Update the D1 database schema and Drizzle ORM models to support multiple robot versions under a single parent Robot entity (e.g., storing specs, CAD iframe, description per version).
- [ ] **ROBOT-02**: Public Robot detail page displays a version switcher (dropdown or timeline) allowing users to view specifications, Onshape CAD embeds, and reveal videos for different versions (e.g. "Phobos 1.0", "Phobos 1.1").
- [ ] **ROBOT-03**: Admin form in RobotsManager to add, edit, and archive specific robot versions, preserving historical specification logs.

## Category: YouTube Match Video Discovery (VIDEO)

- [ ] **VIDEO-01**: Associate YouTube match video URLs directly with tournament match records (D1 Drizzle schema addition).
- [ ] **VIDEO-02**: Render interactive YouTube video icons or inline video embeds in the tournament match schedules, enabling users to play back matches instantly.

## Category: TanStack Query Mutations (MUTATION)

- [ ] **MUTATION-01**: Refactor RobotsManager forms and update/delete routines to utilize TanStack Query `useMutation` hooks, eliminating standard browser `window.location.reload()` calls.
- [ ] **MUTATION-02**: Refactor TournamentsManager forms and update/delete routines to utilize TanStack Query `useMutation` hooks, ensuring clean optimistic UI transitions.

---

## Out of Scope

- **Auto-scraping YouTube match videos**: Match URLs must be manually populated by admins or linked via a simple search input, rather than running automated cron-based scrapers.
- **Dynamic 3D Onshape assembly diffing**: The CAD viewer will embed the specific version's Onshape iframe but will not perform programmatic CAD model differential visualization.

---

## Traceability

| Requirement ID | Mapped Phase | Verification Plan | Status |
|----------------|--------------|-------------------|--------|
| AWARDS-01      | Phase 83     | Automated & Manual| [ ]    |
| AWARDS-02      | Phase 83     | Automated & Manual| [ ]    |
| AWARDS-03      | Phase 83     | Automated & Manual| [ ]    |
| ROBOT-01       | Phase 84     | Automated & Manual| [ ]    |
| ROBOT-02       | Phase 84     | Automated & Manual| [ ]    |
| ROBOT-03       | Phase 84     | Automated & Manual| [ ]    |
| VIDEO-01       | Phase 85     | Automated & Manual| [ ]    |
| VIDEO-02       | Phase 85     | Automated & Manual| [ ]    |
| MUTATION-01    | Phase 86     | Automated & Manual| [ ]    |
| MUTATION-02    | Phase 86     | Automated & Manual| [ ]    |
