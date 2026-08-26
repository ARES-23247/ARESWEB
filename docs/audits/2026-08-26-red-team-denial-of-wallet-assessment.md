# Red-Team and Denial-of-Wallet Assessment — 2026-08-26

## Executive result

No Critical or High-severity exploit was identified in the authorized scope.
The application rejected the executed authentication, authorization, App Check,
upload, traversal, webhook, malformed-input, and public-DTO attacks. Low-rate
production probes passed **23 of 23** checks, and the complete disposable
Firebase-emulator attack suite passed **47 of 47** checks.

ARESWEB currently handles an attack by rejecting untrusted mutations before
expensive work, applying per-process request limits, enforcing distributed
per-user quotas on selected expensive operations, and bounding Cloud Run scale.
Those controls materially limit impact. Detection and cost containment are less
mature: there are no attack-specific alert policies, the general budget alert is
not a hard cap, and several public reads can amplify one request into hundreds or
thousands of Firestore reads.

This assessment found five Medium denial-of-wallet/operational-resilience issues
and one Low key-hardening opportunity. It did not find an authentication bypass,
student-PII disclosure, secret disclosure, injection exploit, or currently
exploitable dependency advisory. This is a dated, bounded assessment—not a claim
that the site is completely secure or immune to denial of service.

## Local remediation verification

The same-day hardening worktree addresses the repository-controlled portion of
every finding. It has **not** been pushed or deployed, and the declarative alert,
budget, secret, and API-key changes have **not** been applied to Google Cloud.
Those production mutations still require explicit owner approval.

| Finding | Verified local disposition |
| --- | --- |
| RT-DOW-01 | `sitemap.xml` now serves a compressed durable artifact (or a truthful static fallback); only `refreshPublicSitemap` scans source collections. The request path has a shared anonymous quota. |
| RT-DOW-02 | Calendar list/feed expansion uses one date-bounded `occurrences` collection-group query with explicit 500/1,000-document ceilings and a fail-closed saturation response. |
| RT-DOW-03 | Calendar, finance, sitemap, feed, OG rendering, and simulations have privacy-preserving shared anonymous quotas. Official simulation registry/source data is durably cached, and arbitrary repository-file enumeration is rejected. |
| RT-DOW-04 | AI provider routes reserve atomic short-window, daily-user, daily-project, and estimated-token budgets. Output ceilings were reduced, and `system_settings/ai_generation` plus `AI_GENERATION_DISABLED` provide an AI-only circuit breaker. |
| RT-DOW-05 | Redacted security events, five log-metric/alert definitions, platform signal requirements, project-budget guidance, and a reversible containment runbook are checked in and validated by CI. Cloud metrics, policies, channels, and the budget remain pending. |
| RT-HARD-01 | `docs/GOOGLE_API_KEY_INVENTORY.md` records intended callers, observed restrictions, safe incremental narrowing, and the seven-day disable-before-delete process without recording key values. |

## Authorization, scope, and state

- Explicitly authorized by the site and repository owner against the first-party
  ARESWEB system at `https://aresfirst.org`, its split Cloud Functions services,
  and disposable local Firebase emulators.
- Audited commit: `184c62613dc18c886397d79a79af22080c85bce9` on `master`.
- Locally verified remediation commit:
  `2c8a8934e6e870275643bb9edf661f66c8c09bb5` on `master`; not pushed or deployed.
- The tracked worktree was clean at test start.
- Date and timezone: 2026-08-26, America/New_York.
- Production tests were low-rate and non-destructive. No sustained traffic,
  denial-of-service load, credential spraying, production write, upload, inquiry,
  integration post, secret rotation, or cloud-configuration change was performed.
- Full-strength authorization, malformed-body, upload, and rate-limit tests used
  disposable emulator identities and data.
- Review focus: OWASP API Security API4 resource consumption, route/API/form/login
  protection, cost-amplification paths, App Check, authorization, rate limiting,
  Cloud Run scale caps, dependency/secret hygiene, telemetry, budgets, and
  incident response.

