# Event-day Match CSV Export

- Date: 2026-08-14
- Baseline: `1b452b2db975309da97685d0997f6d8b12fdaa4b` (`origin/master`)
- Branch: `codex/next-cycle`
- Scope: authenticated tournament match list, offline handoff, spreadsheet safety,
  and shared agent configuration cleanup
- Production data mutation: none

## Outcome

The tournament match checklist now offers a native CSV download containing the
complete bounded match record already returned to the current member. The file
includes checklist status, alliance, partner, opponents, result, scores, and
notes in a stable column order. It supports printing, offline event-day review,
and handoff to scouting volunteers without adding a backend route or new data
store.

## Security and privacy boundary

- The export uses only the existing authenticated tournament DTO in memory. It
  does not fetch additional records, broaden authorization, or expose internal
  Firestore fields.
- Every cell is RFC 4180 quoted, embedded quotes and newlines are preserved, and
  user-controlled values beginning with spreadsheet formula characters are
  prefixed with an apostrophe. This prevents notes or team fields from becoming
  active formulas when opened in common spreadsheet software.
- The data URL is UTF-8 with a byte-order marker for reliable spreadsheet import.
  No server upload, analytics event, or persistent browser storage is involved.

## Accessibility and truthfulness

- The export is a native download link with a descriptive accessible name and a
  visible `Export CSV` label.
- The link is shown only when at least one match exists and exports all match
  records, independent of the current visual search filter.

## Focused verification

- CSV utility and integrated tournament tests: 2 files / 18 tests passed.
- CSV utility coverage: 100% statements, branches, functions, and lines.
- Scoped ESLint: zero warnings.
- Root TypeScript: passed.
- Agent discovery still validates six canonical skills across Codex, Gemini,
  Antigravity, and Copilot after removing the ineffective nested
  `.agents/AGENTS.md` exception.

## Complete verification gate

- Supported runtime: Node 22.13.1, pnpm 11.21.0, and OpenJDK 24.0.2.
- Frozen install, shared-agent validation, root lint, Functions lint, root
  TypeScript, and Functions build: passed with zero warnings.
- Frontend coverage: 90 files / 513 tests passed; 77.59% lines and 73.08%
  functions. The new CSV utility measured 100% statements, branches, functions,
  and lines.
- Functions coverage: 45 files / 571 tests passed; 94.79% lines and 98.31%
  functions.
- Firestore and Storage emulator rules: 20 tests passed.
- Production build: 4,162 modules and 22 prerendered public route shells; PWA
  precache remained 17 entries / 874.90 KiB.
- All six bundle budgets passed; total route JavaScript was 4,536,876 raw /
  1,323,926 gzip bytes.
- Playwright: 52 end-to-end tests passed across the configured browser matrix.
- Production dependency audit: no known vulnerabilities.
- Diff check: clean apart from platform line-ending notices.

The protected pull request, deployment, and read-only production verification
remain required before this feature is described as released.
