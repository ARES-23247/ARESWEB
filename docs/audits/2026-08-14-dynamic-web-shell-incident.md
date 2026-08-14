# Dynamic Public Page Shell Incident

- Date detected: 2026-08-14
- Affected deployment: `c8458da484eabb8d6ab54f3e15fe52a67df0a58e`
- Scope: server-rendered `/blog/*`, `/academy/*`, `/docs/*`, `/events/*`, and
  `/robots/*` routes
- Production data mutation: none

## Confirmed defect

### WEB-01 — Valid dynamic public pages returned HTTP 503

- Severity: high
- Confidence: high
- Evidence: independent post-deploy requests to published blog and Academy
  records returned HTTP 503. Cloud Run revision `web-00020-xed` logged
  `Hosting shell is not a valid application document` for those requests.
- Impact: direct visits and crawlers received a temporary-unavailable document
  instead of the published page. Client-side navigation from a previously
  loaded shell could still work, which made the outage easy to miss.
- Root cause: the renderer fetched
  `https://aresfirst-portal.web.app/index.html`. Firebase Hosting clean-URL
  behavior resolved that request to the prerendered home page, which correctly
  failed the renderer's application-shell validation because it did not
  contain `<div id="root"></div>`.

## Remediation

- Fetch the stable `/dashboard` Hosting rewrite, which is explicitly mapped to
  the active `index.html` application shell and therefore follows each Hosting
  release's current hashed assets.
- Add a data-independent `/__deployment-health/web` route to the `web`
  Function. It validates the real Hosting shell dependency and returns only a
  bounded JSON status, with `no-store` caching and generic failure output.
- Add that route to the production deployment contract so every release must
  pass it before deployment is declared healthy.
- Protect the shell URL and Hosting rewrite with Functions and frontend
  regression tests.

## Acceptance criteria

- A published dynamic page returns HTTP 200 with route-specific raw title,
  canonical metadata, and the live application shell.
- A missing dynamic record continues to return a genuine HTTP 404.
- The web-shell health route returns JSON HTTP 200 only when the active Hosting
  response is a valid application document; a prerendered or malformed shell
  produces generic JSON HTTP 503.
- The post-deploy health suite exercises 12 checks, including the web-shell
  dependency, against the exact release SHA.

## Verification before release

- Functions web/rendering tests: 2 files / 11 tests passed.
- Hosting/deployment/health tests: 3 files / 28 tests passed.
- Full frontend coverage: 89 files / 509 tests passed.
- Full Functions coverage: 45 files / 571 tests passed; `web.ts` reached 100%
  line and function coverage.
- Firestore and Storage rules: 20 tests passed.
- Root and Functions ESLint: zero warnings.
- Root TypeScript and Functions build: passed.
- Production build: 4,161 modules and 22 prerendered route shells passed.
- All six bundle budgets passed; the PWA precache remained 17 entries /
  874.90 KiB.
- Playwright: 52 end-to-end tests passed.
- Production dependency audit: no known high-severity vulnerabilities.
- Deployment contract: 8 Functions / 12 health checks validated.

Protected CI, deployment, and live acceptance checks remain required. This
report documents a bounded incident and remediation; it is not a claim that
all public rendering failure modes are eliminated.
