# Security Operations

This guide covers the production steps required by the repository's security
boundaries. Code changes alone do not rotate a leaked credential or reconcile a
deployed Firebase ruleset.

## Required secret controls

Production Functions depend on independent Secret Manager values. Verify that
all listed values are active before a deployment, and use the same commands when
a credential must be rotated:

```text
firebase functions:secrets:set GITHUB_PAT
firebase functions:secrets:set PROFILE_SYNC_SECRET
firebase functions:secrets:set BLUESKY_APP_PASSWORD
firebase functions:secrets:set BUFFER_API_KEY
firebase functions:secrets:set ONSHAPE_WEBHOOK_TOKEN
```

`GITHUB_PAT` should be a fine-grained token limited to the ARESWEB repository and
only the contents/gist permissions the simulation routes need. The legacy
`settings/GITHUB_PAT` Firestore document must remain deleted. Do not reuse
`ENCRYPTION_KEY` as an API credential.

Set a dedicated App Check reCAPTCHA Enterprise site key in the frontend build:

```text
NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY=your_site_key
```

Store the browser security key as a GitHub repository variable:

- `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`

This key is a public site identifier, not a secret credential. The CI build
stops when the variable is empty. Never use this rule for server keys,
OAuth client secrets, refresh tokens, or bot tokens.

The web client must initialize this key with `ReCaptchaEnterpriseProvider`, and
the same site key must be registered on the Firebase web app's reCAPTCHA
Enterprise App Check configuration.

Public inquiry forms use the same enforced App Check reCAPTCHA Enterprise
attestation as other browser mutations. Do not load a second legacy reCAPTCHA
v3 client on the page; the Google clients share a global namespace and can
interfere with each other. Confirm the App Check key, allowed web origins, and
Firebase App Check registration agree before enabling enforcement; otherwise
legitimate clients will receive 403 responses.

## App Check monitoring and enforcement

Cloud Firestore is enforced after verified production traffic reached 100%.
Keep it enforced. Authentication remains in monitoring until legitimate popup,
redirect, incognito, and mobile-browser sign-ins are consistently verified.

Cloud Storage remains in monitoring during the post-migration observation
window. As of deployment `ad2a40f` on 2026-08-24, gallery, blog, event, editor,
and sponsor media is delivered through publication-aware same-origin gateways.
`storage.rules` denies direct browser reads and writes for those namespaces.
Keep Storage in monitoring for at least 72 hours after that deployment so
delayed or uncommon legitimate clients can be identified before enforcement.

Media records expose opaque asset identifiers and same-origin URLs instead of
Storage paths or download URLs. Public gateways re-check publication state on
every cache miss and use bounded public caching; administrator previews remain
private and uncached. Upload APIs decode and validate images, strip metadata,
create bounded derivatives where applicable, and write through the Admin SDK.
Archiving content can therefore leave a cached public image visible only for
the documented CDN/browser cache window, not for the Storage object's lifetime.

All browser Storage writes are denied by `storage.rules`. Uploads use an
authenticated API route that verifies Firebase identity and role, requires App
Check, applies a distributed quota before allocating the large body, validates
the decoded image, strips metadata, and writes through the media runtime's Admin
SDK identity. Keep public reads and server-owned writes as separate boundaries.

The API also records App Check results for mutation requests. Each event has a
`valid`, `missing`, or `invalid` status. Logs include only the method and route
group. They never include tokens, user IDs, query strings, or document IDs.

Three server integrations do not use Firebase App Check:

- `POST /api/profiles/sync` uses `PROFILE_SYNC_SECRET`.
- `POST /api/webhooks/zulip` uses `ZULIP_WEBHOOK_TOKEN`.
- `POST /api/webhooks/onshape` uses `ONSHAPE_WEBHOOK_TOKEN`, carried in the
  callback URL query because Onshape webhooks send no signature headers.

The Zulip bot credential must come from `ZULIP_BOT_EMAIL` and `ZULIP_API_KEY`
in Google Secret Manager. No source fallback is permitted. Rotate any key that
has ever appeared in repository history before the next deployment, then verify
the bot can only access the streams and actions it needs.

