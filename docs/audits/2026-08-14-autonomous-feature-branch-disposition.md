# Autonomous feature branch disposition — 2026-08-14

## Scope and environment

- Production baseline inspected: `45e09a396bbcc6e579b6be18dcf2f44bddce8b53`
- Preserved implementation branch: `codex/fix-pwa-toast-dismissal` at
  `700d8f6fa324bcd37cece6c83a8baa4f5096c8b8`
- Local runtime: Node `24.13.0`, pnpm `11.21.0`, OpenJDK `21.0.12`
- Required deployment runtime remains Node `22.13+ <23`; CI must repeat the
  release gate on Node 22.
- Review method: compared each branch against `origin/master`, inspected added
  routes and data modules, checked trust boundaries and public claims, reviewed
  GitHub required-check state, and verified worktree/branch reachability before
  deletion.

## Decision

No autonomous feature branch in PR #88, #90, or #92–#111 was suitable for a
whole-branch merge. Those PRs were closed without merging and their local and
remote branches were removed. PR #91 was deliberately preserved because its
test-only scouting changes require a separate bounded review.

The rejected branches added 27,432 lines across cycles 35–46 alone. Repeated
failure modes were hardcoded data presented as authoritative, obsolete FTC game
rules, fictional team history and identities, inaccurate privacy/YPP/encryption
claims, browser-only state described as synchronization, and very large page
components coupled to fabricated fixtures.

## Confirmed high-risk examples

| Area | Confirmed defect | Impact | Required acceptance test before rebuilding |
| --- | --- | --- | --- |
| CAD and robot hardware | Placeholder geometry, nonexistent downloads, and unverified robot specifications were presented as actual ARES assets. | Misrepresents team engineering and can publish unsafe or incorrect hardware guidance. | Every public model/specification traces to an approved source asset and a reviewer can download and inspect it. |
| FTC scoring, scouting, and autonomous strategy | INTO THE DEEP field elements and scoring remained in features created for the current site. | Produces incorrect match decisions and public technical guidance. | Scoring fixtures cite the current official game manual and reproduce official examples and edge cases. |
| Awards, notebook, alumni, sponsors, and STEM library | The branches invented awards, quotations, results, people, employers, papers, DOIs, impact metrics, and financial/legal claims. | Serious reputational, privacy, and legal exposure. | Public records originate from an approved CMS/Drive record with reviewer, provenance, and publication state. No fallback may fabricate content. |
| Youth-facing registrations | Workshop and recruitment forms made inaccurate Zero-PII, consent, or YPP claims while collecting youth and guardian information. | Creates unreviewed youth-data and consent risk. | A minimized server DTO, documented retention policy, verified guardian workflow, encrypted storage, authorization tests, and legal/coach approval exist before collection. |
| Safety certifications | Qualifications were issued entirely in the browser with an unkeyed checksum and generated safety instructions. | Users could forge credentials or rely on unapproved safety procedures. | Safety content is approved by the responsible adult/equipment manufacturer; certifications are server-issued, authenticated, auditable, revocable, and cannot be forged client-side. |

## Salvage guidance

Only concepts should be reconsidered, not deleted source copied wholesale:

- a printable gamepad map generated from real robot configuration;
- CSV-safe BOM/scouting exports backed by managed authoritative records;
- notebook/timeline presentation backed by approved Drive or Firestore content;
- store/catalog UI backed by an admin-managed catalog with verified prices and
  fulfillment terms.

Future feature agents must receive one bounded feature, its authoritative data
source, explicit public/private fields, and acceptance tests before writing UI.
Agents must not invent fallback team data to make a page appear complete.

## Cleanup performed

- Closed PR #88, #90, and #92–#111 with branch-specific review reasons.
- Deleted their remote and local branches.
- Removed abandoned Antigravity worktrees after verifying committed state.
- Removed untracked CAD, scoring-calculator, hardware, and obsolete PWA-test
  files left in the primary checkout.
- Deleted 34 redundant `subagent-*` aliases after verifying every alias pointed
  to `840f5f43`, still retained by local and remote `cycle-16` branches.
- Preserved the fully tested public announcement/mobile-banner and PWA-toast fix.

