# Tournament Match Concurrency Audit

- Date: August 14, 2026
- Deployed baseline: `308f719a0793a5ad3001b161147a5025e2826101`
- Branch: `codex/post-deploy-verification`
- Scope: authenticated tournament-match edit, completion, and archive requests;
  Firestore write behavior; event-day conflict UX; focused API and UI tests
- Production data: read-only verification only; no tournament or match record
  was created, changed, or archived

## Outcome

The deployed match workflow used last-write-wins updates. Two authorized devices
could load the same match, save different changes, and silently replace the
first confirmed save with the second. This cycle adds optimistic concurrency
without a data migration by using the existing `updatedAt` value as the client
revision and the Firestore document update time as the final write precondition.

This is a scoped correctness result. It is not a claim that every collaboration
surface has conflict detection or that the complete application is defect-free.

## Finding and remediation

### MATCH-01 — Medium — High confidence — Silent concurrent overwrite

Evidence before remediation:

- `functions/src/routes/tournaments.ts` read an active match and then called
  `ref.update(...)` without comparing the client record to the current record;
- `src/lib/tournamentApi.ts` sent edits, completion toggles, and archives without
  a revision token; and
- `src/app/tournaments/[id]/page.tsx` refreshed after failures but could not
  distinguish an intentional concurrency rejection from a generic request
  failure.

Impact: simultaneous stands and pit edits could silently discard a newer score,
completion state, alliance assignment, or scouting note.

Remediation:

- every match edit, completion toggle, and archive now sends the `updatedAt`
  value from the record the user actually viewed;
- strict Zod contracts require that revision, while `null` supports a bounded
  legacy record that predates timestamps;
- the API compares the client revision before writing and returns HTTP 409 with
  `MATCH_REVISION_CONFLICT` when it is stale;
- the Firestore update also uses `lastUpdateTime`, closing the race between the
  server read and write; and
- the UI refreshes the confirmed record and tells the editor to compare it with
  the preserved draft instead of implying a successful save.

Acceptance criteria:

1. A stale revision produces 409 and makes no Firestore write.
2. A Firestore `FAILED_PRECONDITION` race produces the same bounded 409 contract.
3. The edit form preserves unsaved values after a rejected save.
4. Completion and archive requests include the viewed record revision.
5. Existing missing/archived-match handling remains a genuine 404.

## Verification record

The complete repository gate passed on Node 22.13.1, pnpm 11.21.0, and OpenJDK
24.0.2:

- frozen installation and supply-chain policy: passed;
- six shared skills plus Gemini, Antigravity, and Copilot discovery: passed;
- root and Cloud Functions lint: passed with zero warnings;
- root TypeScript and Cloud Functions build: passed;
- frontend coverage: 90 files, 513 tests, 77.59% lines and 73.08% functions;
- Cloud Functions coverage: 45 files, 573 tests, 94.84% lines and 98.32%
  functions; `tournaments.ts` reached 97.76% lines and 100% functions;
- Firestore and Storage emulator rules: 20 tests passed;
- production build: 4,162 modules and 22 prerendered public shells;
- PWA precache: 17 entries / 874.90 KiB;
- all six bundle budgets: passed;
- Playwright: 52 tests passed across Chromium, mobile Chromium, Firefox, and
  WebKit;
- production dependency audit: no known vulnerabilities; and
- `git diff --check`: passed apart from Windows line-ending notices.

The protected pull request, CodeQL review, deployment, and exact-SHA production
verification remain required before this change is described as released.