The team media integrations use `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_PHOTOS_REFRESH_TOKEN`, `GOOGLE_DRIVE_REFRESH_TOKEN`, and
`YOUTUBE_API_KEY` from Google Secret Manager.
The OAuth client may live in the Google Cloud project used by the website. The
refresh token may belong to a different, dedicated storage account. Sign in to
that storage account when you grant consent. Do not connect a student's account.
Photos and Drive use separate refresh tokens and separate API processes. See
`docs/GOOGLE_DRIVE_INTEGRATION.md` for Drive's read-only scope, restricted
Picker key, and root-folder setup.

Use this Cloud Logging filter to review custom API results:

```text
resource.type="cloud_run_revision"
resource.labels.service_name=("publicapi" OR "coreapi" OR "driveapi" OR "mediaapi" OR "communicationsapi")
textPayload:"[app-check] App Check observation"
```

Verify all of these checks before each release:

1. Collect at least 72 hours of production data.
2. Test inquiry, admin edit, upload, simulation, and checkout flows.
3. Confirm at least 99% verified traffic in Firebase App Check metrics.
4. Find the cause of every `missing` or `invalid` API mutation.
5. Confirm each protected route group has a recent `valid` result.

Production enforcement is the default. Set the non-secret Functions environment
variable `ENFORCE_APP_CHECK=false` only as a temporary incident override. While
that override exists, the API records observations without rejecting requests.
Remove the override as soon as the supported browser flow is repaired.

Before enabling Storage enforcement, start the observation window at the
deployment that retired direct media delivery and run:

```text
pnpm run appcheck:storage-observe -- --project aresfirst-portal --start 2026-08-24T06:29:00Z
```

The observation boundary follows three controlled direct-denial probes recorded
at `2026-08-24T06:28:24Z`; it must not be moved later to hide unexpected traffic.
The command is read-only, omits app identifiers, accounts for the documented
three-minute Monitoring delay, and treats any direct Storage verification as a
manual-review finding. After at least 72 hours, add `--require-ready`. A clean
metric result is necessary but not sufficient: rerun the live media inventory,
production health probe, direct-denial checks, and authenticated upload/editor
flows before changing enforcement. Never enable enforcement automatically from
the script.

Before enabling Authentication enforcement, test Google popup sign-in on
desktop Chromium/Firefox/WebKit, Android Chromium, iOS Safari, and incognito;
also test a tab left open across a deployment. Review the Authentication App
Check breakdown and investigate every legitimate unverified request. Return a
service to monitoring at once if valid users receive new 401, 403, or permission
errors.

## Coordinated deployment

The HTTP API is split into five processes so a compromised public endpoint does
not inherit unrelated credentials:

- `publicApi`: public and administrative data routes, with no Secret Manager values.
- `coreApi`: inquiry/profile routes, with encryption, reCAPTCHA, profile-sync,
  and Zulip bot secrets used for inquiry alerts and member provisioning.
- `mediaApi`: photo, video, and AI routes, with only their six media secrets.
- `driveApi`: Drive preview and draft-import routes, with encryption, the
  OAuth client pair, and the dedicated Drive refresh token (four secrets).
- `communicationsApi`: task, Zulip, webhook, simulation, and social
  syndication routes, with their seven integration secrets (GitHub, Zulip x3,
  Bluesky, Buffer, Onshape webhook).

The private `syncGoogleDriveChanges` schedule binds only the OAuth client and
dedicated Drive refresh token. It never inherits Photos, AI, YouTube, inquiry,
GitHub, or Zulip secrets.

`taskDueDigest` runs daily at 07:00 America/New_York on the communications
identity, binds only the Zulip bot credentials, maps assignees to nicknames
before posting, and must fail the invocation when Zulip rejects the digest so
Cloud Scheduler retries it.

