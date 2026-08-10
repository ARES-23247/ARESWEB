# Recent Changes Audit

- Date: August 10, 2026
- Auditor: Codex
- Scope: 70 changed files across the frontend, Cloud Functions, tests, documentation, and CI
- Baseline: `3b9e1e04c78a587b3b4390b630dbe3b41cc90b63`

This audit reviews the current change set. It does not claim to cover every unchanged file.

## Summary scorecard

| Pillar | Grade | Critical item |
| --- | --- | --- |
| Security | A | Checkout now fails closed. Public errors no longer show raw details. |
| Privacy and youth protection | A | No new public student contact data or full names. |
| Web accessibility | A | Skip links, dialogs, labels, live regions, and keyboard focus improved. |
| Style and brand | A- | Changed colors use the ARES palette. Legacy aliases remain for old files. |
| Code efficiency | A- | Changed Firestore list reads now have limits. Bundle budgets pass. |
| Refactoring | B | Several large page files remain hard to maintain. |
| Portability | A | Test-only auth stays limited to development and E2E builds. |
| Functionality | A | Public failures no longer look like successful sample data. |
| Testing | A | 164 frontend, 243 backend, and 40 browser tests pass. |
| Architecture | A | API failures use the shared error path. Client and server boundaries remain intact. |
| DevOps and hygiene | A- | CI now installs every declared browser. Vite still prints a config warning. |
| Scalability and resilience | A- | Queries are bounded. Large editor bundles stay lazy and within budget. |

## 1. Security

### Strengths

- The store API requires authentication and rate limiting.
- Checkout returns `503` until a real payment provider exists.
- The simulation iframe keeps an opaque origin with `sandbox="allow-scripts"`.
- E2E mock auth does not ship in a production build.

### Findings

| ID | Severity | Finding | Location | Status |
| --- | --- | --- | --- | --- |
| SEC-F01 | High | The old checkout flow could record an order and show success without verified payment. | `functions/src/routes/store.ts` | Fixed |
| SEC-F02 | Medium | Public error cards could show raw provider messages. | `src/components/PublicDataState.tsx` | Fixed |
| SEC-F03 | Medium | The error boundary exposed full client stack details in production. | `src/components/ErrorBoundary.tsx` | Fixed |

## 2. Privacy and youth protection

### Strengths

- Roster email and role controls remain inside the protected dashboard.
- Public pages do not add student email, phone, location, or legal-name fields.
- Error redaction reduces the chance of exposing internal paths or host names.

### Findings

No open findings in this change set.

## 3. Web accessibility

### Strengths

- One main landmark now wraps each route.
- The skip link moves keyboard focus to the main content.
- Mobile navigation and academy overlays use dialog roles and focus traps.
- Forms have labels. Status messages use live regions.
- Simulations add keyboard focus states, control names, and canvas descriptions.
- Reduced-motion styles cover animations and smooth scrolling.

### Findings

No open findings in this change set.

## 4. Style and brand

### Strengths

- Changed generic status colors now use ARES red, gold, bronze, marble, or obsidian.
- Red alerts use white text for readable contrast.
- The canonical site domain remains `https://aresfirst.org`.

### Findings

| ID | Severity | Finding | Location | Status |
| --- | --- | --- | --- | --- |
| BRAND-F01 | Low | Old files still use legacy token names. Compatibility aliases map them to approved colors. | `src/app/globals.css` | Backlog |

## 5. Code efficiency

### Strengths

- Calendar and tournament feeds already use query limits.
- Robots, seasons, awards, academy documents, tournament matches, and photos now use limits.
- The store page removes unused cart and fake-checkout code.
- Initial JavaScript and CSS stay within CI budgets.

### Findings

| ID | Severity | Finding | Location | Status |
| --- | --- | --- | --- | --- |
| PERF-F01 | Medium | Four changed data flows had uncapped Firestore reads. | Public data pages | Fixed |

## 6. Refactoring

### Strengths

- `PublicDataState` replaces repeated error-state markup.
- Calendar panels and tournament match lists already use focused components.

### Findings

| ID | Severity | Finding | Location | Status |
| --- | --- | --- | --- | --- |
| REFACTOR-F01 | Low | Academy, tournament detail, and simulation editor pages remain large. | Large `.tsx` pages | Backlog |

## 7. Code portability

### Strengths

- Routes use relative `/api` paths.
- E2E mode avoids a local Firebase emulator dependency across browsers.
- No frontend file imports Cloud Functions code, or the reverse.

### Findings

No open findings in this change set.

## 8. Functionality

### Strengths

- Firestore failures now show a clear error instead of sample records.
- Empty collections show honest empty states.
- Store users can no longer mistake a simulated order for a paid order.
- Calendar event edit controls no longer sit inside the event details link.

### Findings

No open findings in this change set.

## 9. Testing

### Strengths

- New error, data-state, roster, navigation, calendar, and responsive tests pass.
- E2E tests cover desktop Chromium, mobile Chromium, Firefox, and WebKit.
- Frontend and Functions coverage commands pass.

### Findings

No open findings in this change set.

## 10. Architecture

### Strengths

- The store route uses `asyncHandler` and `ApiError`.
- Authentication stays in middleware, not UI controls.
- Query errors remain distinct from empty results.

### Findings

No open findings in this change set.

## 11. DevOps and hygiene

### Strengths

- CI action versions remain pinned to full commit hashes.
- CI now caches and installs all browser engines named by Playwright.
- The locked install, lint, type checks, tests, builds, audit, and bundle checks pass.

### Findings

| ID | Severity | Finding | Location | Status |
| --- | --- | --- | --- | --- |
| DEVOPS-F01 | High | CI declared Firefox and WebKit tests but installed only Chromium. | `.github/workflows/ci.yml` | Fixed |
| DEVOPS-F02 | Low | Vite warns that native config loading will need ESM cleanup later. | `vite.config.ts` | Backlog |

## 12. Scalability and resilience

### Strengths

- Public list reads now have practical upper bounds.
- TanStack Query caches robot and tournament reads.
- The service worker recovery path limits automatic reloads.
- Editor-heavy libraries stay in lazy chunks.

### Findings

| ID | Severity | Finding | Location | Status |
| --- | --- | --- | --- | --- |
| SCALE-F01 | Low | Monaco, Babel, and Prettier remain large lazy chunks. They pass current budgets. | Production bundle | Backlog |

## Roadmap to compliance

### Must fix

- None. All high-severity findings in this change set are fixed.

### Should fix

- Move Vite and Vitest configs to a clean ESM setup before native loading becomes the default.
- Replace legacy color aliases as each old component is edited.

### Backlog

- Split the largest page components into smaller views and hooks.
- Keep watching lazy editor bundle sizes as dependencies grow.
- Review the low and moderate dependency advisories during the next dependency update.

## Verification record

- Locked install: passed
- ESLint: passed
- TypeScript: passed
- Frontend tests: 164 passed
- Functions tests: 243 passed
- Frontend coverage command: passed
- Functions coverage command: passed
- Production dependency audit: no high or critical advisories
- Frontend build: passed
- Functions build: passed
- Bundle budgets: passed
- Playwright: 40 passed across four projects
