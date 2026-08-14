# Tournament Scouting & Competition Operations Audit

- Date: August 14, 2026
- Audited baseline: `b6662a862c78428ddfac43ea4f17be766a470a68` (`origin/master`)
- Branch: `codex/continuous-audit-cycle-1`
- Scope: Tournament scouting visibility, OPR leaderboard rendering, scouting matrix export, alliance selection simulation, and match day analytics
- Production mutation: none

---

## Confirmed Findings and Remediation

### TSO-01 — OPR Leaderboard and Team Metrics Were Inadvertently Hidden on Active/Upcoming Events

- **Severity**: medium
- **Confidence**: high
- **Evidence**: In `src/app/tournaments/[id]/TournamentDetailSections.tsx` (lines 68 & 204) and `src/app/tournaments/page.tsx` (line 410), OPR stats and the team OPR leaderboard were wrapped with `tournament.status === "past"`.
- **Impact**: During live FTC competition days, events are initially marked as `upcoming` (active). When scouting leads and drive team members enter scouted OPR ratings for competing teams, the leaderboard and team OPR badge were completely suppressed from the UI until the tournament concluded and was marked as `past`.
- **Remediation**: In `TournamentHero`, `TournamentAnalyticsSidebar`, and `src/app/tournaments/page.tsx`, the conditional check now inspects `(tournament.opr ?? 0) > 0` and `tournament.oprList.length > 0` directly, ensuring live scouting intelligence is immediately accessible throughout the competition day.
- **Acceptance test**: `src/test/Tournaments.test.tsx` explicitly exercises an `upcoming` tournament record with `opr` and `oprList` data and confirms both the Team OPR badge and OPR Leaderboard are rendered.
- **Status**: fixed.

### TSO-02 — Large Tournament Rosters Lacked In-Table Search and Fast Filtering

- **Severity**: low
- **Confidence**: high
- **Evidence**: `TournamentAnalyticsSidebar` displayed the raw OPR list without search or ranking numbers, which made finding specific teams cumbersome during fast-paced queueing when 30+ teams compete.
- **Impact**: Scouts and drive coaches had to scroll through the full list to check an upcoming alliance partner or opponent's recorded OPR.
- **Remediation**: Added a real-time team number and name filter input, rank numbering (`#1`, `#2`), and summary metrics (Teams Scouted and Average Event OPR) in `TournamentAnalyticsSidebar`.
- **Acceptance test**: `src/test/Tournaments.test.tsx` tests filtering by `"Quantum"` and verifies non-matching teams are filtered out.
- **Status**: fixed.

### TSO-03 — Missing 1-Click CSV Export for Scouting & Alliance Selection Sheets

- **Severity**: low
- **Confidence**: high
- **Evidence**: While match schedules had CSV export, the tournament's scouted team matrix and OPR leaderboard had no structured export utility.
- **Impact**: Scouting leads had to manually copy team ratings into spreadsheets for alliance selection binder preparation.
- **Remediation**: Built `src/lib/tournamentScoutingCsv.ts` with RFC-compliant CSV generation, formula injection protection, and UTF-8 BOM encoding for Excel. Integrated a 1-click `CSV` download link in the OPR Leaderboard header.
- **Acceptance test**: `src/test/tournamentScoutingCsv.test.ts` (3 tests) validates sorted OPR descending order, formula sanitization, and data URL generation.
- **Status**: fixed.

### TSO-04 — Lack of Interactive Alliance Selection & Playoff Strategy Simulator

- **Severity**: low
- **Confidence**: high
- **Evidence**: Scouts and coaches had no in-app tool to model alliance partner synergies and project combined OPR differentials against opposing playoff alliances.
- **Impact**: Alliance selection scenarios had to be calculated manually or on scrap paper during alliance calling.
- **Remediation**: Created `src/app/tournaments/[id]/TournamentAlliancePlanner.tsx` with Captain/Partner selection controls, combined OPR calculations, and score differential advantage badges.
- **Acceptance test**: `src/test/TournamentAlliancePlanner.test.tsx` (3 tests) validates simulator toggling, combined OPR arithmetic, and advantage margin calculations.
- **Status**: fixed.

---

## Verification Evidence

- `pnpm vitest run src/test/Tournaments.test.tsx src/test/tournamentScoutingCsv.test.ts src/test/TournamentAlliancePlanner.test.tsx`: 20/20 tests passed.
- Scoped ESLint & TypeScript: 0 warnings, 0 errors.