## How the system handles an attack today

| Attack stage | Current behavior | Result and residual gap |
| --- | --- | --- |
| Untrusted mutation reaches an API | Mutation App Check executes before the route; Firebase authentication and active team-role authorization then run where required. | Live AI, upload, Drive, YouTube, simulation-gist, and task-notification probes were rejected with `401` before external or billable route work. App Check is an abuse signal, not a replacement for authorization; both layers are present. |
| Large upload is attempted | Authentication and a Firestore-backed distributed per-user quota run before the 12 MB/5 MB body parsers. MIME, magic-byte, SVG, and maximum-size checks run afterward. | Unauthorized and malformed uploads failed in the emulator suite without bypass. |
| Authorized user repeatedly invokes expensive features | AI, Drive import, YouTube sync, Photos upload, and selected other operations use Firestore-backed per-user quotas. | Quotas coordinate across instances, but AI has no daily project-wide request/token ceiling or automatic cost circuit breaker. |
| Anonymous client floods public reads | Express limiters return `429` per runtime process, and Cloud Run has configured maximum instances. | Limits are not shared across instances. Direct Cloud Run origins and public Firestore-amplifying routes leave denial-of-wallet exposure. |
| Runtime load grows | API services are capped at 10 instances; the dynamic web renderer is capped at 5. Memory, concurrency, and timeouts are explicitly bounded. | Scale caps limit compute growth but do not cap downstream Firestore, GitHub, or Vertex AI usage per request. Cloud Run can also temporarily exceed a configured maximum in some circumstances. |
| Rejected/error traffic is generated | Requests are rejected with generic responses and redacted server logs. Uptime/TLS and billing-budget alerts exist. | No alert currently pages on elevated `401`, `403`, `429`, App Check failures, `5xx`, instance time, Firestore operations, or AI usage. Containment remains manual. |

The observed seven-day production status telemetry contained normal/rejected
`400`, `401`, `403`, and `404` responses but no `429` records in the sampled
window. Eight `publicApi` `500` responses were confined to old August 19
revisions; the current `publicApi` revision had no sampled `5xx`. These counts are
not attributed to an attacker—they demonstrate rejection/error activity, not
intent.

## Confirmed findings

### RT-DOW-01 — Public sitemap can amplify one request into up to 20,000 Firestore document reads

- **Severity:** Medium
- **Confidence:** High — source-confirmed and live route behavior confirmed.
- **Status:** Remediated locally; pending reviewed deployment and artifact warm-up.
- **Evidence:** The global limiter is mounted only beneath `/api` at
  `functions/src/apiApp.ts:40-46`. The same sitemap router is exposed outside
  that prefix at `functions/src/apps/public.ts:33-34`. Each of four collections
  can scan up to 5,000 documents at `functions/src/routes/sitemap.ts:10-12`,
  `:63-94`, and `:149-170`. The direct production `/sitemap.xml` response had no
  rate-limit headers, while `/api` responses did. The route supplies a cache
  policy at `functions/src/routes/sitemap.ts:240-242`, but the direct Cloud Run
  origin still executes the handler when requested.
- **Impact:** A low request rate can produce a much higher number of billable
  Firestore reads. Client/CDN caching helps normal crawlers but is not a security
  boundary and can be bypassed through the public function origin.
- **Remediation:** Precompute the sitemap on content publication or a schedule
  and serve a static object. Until then, place every alias behind a shared
  distributed quota/cache and ensure the direct service origin cannot bypass the
  intended edge policy. Retain the existing collection cap as a final guard.
- **Acceptance test:** Repeated canonical and direct-origin requests within the
  cache lifetime do not execute Firestore queries. A bounded integration test
  counts reads, and the direct alias returns shared rate-limit behavior.

### RT-DOW-02 — Public recurring-event expansion has a bounded but large N+1 read pattern