`cleanupOldInquiries` runs daily and must throw when its Firestore work fails.
The function uses a bounded three-attempt retry policy; never catch and convert
a failed retention run into a successful invocation, because that suppresses
Cloud Functions failure telemetry and leaves stale inquiry PII undiscoverable.

Every deployed workload also uses a dedicated runtime service account. The
service-account email is part of `infra/gcp/production-deployment.json` and the
post-deployment drift check fails if a Function falls back to another identity.
The production access baseline is:

| Workload                 | Project or resource roles                                                                             | Secret access                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `publicApi`              | Firestore user, App Check token verifier                                                              | none                                                               |
| `coreApi`                | Firestore user, App Check token verifier, Firebase Auth viewer                                        | encryption, inquiry reCAPTCHA, profile sync, Zulip bot credentials |
| `mediaApi`               | Firestore user, App Check token verifier, Vertex AI user, object admin on the production media bucket | encryption, Photos OAuth, Gemini, YouTube                          |
| `driveApi`               | Firestore user, App Check token verifier                                                              | encryption, Drive OAuth                                            |
| `communicationsApi`      | Firestore user, App Check token verifier                                                              | GitHub, Zulip, Bluesky, Buffer, and Onshape webhook tokens         |
| `taskDueDigest`          | Firestore user                                                                                        | Zulip bot credentials                                              |
| `cleanupOldInquiries`    | Firestore user                                                                                        | encryption                                                         |
| `syncGoogleDriveChanges` | Firestore user                                                                                        | Drive OAuth                                                        |
| `web`                    | Firestore user                                                                                        | none                                                               |

The Compute Engine default service account is a build-only identity, never a
Function runtime identity. It may hold only `roles/logging.logWriter` at project
scope, `roles/artifactregistry.writer` on the `gcf-artifacts` repository, and
`roles/storage.objectViewer` on the two managed `gcf-v2-sources-*` and
`gcf-v2-uploads-*` buckets. It must have no Secret Manager, Firestore,
application Storage, Vertex AI, or Editor access. Cloud Scheduler may retain
`roles/run.invoker` only on the two private scheduled Cloud Run services because
it uses that account as the OIDC subject. Do not replace these narrow grants
with a broad project role.

The GitHub deployer may impersonate the eight runtime identities and may bind a
reviewed secret to a Function, but it cannot read secret payloads. Keep the
deployer's custom secret-binding permission separate from
`roles/secretmanager.secretAccessor`.

Hosting routes are the boundary between these functions. Keep the rewrite tests
and `FUNCTION_SECRET_BINDINGS` in sync whenever a route moves. Never add a
catch-all secret list to any function.

Deploy the contracted Functions before switching Hosting. The production
workflow derives its Firebase target list from
`infra/gcp/production-deployment.json`, then rejects any missing or unexpected
Function after the release. It never deletes unexpected infrastructure
automatically; investigate and remove it through an explicitly reviewed
operation.

Deploy Functions, indexes, and Firebase rules together. This keeps API queries
and their access rules in sync:

```text
firebase deploy --only firestore:rules,firestore:indexes,storage,functions,hosting
```

Before deployment, run the full gate in `AGENTS.md`. After deployment, verify:

1. Public finance totals load through `/api/finance` without receipt or user IDs.
2. Draft and deleted content cannot be read through client SDKs.
3. Inquiry records are limited to admin/coach roles and new metadata is encrypted.
4. Drive configuration/import/sync rejects non-admin accounts.
5. Simulation editing works with the Secret Manager token and no Firestore token.
6. App Check succeeds from production without repeated 403/throttle warnings.
7. The Robots page loads through `/api/robots` without an index error.
8. The Video Hub loads through `/api/videos/public` without an index error.
9. The post-deployment browser check passes against the Firebase Hosting origin.
   It loads the real Join page, confirms that only the Enterprise reCAPTCHA
   client is present, intercepts the synthetic inquiry before it reaches the
   API, and verifies the browser's App Check token against the mutation-free
   `/api/app-check/canary` endpoint. Never log the captured token or replace the
   intercepted synthetic submission with real applicant data.

