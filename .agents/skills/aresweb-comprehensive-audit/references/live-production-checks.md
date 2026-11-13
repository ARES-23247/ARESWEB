# Read-Only Live Production & Cloud Audit Checklist

Use these checks only when live inspection of `https://aresfirst.org` or
read-only inspection of GCP/Firebase (`aresfirst-portal`) is inside the approved
audit scope. **Never mutate production data, submit public forms, upload test
files, rotate secrets, deploy resources, or print secret values.**

## 1. Read-Only HTTP, TLS, Security Header & Crawler Parity (`https://aresfirst.org`)

Check live responses directly (via Node `fetch` / `curl.exe -I` or similar
read-only GET/HEAD requests):

- **Canonical HTTPS & security headers:** Verify status `200`, `Strict-Transport-Security`,
  `Content-Security-Policy` (no unsafe regressions or broken frame/connect origins),
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`.
- **Crawl & syndication endpoints:** Check `/robots.txt`, `/sitemap.xml`,
  `/rss.xml`, and `/api/content/posts` (and public DTO endpoints like
  `/api/tournaments/public/results`, `/api/sponsors`, `/api/seasons`,
  `/api/calendar/events`) return `200` with clean DTOs (zero raw emails, UIDs,
  receipts, or draft records).
- **Unknown-route status behavior:** Request a random non-existent path (e.g.
  `/definitely-missing-audit-probe-404`) and verify Hosting + `web` Function
  returns HTTP `404` cleanly rather than soft-`200`.
- **Crawler HTML vs hydrated UI:** Fetch raw SSR/prerendered HTML for key routes
  (`/`, `/store`, `/arcade`, `/join`, `/sponsors`, `/tournaments`) and compare
  title, meta description, OpenGraph URLs (`https://aresfirst.org/...`), and
  availability text against the live React app.

## 2. Read-Only Live Browser Inspection (`browser` Subagent, Viewports `1440x900` & `320x640`)

When browser inspection is in scope:

- Visit core public routes read-only (`/`, `/about`, `/robots`, `/seasons`,
  `/tournaments`, `/sponsors`, `/blog`, `/academy`, `/arcade`,
  `/biobuzz/simulator`, `/waggle-way`, `/join`, `/store`, `/privacy`, `/terms`).
- Record **zero writes / zero form submissions / zero sign-in mutations**.
- Check on both desktop (`1440x900`) and narrow mobile (`320x640`):
  - Zero uncaught `pageerror`, console errors, or unexpected 4xx/5xx API calls.
  - Zero horizontal overflow (`document.documentElement.scrollWidth <= window.innerWidth`).
  - Rendered hero/card/button colors match `#05070A` / `#EDEEF0` / ARES brand
    tokens (no collapsed transparent/unreadable styles from CSS token drops).
  - Real interactive smoke without persistence (e.g., opening desktop dropdowns
    or mobile drawer and pressing `Escape`, or loading interactive simulator UI).
- Always corroborate browser subagent claims and screenshot paths against the
  host `BROWSER_HOST_FACTS` message before citing them.

## 3. Read-Only Cloud, Firebase & Repository Operations Posture

Run only read-only diagnostic commands (stop if credentials are missing and
record the exact blocker):

- `pnpm run appcheck:storage-observe` (inspect App Check unverified request counts
  and observation window without modifying enforcement).
- `pnpm run media:inventory` (verify media reference consistency across live
  records).
- Read-only GCP / GitHub inspection (`infra/gcp/production-deployment.json`,
  `gh run list --branch master --limit 5`, open Dependabot alerts, open PRs,
  branch list, Secret Manager secret *names* without accessing payloads).