- **Severity:** Medium
- **Confidence:** High for the code path; Medium for present-day cost because the
  live number of recurring parents/overrides was not enumerated.
- **Status:** Remediated locally; pending reviewed index/rules/function deployment.
- **Evidence:** The public events endpoint accepts up to 100 parent records at
  `functions/src/routes/calendar.ts:267-281`. It then queries an `occurrences`
  subcollection separately for every recurring parent and allows up to 200
  occurrence documents per parent at `functions/src/routes/calendar.ts:107-125`.
  The route limiter is 120 requests per 15 minutes at
  `functions/src/routes/calendar.ts:198-208`, using the default per-process
  store.
- **Impact:** In the worst permitted shape, one public request can evaluate 100
  subqueries and return up to 20,000 occurrence documents in addition to parent
  reads. Repetition can create disproportionate Firestore cost and latency.
- **Remediation:** Query only occurrence dates intersecting the requested render
  window, move occurrences into a bounded collection-group query or materialized
  public projection, and cache the resulting public calendar DTO. Keep read cost
  proportional to the requested time window, not the number of parent events.
- **Acceptance test:** Seed 100 recurring parents with historical occurrence
  records and assert that query/read count remains below a documented constant
  for a fixed date window. Verify identical results for cancellations and
  overrides.

### RT-DOW-03 — Default rate-limit stores are isolated per Cloud Run instance

- **Severity:** Medium
- **Confidence:** High — source-confirmed and consistent with the library's
  documented default MemoryStore behavior.
- **Status:** Remediated locally for the identified costly public routes; pending secret creation and reviewed deployment.
- **Evidence:** Global and route-specific limiters omit a shared `store`, including
  `functions/src/apiApp.ts:40-46`, `functions/src/web.ts:38-44`,
  `functions/src/routes/calendar.ts:200-208`,
  `functions/src/routes/finance.ts:18-24`, and
  `functions/src/routes/simulations.ts:11-18`. API functions can scale to 10
  instances at `functions/src/index.ts:22-30`; the dynamic web function is capped
  separately. The public simulations routes make authenticated GitHub API calls
  on every list/file request at `functions/src/routes/simulations.ts:36-70` and
  `:125-150`, and the live direct-origin response was not cacheable.
- **Impact:** An attacker distributed across source addresses or runtime
  instances can multiply nominal request limits. Direct function origins also
  bypass hosting/CDN caching. This can consume Cloud Run, Firestore, GitHub API,
  image-rendering, and other upstream budgets without violating any single
  process's counter.
- **Remediation:** Add a privacy-preserving distributed limiter for anonymous
  costly routes, keyed by a rotating HMAC of normalized client address, or enforce
  a first-party edge/WAF policy that cannot be bypassed via direct service URLs.
  Bundle or durably cache public simulation artifacts instead of consuming the
  repository PAT on every public GET. Cache/materialize other stable public DTOs.
- **Acceptance test:** Concurrent requests routed across multiple instances share
  one limit and receive `429` with `Retry-After`. Direct origins cannot evade the
  policy. Repeated stable public reads do not contact their upstream dependency.

### RT-DOW-04 — AI quotas lack daily user and project-wide cost ceilings

- **Severity:** Medium
- **Confidence:** High — source-confirmed.
- **Status:** Remediated locally; pending reviewed deployment and operational threshold review.
- **Evidence:** AI requests have a distributed per-user quota of 30 requests per
  15 minutes at `functions/src/routes/ai.ts:11-23`. Input ceilings permit 20,000
  characters for grammar, 42,000 combined prompt/text/context characters for the
  assistant, 40,000 conversation characters, and a 5 MB image payload at
  `functions/src/routes/ai.ts:25-94`. The media function can run 10 instances,
  10 concurrent requests each, for up to 300 seconds with 1 GiB memory at
  `functions/src/index.ts:67-75`.