## Google Cloud preventive controls

Keep this production baseline enabled:

- Firestore point-in-time recovery and database deletion protection.
- Cloud Storage uniform bucket-level access and seven-day soft delete.
- `constraints/iam.disableServiceAccountKeyCreation` and
  `constraints/iam.disableServiceAccountKeyUpload` enforced on the project.
- Secret Manager `ADMIN_READ`, `DATA_READ`, and `DATA_WRITE` Data Access audit
  logs. Review log volume and retention because Data Access logs can incur cost.
- No user-managed service-account keys. Production deploys use Workload
  Identity Federation.
- Firebase Authentication authorized domains limited to `aresfirst.org`, the
  two Firebase Hosting domains, and `localhost`. Preview channels must be added
  only for an active, reviewed test and removed when that test ends.

When a secret rotates, deploy the new version, confirm the consuming workload,
then disable older versions. Leave disabled versions recoverable during the
rollback window; destroy them only in a separately reviewed cleanup. Delete an
obsolete secret only after source, deployment contracts, and every live
Function have stopped referencing it.

Do not enable Firebase App Check enforcement from configuration review alone.
Keep it in monitoring mode until the 72-hour evidence and flow checks above are
complete.

## Monitoring and billing alerts

The approved production operations recipient is `david.huss@gmail.com`. Cloud
Monitoring channel
`projects/aresfirst-portal/notificationChannels/17263166369941622249` is the
canonical email channel for this address. Do not add another recipient or
replace this channel without explicit confirmation from that person.

Keep the `ARESWEB canonical production` HTTPS uptime check enabled for
`https://aresfirst.org/`. Policy `ARESWEB production availability and TLS` must
remain enabled and attached to the canonical channel. It opens an incident when
at least two public checker regions fail for one minute or when the TLS
certificate has fewer than 15 days remaining, and it sends both opened and
closed notifications.

The protected release workflow runs the complete route, response, metadata,
404, and security-header contract against the Firebase Hosting origin. This
avoids false deployment failures when Cloudflare intentionally rejects a
GitHub-hosted runner IP. A best-effort canonical-domain probe remains visible in
the workflow, while the multi-region uptime check above is authoritative for
continuous `aresfirst.org` reachability and TLS monitoring.

The same channel is linked to both active billing-account budgets: `$50 Monthly
budget alert` and `BigQuery`. Default Billing IAM recipients remain enabled, so
the explicit operations recipient supplements rather than replaces billing
administrators and users. When adding a budget, attach the canonical channel and
keep at least one threshold rule; otherwise no email is generated.

Cloud Monitoring does not provide a generic channel test. Verify the channel is
enabled, every production policy and budget references it, the uptime check has
recent `monitoring.googleapis.com/uptime_check/check_passed` data, and the live
endpoint returns 2xx. If end-to-end email delivery must be proven, schedule a
controlled incident test and warn the recipient first; do not weaken the real
policy or take production down merely to produce a test message.

The project-wide Editor assignment for `jules.huss@gmail.com` was explicitly
confirmed as intentional on 2026-08-13. Reconfirm its need during access
reviews, but do not remove or narrow it based only on automated least-privilege
analysis.

## Photo derivative operations

New image ingestion generates bounded WebP thumbnail and medium variants. The
legacy-media backfill is deliberately separate from deployment and defaults to
read-only inspection. Follow
[`MEDIA_DERIVATIVE_BACKFILL.md`](./MEDIA_DERIVATIVE_BACKFILL.md); never add its
apply command to CI, Hosting deployment, or Functions startup.

## Public site announcements

Administrators and coaches can manage the single site-wide announcement at
`/dashboard/announcements`. Visitors do not need an account to read a currently
active announcement. The public endpoint returns only the message, priority,
optional internal link, schedule bounds, and opaque revision; it never returns
the publishing user's ID or other Firestore metadata.

- Treat every announcement as public. Do not include student names, contact
  details, private addresses, travel plans, or other personal information.
