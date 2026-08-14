# Team Roster Role Visibility & Fun Fact DTO Audit

- Date: August 14, 2026
- Audited baseline: `8ae3afb7a99415d5fee9aebde08829b860de03b3` (`origin/master`)
- Branch: `codex/continuous-audit-cycle-8`
- Scope: Public team roster (`src/app/about/page.tsx`), Cloud Functions profile DTO API (`functions/src/routes/profileRoster.ts`), role badges, fun facts, and automated tests
- Production mutation: none

---

## Confirmed Findings and Remediation

### RST-01 — Missing Role Badges and Fun Facts on Public Member Cards

- **Severity**: low
- **Confidence**: high
- **Evidence**: In `src/app/about/page.tsx`, when viewing the "All Members" tab, team member cards displayed only their approved nickname, pronouns, bio, and subteams, omitting an explicit role badge pill (e.g. `coach`, `mentor`, `student`, `alumni`). Additionally, while members could record robotics fun facts in their profile settings, the `about-roster` Cloud Function route in `functions/src/routes/profileRoster.ts` and the frontend card did not expose or render this field.
- **Impact**: Visitors could not easily distinguish between coaches, mentors, students, and alumni without clicking individual category filter buttons.
- **Remediation**:
  1. Updated `functions/src/routes/profileRoster.ts` to include safe string trimming on `funFact` in the public `about-roster` DTO.
  2. Updated `src/app/about/page.tsx` to render an accessible role badge pill and fun fact quote on each member card.
- **Acceptance test**: `src/test/AboutPageRoster.test.tsx` (2 tests) passes.
- **Status**: fixed.

---

## Verification Evidence

- `pnpm vitest run src/test/AboutPageRoster.test.tsx`: 2/2 tests passed.
- Scoped ESLint & TypeScript: 0 warnings, 0 errors.
