# Audit of deployed PR #308 — October 16, 2026

## Scope and release identity

Reviewed the deployed change from `1587790086982616288d8b04f0699ca0f9eff5aa`
to `bf0290a851eacdd15450acc65aa2f00bb95420f6` on `master`: 80 files,
5,507 insertions and 1,404 deletions. The initial worktree was clean; local HEAD,
`origin/master`, and GitHub's current `master` agreed. This is a change review,
not a new exhaustive audit of every unchanged subsystem.

The request described changes within the preceding 24 hours. GitHub showed no
newer commit: [PR #308](https://github.com/ARES-23247/ARESWEB/pull/308)
merged October 15 at 2:51 p.m. Eastern, approximately 32 hours before this audit.
It is the latest release matching the described work. Its four constituent
commits cover security remediation, two UX waves, component extraction, and an
Academy E2E correction. Git author information does not independently establish
which model authored the work.

[Production run 38789150607](https://github.com/ARES-23247/ARESWEB/actions/runs/38789150607)
records a successful protected release build, production deployment, live health
verification, and production browser security smoke for `bf0290a8`.
Deployment finished October 15 at 2:59 p.m. Eastern; the browser smoke finished
at 3:00 p.m. The
[pre-merge run](https://github.com/ARES-23247/ARESWEB/actions/runs/38786976249)
also passed verification/build, both Playwright shards, rules emulators, and the
aggregate required gate at PR head `9962140218f04067ca7180b35d5a74a919150bb4`.
These are historical CI results, distinct from the checks executed below.

## Result

Six confirmed defects introduced by this release: four medium-priority (P2)
and two low-priority (P3). No high- or critical-severity defect was established
in this reviewed change set. That is not a security certification.

### R01 — P2: Untrusted sponsor metadata becomes trusted bot-message Markdown

- **Confidence:** High; reproduced against the actual input validator and route
  handler with Firestore and Zulip delivery mocked.
- **Evidence:** `functions/src/routes/inquiries.ts:102–114`; metadata is accepted
  as arbitrary values at lines 36–46. `functions/src/lib/zulip.ts:37–46,76–84`
  passes the resulting content to the configured leadership channel without
  escaping it.
- **Trigger:** A sponsor inquiry supplies a string in `metadata.level` such as
  `@**all** [Open portal](https://example.invalid)`. The actual Zod validator
  accepts it, and the route includes that exact string after `**Tier:**` in the
  bot's alert. Trimming and truncating to 60 characters does not sanitize it.
- **Impact:** A public applicant who passes the existing App Check and rate
  controls can insert links and mention syntax into an internal bot alert.
  Unlike the masked name immediately above it, this new field is not escaped.
  It also forwards arbitrary free text outside the encrypted inquiry record.
  Zulip documents this as [active message formatting and wildcard-mention
  syntax](https://zulip.com/help/format-your-message-using-markdown). Actual
  notification delivery depends on channel permissions and recipient settings;
  no live message was sent during this audit.
- **Remediation:** Accept a bounded enum of supported sponsor-tier identifiers
  and map each to a server-owned display label before adding it to an alert.
  Keep other applicant free text inside the encrypted review workflow.
- **Acceptance test:** Through the complete inquiry request chain, send unknown
  tiers, mention syntax, newlines, Markdown links, and contact-like free text.
  Reject or omit unsupported values; known tiers should render only the mapped
  label. Assert the mocked outbound alert contains no supplied active markup.

### R02 — P2: Every inquiry notification links to a non-resolving domain

- **Confidence:** High; actual handler output and a live DNS/HTTP attempt agree.
- **Evidence:** `functions/src/routes/inquiries.ts:115` changes the destination
  from `aresfirst.org` to `https://ares-ftc.org/dashboard/inquiries`.
  `src/lib/canonicalHost.ts:24` uses `https://aresfirst.org` as the canonical host.
- **Trigger:** Submit any supported inquiry type; the resulting alert has the
  new link. `curl.exe -I --max-time 15 https://ares-ftc.org/dashboard/inquiries`
  returned exit 6, `Could not resolve host`, during this audit.
- **Impact:** Reviewers cannot open the applicant's details from the notification.
  This affects all inquiry types, even when no sponsor tier is present.
- **Remediation:** Build the link from the canonical portal origin and retain
  the new `/dashboard/inquiries` path.
- **Acceptance test:** Assert every inquiry alert uses
  `https://aresfirst.org/dashboard/inquiries`; exercise that destination in a
  browser without submitting production data.

### R03 — P2: Pending-inquiry badges stop updating for an open dashboard session

- **Confidence:** High; reproduced in a component test with the real provider.
- **Evidence:** `src/context/DashboardNotificationsContext.tsx:113–140` replaces
  the Firestore listener with one fetch whose effect depends only on the boolean
  `inquiryCheckEnabled`. `src/app/dashboard/layout.tsx:227–304` keeps the provider
  mounted while navigating among dashboard pages. The notification contract
  exposes no refresh/invalidation action.
- **Trigger:** Load the dashboard with pending inquiries, resolve them in the
  inquiries page, and return to the overview without reloading the site.
  Conversely, leave an initially empty dashboard open while a new inquiry arrives.
- **Impact:** Sidebar/overview badges retain the initial boolean indefinitely,
  showing resolved work as pending or failing to signal new work. The state is
  still labeled `connected`. This regresses the former live listener.
- **Reproduction:** After the initial mocked response returned `true`, change
  subsequent responses to `false`, dispatch focus/visibility events, and advance
  five minutes. The actual provider still displays `true` and never refreshes.
- **Remediation:** Retain the server-only data boundary, but use a shared query
  with bounded refresh/focus revalidation and invalidate it after inquiry
  mutations. Key and cancel requests by the current authenticated identity.
- **Acceptance test:** Resolve the last inquiry and verify all subscribed badges
  clear without a reload; verify a newly arriving inquiry becomes visible after
  the documented refresh interval or focus event. Preserve explicit error states.

### R04 — P2: Pit readiness carries over to the next match

- **Confidence:** High; reproduced by rerendering the actual checklist component.
- **Evidence:** `src/app/tournaments/[id]/TournamentDetailSections.tsx:170–182`
  stores only a list of checked item IDs while independently deriving the target
  match from changing props. Lines 198–229 label that state with the current
  match and show `Queue Ready`. The caller at
  `src/app/tournaments/[id]/page.tsx:405` supplies no per-match key.
- **Trigger:** Check all five items for Q-1, then mark Q-1 complete. The existing
  match mutation invalidates and reloads the query; the checklist now labels
  itself Q-2 while preserving Q-1's five checkmarks.
- **Impact:** The UI declares the next match ready without verifying that match's
  battery, autonomous selection, hardware, sensors, or controls. The same state
  can also survive navigation between tournament IDs using the same component.
- **Remediation:** Scope readiness to tournament and match identity, or reset it
  when the target changes. Show an explicit completed/no-upcoming-match state
  when no uncompleted match remains.
- **Acceptance test:** Complete Q-1's checklist, advance to Q-2 without unmounting,
  and require `0 / 5 Ready`. Also cover tournament changes and an all-complete
  match list.

### R05 — P3: Quick Jump advertises Escape to close, but Escape does nothing

- **Confidence:** High; reproduced both on the deployed site and in a local test.
- **Evidence:** `src/components/navigation/CommandPalette.tsx:181–190` puts
  `role="dialog"`/`aria-modal` on the outer wrapper and the focus-trap ref on its
  child. `src/lib/useFocusTrap.ts:40–49,81–86` treats a modal ancestor outside
  the supplied ref as an external dialog and skips its keyboard handler.
- **Trigger:** Open Quick Jump, focus its search box, and press Escape.
- **Impact:** The promised keyboard dismissal fails. The same mismatch bypasses
  the trap's Tab-boundary logic. Other focus-redirection behavior does not repair
  the missing Escape action.
- **Live evidence:** On `https://aresfirst.org/`, pressing Escape in the focused
  Quick Jump search field left the dialog and focused field unchanged.
- **Remediation:** Put the dialog semantics and trap ref on the same element,
  or use the shared dialog primitive. Preserve trigger focus restoration.
- **Acceptance test:** In a real browser, open with both the button and shortcut;
  Escape must close from the input and results, Tab/Shift+Tab must stay contained,
  and focus must return to the invoking control.

### R06 — P3: Quick Jump's Interactive Simulations destination is a 404

- **Confidence:** High; reproduced on production.
- **Evidence:** `src/components/navigation/CommandPalette.tsx:48` links to
  `/simulations`. `src/App.tsx:125–195` has no such public route; it defines
  `/academy/playground` and the authenticated `/dashboard/simulations` instead.
- **Trigger:** Choose `Interactive Simulations` in Quick Jump.
- **Impact:** A new global navigation item sends visitors to `Page not found`.
- **Live evidence:** Selecting the item navigated to
  `https://aresfirst.org/simulations`, titled `Page Not Found | ARES 23247`, with
  the 404 heading.
- **Remediation:** Point the public entry to the intended supported simulation
  experience, such as `/academy/playground`, and derive navigation from a shared
  route inventory where practical.
- **Acceptance test:** Exercise every Quick Jump destination and assert it
  resolves to a supported page or an intentional authentication gate, never the
  not-found page.

## Content questions requiring owner evidence

These are not counted among the six confirmed defects:

- `src/app/sponsors/page.tsx:359–387` adds hardcoded benefits including robot and
  jersey logos, custom demo visits, briefings, and thank-you packets. No source
  for these commitments was located in the reviewed source/content/docs. They
  need confirmation against the team's actual sponsorship offer; an absence of
  repository evidence does not establish that the owner never approved them.
- `src/app/tournaments/[id]/TournamentDetailSections.tsx:140` adds the numerical
  requirement `≥ 13.0V Loaded`. No approved battery-test procedure or load
  specification accompanies it in the reviewed material. Verify that guidance
  with the team's hardware procedure before treating it as a readiness criterion.

## Verification performed

Environment: Windows PowerShell without its login profile; Node `24.19.0`,
pnpm `11.21.0`, Java `21.0.12`. Audit conducted October 16, 2026, Eastern time.

| Check | Observed result |
| --- | --- |
| Git state, commit timestamps, latest remote commit, release/PR jobs | Release identity verified; initial worktree clean |
| `pnpm run validate:agents` | Pass |
| `pnpm run check:route-security` | Pass; 118 mutation routes checked |
| `pnpm run lint` | Pass |
| `pnpm --filter functions lint` | Pass |
| `pnpm run typecheck` | Pass |
| Focused existing frontend suites | 11 files, 52 tests passed |
| Focused existing backend suites | 11 files, 204 tests passed after environment retry |
| `pnpm run test:rules` | 2 files, 40 emulator tests passed |
| New audit regression probes | Five expected-behavior assertions fail, reproducing R01–R05 |
| Live browser checks | R05 and R06 reproduced without production mutations |
| Inquiry-link host check | DNS resolution failure, supporting R02 |

Frontend selection: `UiFeatureEnhancements`, `Wave3MaintainabilityAndUsability`,
`DashboardNotificationsContext`, `CalendarPage`, `InquiriesLifecyclePage`,
`TaskFilters`, `SeasonsPage`, `AboutPageRoster`, `OutreachPage`, `RobotsPages`,
and `SponsorsPage` under `src/test/`.

Backend selection: `linkAuthorizedUser`, `biobuzzRooms`, `profiles`, `inquiries`,
`outreach`, `calendarHelpers`, `seasons`, `tournaments`, `tournamentsPublic`,
`robots`, and middleware `auth`. The initial sandbox run could not rename Vitest
cache files; setting `TEMP` and `TMP` to `scratch/audit-308/temp` resolved that.
Three inquiry-chain tests then hit denied localhost connections. Rerunning the
23-test inquiry suite with approved localhost access passed. These environmental
failures are not reported as application defects.

Local-only reproductions and logs are in `scratch/audit-308/` (ignored by Git).
Run the probes from the repository root:

```powershell
$env:TEMP = Join-Path $PWD 'scratch/audit-308/temp'
$env:TMP = $env:TEMP
pnpm exec vitest run --config scratch/audit-308/vitest.audit.config.mts
pnpm exec vitest run --config scratch/audit-308/vitest.api.config.mts
```

The probes assert the desired behavior and failed against the audited commit; they are not fixes
and are not part of the tracked test suite. They use synthetic fixtures and
mock external writes. Production source, rules, data, permissions, and deployed
resources were not modified.

## Limits and recommended disposition

Fix R01–R04 first, then R05–R06; add the stated regression coverage to the normal
suites. Preserve the newly tightened Firestore rules while restoring notification
freshness through the API. The passing existing tests did not cover these inputs,
state transitions, or navigation/keyboard cases.

The entire handoff/release gate was not rerun locally: this deliverable is an
audit report, not an implementation or release. Dependency installation/audit,
coverage collection, all remaining unit suites, local builds, bundle checks,
full Playwright, and all release-tooling/provenance checks were outside the
executed local checks. Historical CI is identified separately above. Manual
screen-reader, mobile/reflow, print-layout, and physical robot/battery verification
were not performed. No private inquiry contents or existing chat messages were
needed for this audit. No production exploit, inquiry submission, message send,
role edit, or deployment was performed.

## Follow-up remediation

The owner subsequently authorized fixes, regression tests, and production delivery
through the protected PR workflow. The audit evidence above describes the original
deployment; it is not a claim about the repaired release.

| Finding | Repair | Tracked regression coverage |
| --- | --- | --- |
| R01 | Only five server-owned sponsor tier labels enter bot Markdown; unknown metadata remains encrypted and is omitted from the alert. | Inquiry Express-chain tests cover every supported tier plus mentions, links, newlines, contact text, objects, and null. |
| R02 | Every inquiry alert links to `https://aresfirst.org/dashboard/inquiries`. | Express-chain tests for all five inquiry types. |
| R03 | Navbar and dashboard share an identity/role-scoped API query, with foreground refresh, one-minute foreground polling, cancellation, and invalidation after successful queue mutations. | Shared-query and lifecycle tests cover concurrent observers, account/role changes, stale responses, refresh errors/recovery, resolve/reject/reopen, account approval, archive/restore, and failed mutations. |
| R04 | Checklist state is keyed by tournament and next incomplete match; an empty/completed schedule cannot show readiness. | Rerender tests cover advancing matches, switching tournaments, unchanged refetches, and no upcoming match. |
| R05 | The focus trap and modal semantics now belong to the same element; the duplicate animation-frame focus handler is removed. | Component and Playwright tests cover initial focus, delayed-focus races, Tab/Shift+Tab wrapping, Escape from search/results, and trigger focus restoration. |
| R06 | Interactive Simulations opens `/academy/playground`. | Component navigation assertion and Playwright verification of the actual destination heading. |

Regression files: `functions/src/routes/__tests__/inquiries.test.ts`,
`src/test/usePendingInquiries.test.tsx`, `src/test/PendingInquiryLifecycle.test.tsx`,
`src/test/PortalRegressionFixes.test.tsx`, and `e2e/navigation.spec.ts`.
The new shared-query utility has an enforced 85% line / 100% function coverage floor.
Full verification and deployment evidence belongs to the follow-up PR's checks
and protected production workflow, rather than the historical audit runs above.
