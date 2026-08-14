# Autonomous feature branch disposition — 2026-08-14

## Scope and environment

- Production baseline inspected: `45e09a396bbcc6e579b6be18dcf2f44bddce8b53`
- Preserved implementation branch: `codex/fix-pwa-toast-dismissal` at
  `43ea5176ec9e7f07cc57480ff872a3604ff96f38` before this report update.
- Local runtime: Node `24.13.0`, pnpm `11.21.0`, OpenJDK `21.0.12`
- Required deployment runtime remains Node `22.13+ <23`; CI must repeat the
  release gate on Node 22.
- Review method: compared each branch against `origin/master`, inspected added
  routes and data modules, checked trust boundaries and public claims, reviewed
  GitHub required-check state, and verified worktree/branch reachability before
  deletion.

## Decision

No autonomous feature branch in PR #78–#111 was suitable for a whole-branch
merge. The useful, independently verified announcement and PWA behavior was
implemented on `codex/fix-pwa-toast-dismissal`; the autonomous branches were
closed without merging and removed locally and remotely.

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

## Final PR #78–#91 review

| PR | Disposition | Evidence-based reason |
| --- | --- | --- |
| #78 simulations | Reject | Mock-heavy tests bypassed the generated registry and preserved the retired “AI Simulation IDE” label. |
| #79 developer API | Reject | Added public documentation for finance and simulation endpoints without matching supported public API contracts. |
| #80 technology page | Reject | Tests converted unsupported “100% coverage,” WCAG, youth-data, and architecture marketing claims into required behavior. |
| #81 legal pages | Reject | Accessibility markup improvements were coupled to absolute COPPA, analytics, AI-processing, encryption, and consent claims that were not established by the test scope. |
| #83 event detail | Reject | A 714-line mocked page test duplicated implementation details without exercising the real API, authorization, Firestore rules, or browser flow. |
| #84 about/roster | Reject | Tests used fabricated people and entrenched unverified team-support, funding, geographic, and participation claims. |
| #85 location | Reject | Rewrote a public location landing page around unverified community-program and applicant claims instead of an approved content source. |
| #86 leaderboard | Reject | Added presentation-level mocked tests without a validated scoring/award data authority or backend contract. |
| #87 accessibility | Reject | Published manual NVDA/VoiceOver, reflow, readability, and WCAG target assertions while the repository's dated manual checklist remains pending. |
| #89 youth safety | Reject | Frontend copy tests could not establish consent, retention, encryption, authorization, or FIRST Youth Protection Program compliance. |
| #91 scouting | Reject | The branch added only an audit narrative despite claiming a unit-test suite, and described strategy/scoring guarantees without new executable evidence. |

## Cleanup performed

- Closed PR #78–#111 with review reasons and no unsafe merges.
- Deleted their remote and local branches.
- Removed abandoned Antigravity worktrees after verifying committed state.
- Removed untracked CAD, scoring-calculator, hardware, and obsolete PWA-test
  files left in the primary checkout.
- Deleted 34 redundant `subagent-*` aliases after verifying every alias pointed
  to the same reviewed `cycle-16` commit; that cycle branch was later rejected
  and removed in the final PR #78–#91 review.
- Preserved the fully tested public announcement/mobile-banner and PWA-toast fix.
- Preserved the local-only `codex/post-release-audit-20260814` branch for a
  separate review. It contains 3,017 added lines of substantive tournament and
  inquiry work and is not part of this release; deleting or merging it without
  a bounded review would be unsafe.