- **Impact:** One authorized or compromised member can make up to 2,880 generation
  requests in 24 hours at the steady configured rate, potentially using large
  contexts. Student/member AI access is intentional, but there is no daily
  per-user token allowance, project-wide generation ceiling, or automated
  AI-only shutdown when cost rises unexpectedly.
- **Remediation:** Add daily per-user request/token budgets, a project-wide daily
  allowance, model-specific maximum-output limits, and an operational AI kill
  switch that leaves the rest of the site available. Export usage/cost metrics
  without logging prompt content or user identifiers.
- **Acceptance test:** Quotas coordinate across instances and return `429` with
  `Retry-After` at both user and project thresholds. A synthetic project-cap test
  disables generation while public/read-only site flows remain healthy.

### RT-DOW-05 — Attack detection and cost containment are mostly manual

- **Severity:** Medium
- **Confidence:** High — verified against the live Google Cloud configuration
  and repository runbook.
- **Status:** Repository controls complete; Google Cloud alert/budget installation remains pending explicit owner approval.
- **Evidence:** The live project had one enabled uptime/TLS alert policy and no
  custom log-based metrics. No policy covered App Check rejection, authorization
  denial, `429`, `5xx`, Cloud Run instance/billable time, Firestore operation
  volume, or Vertex AI usage. A monthly $50 notification budget and a separate
  BigQuery budget exist, but the general budget is billing-account-wide rather
  than scoped to this project and does not stop spend. The incident steps at
  `docs/SECURITY_OPERATIONS.md:388-399` require manual log review.
- **Impact:** Prevention can work while operators remain unaware until availability
  degrades or a delayed billing threshold is crossed. The response path does not
  automatically isolate the expensive feature under attack.
- **Remediation:** Add redacted log-based metrics and alerts for abnormal App
  Check failures, authorization failures, `429`, and `5xx`; alert on Cloud Run
  instance/billable time, Firestore reads/writes, and Vertex usage; scope a budget
  to this project; and document tested feature-level containment switches. Avoid
  automatic full-project billing disablement because it can destroy service
  availability and data workflows.
- **Acceptance test:** A controlled synthetic signal opens and resolves an alert
  to the canonical recipient without PII in the metric. Budget filters name the
  project. The runbook contains reversible, tested containment commands for AI,
  uploads, and public-cache regeneration.

### RT-HARD-01 — Two API keys merit a least-privilege inventory

- **Severity:** Low
- **Confidence:** Medium — live restrictions were inspected, but every historical
  client use was not exercised.
- **Status:** Inventory and safe rollout plan documented; live key changes remain pending owner review.
- **Evidence:** The Picker key is restricted to the expected first-party origins
  and Picker API, and the YouTube server key is restricted to the YouTube API.
  The Firebase browser key has appropriate first-party/localhost referrer
  restrictions but a broad API-target allowlist. A separately named desktop key
  has no application restriction and is limited to identity/secure-token APIs.
  The tracked `.env.production` contains only expected public Firebase browser
  configuration; no private credential was found.
- **Impact:** Broad target lists and unowned legacy keys increase abuse surface if
  a key is copied. Firebase browser API keys are public identifiers, not secrets;
  authorization still belongs to rules, App Check, and server middleware.
- **Remediation:** Inventory the exact client and API for each key, remove unused
  target APIs, retire an unused desktop key, and keep authorized-domain/App Check
  tests in the rollout. Do not replace these controls with key secrecy claims.
- **Acceptance test:** All login, App Check, Picker, Photos, Drive, and YouTube
  flows pass on canonical, Firebase-hosted, and approved local origins after each
  incremental restriction; disallowed origins/APIs fail.

## Controls that held

- The route-security invariant reported **98 protected mutation routes**: 93
  Firebase-authorized routes and five intentionally secret-authenticated or
  scheduled exceptions.
- Live unauthorized requests to AI grammar, photo upload, Drive browse, YouTube
  sync, simulation gist, and task notification returned `401`. The specific AI
  response was `APP_CHECK_REQUIRED`, confirming rejection before route work.