- Use only internal links beginning with `/`. The API rejects external links so
  a compromised or mistaken announcement cannot become a phishing redirect.
- Scheduling is evaluated server-side. Disable an obsolete announcement from
  the manager instead of editing Firestore directly.
- Direct client access to the `settings/siteAnnouncement` document remains
  denied by Firestore rules. All reads and writes go through the bounded DTO
  route, and every publish/disable operation creates an audit record.
- A visitor's dismissal is scoped to the announcement revision. Publishing a
  changed message creates a new opaque revision and makes it visible again.

## GitHub Actions deployment controls

- Pull-request jobs must not receive Firebase or Google Cloud credentials.
- Production deploys must reference the protected GitHub `production`
  environment and run only from `master` after the required test gate.
- Probe both the canonical domain and Firebase Hosting origin after a deploy.
  The source-controlled production contract checks success routes, raw metadata,
  genuine page/API 404s, sitemap caching, and critical security headers with
  bounded retries.
- Keep repository Actions permissions read-only by default. Grant write scopes
  only to the production deployment job.
- Disable force pushes to `master`, apply protection to administrators, and
  require the CI test gate and CodeQL before merge.
- Pin third-party actions to immutable commit SHAs.
- Authenticate production deploys with GitHub OIDC and Google Workload Identity
  Federation. The provider accepts only repository ID `1213635409`, owner ID
  `228356285`, `refs/heads/master`, and the `production` environment.
- Impersonate only
  `aresweb-github-deployer@aresfirst-portal.iam.gserviceaccount.com`. This
  service account must have no user-managed keys and no permission to read
  Secret Manager values.
- Grant that service account `roles/datastore.indexAdmin` so CI can deploy the
  source-controlled Firestore indexes. This role manages index definitions. It
  does not grant access to read or change Firestore documents.
- Keep the project custom role `areswebDeploymentAuxiliary` bound to that
  service account with only `firebaseauth.configs.get`,
  `firebaseauth.configs.update`, `firebasestorage.defaultBucket.get`,
  `storage.buckets.get`, `cloudfunctions.functions.getIamPolicy`,
  `cloudfunctions.functions.setIamPolicy`, `run.services.getIamPolicy`, and
  `run.services.setIamPolicy`. The role also includes read-only IAM-policy
  inspection for the project, Artifact Registry, and Storage so the production
  workflow can reject build-identity privilege drift before deployment.
  Firebase needs the Function and Cloud Run IAM
  permissions to apply the source-declared public invoker policy to HTTPS
  entry points; application authentication and authorization still run inside
  the split API services.
- Keep that role synchronized from
  `infra/gcp/aresweb-deployment-auxiliary-role.json`. Applying role changes is an
  explicit operator action; the deployment workflow verifies Cloud Run invoker
  policy but does not grant itself broader IAM administration.
- Pin the Google Cloud CLI version used by the deploy job and its immutable
  setup action revision. Upgrade both through normal dependency review so a
  mutable runner image cannot silently change drift-check behavior.
- Keep `id-token: write` limited to the production deploy job. Do not create
  `FIREBASE_SERVICE_ACCOUNT_KEY`, `FIREBASE_TOKEN`, or equivalent long-lived
  repository secrets.
- Ignore `gha-creds-*.json`; the Google authentication action creates this
  short-lived ADC file during a job and removes it in post-job cleanup.

## Incident and drift response

- If a secret may have been readable, rotate it; a rules fix is not revocation.
- Treat `infra/gcp/production-deployment.json` as the expected Function
  inventory. The deployment job fails on unexpected functions, secret-binding
  expansion, resource-bound changes, runtime/region changes, inactive services,
  or public/private Cloud Run invoker drift.
- Compare deployed Firestore/Storage rules with this repository after every rules
  incident. Treat mismatches as deployment drift and resolve them explicitly.
- Review Cloud Logging for `INTERNAL_ERROR`, App Check failures, rate-limit spikes,
  and repeated authorization denials. Logs must not contain raw PII or tokens.
- Use Firebase Emulator Suite integration tests before expanding public access.
