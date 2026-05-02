# Proposed Roadmap

**3 phases** | **4 requirements mapped** | All covered âœ“

## Milestone v5.5

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 80 | Simulation GitHub Loading Fix | Restore the ability to load existing simulations directly from the GitHub repository. | SIM-01, SIM-02 | 2 |

### Phase Details

### Phase 80: Simulation GitHub Loading Fix

**Goal:** Restore the ability to load existing simulations directly from the GitHub repository.
**Requirements:** SIM-01, SIM-02
**Depends on:** None
**Plans:** 1 plans

Plans:
- [x] Fix Simulation Playground menu
- [x] Fetch contents from GitHub repository

### Phase 81: Task & Goal Tracking

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 80
**Plans:** 1 plans

Plans:
- [x] 81-01: Update TaskBoardPage and Database Schema
- [x] 81-02: Liveblocks integration and TaskEditDrawer

### Phase 82: Science Corner & Sandbox Expansion

**Goal:** Implement standalone public-facing Science Corner with hybrid simulation engines and state persistence.
**Requirements**: TBD
**Depends on:** Phase 81
**Plans:** 1 plans

Plans:
- [x] 82-01: Implement Science Corner Sandbox

### Phase 83: fix e2e errors.

**Goal:** Resolve the End-to-End (E2E) errors identified in the Playwright suite.
**Requirements**: TBD
**Depends on:** Phase 82
**Plans:** 1 plans

Plans:
- [x] 83-01: Fix e2e errors

### Phase 84: make recurring calendar events

**Goal:** Implement recurring calendar events by adding an `rrule` field to track recurrence and auto-generating child events in the database.
**Requirements**: TBD
**Depends on:** Phase 83
**Plans:** 1 plans

Plans:
- [ ] 84-01: Schema Update for Recurrence
- [ ] 84-02: Update Event Contracts
- [ ] 84-03: Backend Route for Recurring Event Generation
- [ ] 84-04: UI Implementation

### Phase 85: Upgrade Simulation Playground IDE

**Goal:** Upgrade the Simulation Playground with Monaco Editor, AI Ghost Text, a Multi-file sandbox with folders, Live Error Squiggles, resizable split-pane layout, in-browser console logging, Prettier auto-formatting, and Vim/Emacs keybindings.
**Requirements**: TBD
**Depends on:** Phase 84
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 85 to break down)

### Phase 86: I get a Network error when I try to publish a recurrent event.

**Goal:** Resolve the 500 "Write failed" database error when saving recurring events.
**Requirements**: TBD
**Depends on:** Phase 85
**Plans:** 1 plans

Plans:
- [x] Fix D1 variable offset limit by chunking database inserts.
- [x] Remove erroneous `cf_email` mapping to align with `events` table schema.

### Phase 87: fix up the science corner. Add a link in the footer. The science corner sims do not work. Also is there an admin interface to put sims/lessons in the sicence corner. I would like things to be more like documents/blogs with both text and embedded sims. I am not sure it needs to have seperate storage as we can use the regular sims. Should be integrate the science corner better with our sims (give the sims better access to the physics engines?) I would like help brainstorming

**Goal:** Fix up Science Corner (Footer link, embeddable sims via Markdown/Tiptap)
**Requirements**: TBD
**Depends on:** Phase 86
**Plans:** 1 plans

Plans:
- [x] 87-01: Implement Science Corner fixes

### Phase 88: Refactor recurring events: fix calendar overflow, add repeat frequency limits, and support individual instance deletion

**Goal:** Fix calendar overflow, add repeat limits, allow individual deletion
**Requirements**: TBD
**Depends on:** Phase 87
**Plans:** 1 plans

Plans:
- [x] 88-01: Verify implemented components

## Backlog

### Phase 999.80: Follow-up — Phase 80 incomplete plans (BACKLOG)

**Goal:** Resolve plans that ran without producing summaries during Phase 80 execution
**Source phase:** 80
**Deferred at:** 2026-05-02 during /gsd-next advancement to Phase 88
**Plans:**
- [ ] 80-01: github-loading (ran, no SUMMARY.md)

