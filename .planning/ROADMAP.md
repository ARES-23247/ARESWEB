# Roadmap: ARESWEB (Milestone v8.3)

## Milestones

- 📋 **v8.3 Tournament Awards & Robot Version Tracking** — Phases 83-86 (In Progress)
- ✅ **v8.2 Native Photo Albums & Tournaments** — Phases 79-82 (shipped 2026-05-15)
- ✅ **v8.1 Google Workspace Integrations** — Phases 73-78 (shipped 2026-05-13)

---

## Phases

### Phase 83: Tournament Awards Integration

**Goal**: Link the awards database to tournaments, support full CRUD inside tournament dashboards, and display awards on public pages.
**Requirements**: AWARDS-01, AWARDS-02, AWARDS-03
**Depends on**: Phase 82

**Success Criteria**:
1. Admin can successfully link a team award to an existing tournament in the admin dashboard.
2. Award detail card renders beautifully on the public `/tournaments/:id` route showing award info.
3. Full integration tests run successfully with zero D1/Drizzle schema issues.

---

### Phase 84: Robot Version Tracking

**Goal**: Model multiple versions of a robot within a season, add version switcher to specs cards, and support spec diffing.
**Requirements**: ROBOT-01, ROBOT-02, ROBOT-03
**Depends on**: Phase 83

**Success Criteria**:
1. Database schema updated to support 1:N robot versions relationship.
2. Public spec card renders interactive toggle allowing seamless swapping between version specs (e.g. Phobos 1.0 vs 1.1).
3. Onshape CAD embeds and reveal video playbacks automatically update upon version toggle.

---

### Phase 85: Match Video Discovery

**Goal**: Link YouTube URLs directly to matches and render embed players inline within tournament match lists.
**Requirements**: VIDEO-01, VIDEO-02
**Depends on**: Phase 83

**Success Criteria**:
1. YouTube icons render next to each match in the tournament schedule if a video is linked.
2. Clicking a video icon opens a sleek, glassmorphic modal with a responsive YouTube player embed.
3. YouTube video search or direct URL linking is functional within the admin dashboard.

---

### Phase 86: TanStack Query Mutations

**Goal**: Refactor Robots and Tournaments admin components to use TanStack Query mutations instead of page reloads.
**Requirements**: MUTATION-01, MUTATION-02
**Depends on**: Phase 84, Phase 85

**Success Criteria**:
1. Add, Update, and Delete operations inside `RobotsManager` use `useMutation` hooks.
2. `TournamentsManager` updates instantly via optimistic cache state without triggering `window.location.reload()`.
3. 100% TS-safe mutation types with clean API contract inference.

---

## Progress

| Phase | Milestone | Status | Completed |
|-------|-----------|--------|-----------|
| 83. Tournament Awards Integration | v8.3 | In Progress | — |
| 84. Robot Version Tracking | v8.3 | Planned | — |
| 85. Match Video Discovery | v8.3 | Planned | — |
| 86. TanStack Query Mutations | v8.3 | Planned | — |