- The emulator suite rejected signed-up-but-unauthorized users, member-to-admin
  escalation, profile IDOR, traversal, forged webhooks, oversized inquiry
  metadata, prototype-shaped input, upload MIME/magic mismatch, SVG, oversized
  upload, unauthorized upload, inquiry flooding, malformed JSON, and unauthorized
  admin access.
- Authentication verifies the Firebase token and current active authorization
  record; role checks do not trust client claims alone.
- Large upload authentication and Firestore-backed quotas execute before large
  request-body allocation at `functions/src/apiApp.ts:50-67`.
- Inquiry PII is encrypted before Firestore storage and only masked data is sent
  to Zulip at `functions/src/routes/inquiries.ts:64-117`.
- Public content crosses explicit DTO boundaries, public Firestore reads are
  restricted by rules, and server errors return generic responses with redacted
  diagnostic logging.
- Cloud Run services have explicit memory, timeout, concurrency, maximum-instance,
  service-account, and secret bindings. Secret blast radius is split across
  function groups.
- GitHub reported zero open Dependabot, code-scanning, and secret-scanning alerts
  at the audited revision. `pnpm audit --prod --audit-level=high` reported no
  known vulnerability.

## Reproducible validation

- `node scripts/pentest/attack-suite.mjs --target=prod` — **23 passed, 0 failed**.
- Complete Functions/Auth/Firestore/Storage emulator attack suite — **47 passed,
  0 failed**. The first invocation intentionally failed closed because the local
  encryption secret was absent; a process-only disposable emulator value was
  then supplied and the complete suite passed. No secret was written to disk.
- Focused Functions security/resource tests — **11 files, 177 tests passed**.
- Firestore and Storage rules tests — **2 files, 30 tests passed**.
- Complete frontend/unit coverage — **146 files, 805 tests passed**.
- Complete Cloud Functions coverage — **66 files, 793 tests passed**; the new
  utilities meet their 85% line / 100% function ratchets.
- Playwright desktop/mobile/browser regression suite — **111 tests passed**.
- Admin SDK Firestore emulator integration — **2 files, 5 tests passed**.
- Production build and bundle budgets — passed (the existing large editor
  chunks remain within their explicit lazy/editor budgets).
- `pnpm run validate:security-observability` — five redacted metric definitions
  and their bounded alert policies validated.
- `pnpm run check:route-security` — passed, 98 mutation routes classified.
- `pnpm audit --prod --audit-level=high` — no known vulnerability.
- Low-rate direct-origin checks compared canonical Hosting/API behavior with each
  relevant Cloud Run service; no sustained concurrency or performance test was
  performed.

## Prioritized remediation plan

1. Precompute/cache the sitemap and bound recurring-calendar reads.
2. Introduce a shared anonymous distributed limiter or non-bypassable edge policy
   for costly public routes; retain current per-user distributed quotas.
3. Add daily user/project AI budgets and an AI-only operational circuit breaker.
4. Add attack/cost telemetry and project-scoped alerting, then exercise the
   incident runbook with synthetic signals.
5. Inventory and incrementally narrow the broad/legacy API keys.

The first two items reduce the clearest unauthenticated denial-of-wallet paths.
The third and fourth determine whether an authorized-account abuse event is
contained quickly and whether the team learns about it before the billing cycle.

## Methodology references

- [OWASP API4:2023 Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)
- [express-rate-limit stores](https://github.com/express-rate-limit/express-rate-limit)
- [Firebase App Check](https://firebase.google.com/docs/app-check)
- [Firebase App Check monitoring](https://firebase.google.com/docs/app-check/monitor-metrics)
- [Cloud Run maximum instances](https://docs.cloud.google.com/run/docs/configuring/max-instances-limits)
- [Cloud Billing usage controls](https://docs.cloud.google.com/billing/docs/how-to/control-usage)
