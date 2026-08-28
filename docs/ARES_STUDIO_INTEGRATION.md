# ARES Robotics Studio integration

ARES Robotics Studio submits human-approved engineering notebook entries to a
server-to-server endpoint. The website always stores them as unpublished blog
drafts; a team member must review and publish them from `/dashboard/blog`.

## Endpoint

`POST /api/integrations/robotics-studio/v1/notebook-drafts`

Required headers:

- `Authorization: Bearer <installation token>`
- `Content-Type: application/json`
- `Idempotency-Key: <entryId>:<contentHash>`

The body is the strict schema-version-1 `EngineeringNotebookEntry` emitted by
Studio. `reviewState` must be `APPROVED`. The server independently recomputes
the Kotlin-compatible content hash, verifies the installation's team or exact
workspace scope, applies an hourly installation quota, and records the draft,
revision, idempotency receipt, and redacted audit event in one transaction.

The response is:

```json
{
  "draftId": "studio-entry-id-r1-acde01234567",
  "reviewUrl": "https://aresfirst.org/dashboard/blog?edit=studio-entry-id-r1-acde01234567",
  "contentHash": "<sha256>",
  "duplicate": false
}
```

An exact retry returns the durable receipt with `duplicate: true`. The endpoint
never publishes content and never accepts an entry that has not reached the
Studio `APPROVED` review state.

## Provision or rotate an installation

Run from `functions/` with Application Default Credentials for the target
Firebase project. Retrieve `ABUSE_HMAC_SECRET` from Secret Manager into the
process environment without printing it. The command requires a new output
path and writes the token there once with owner-only permissions where the host
supports them.

```powershell
$env:ABUSE_HMAC_SECRET = gcloud secrets versions access latest --secret ABUSE_HMAC_SECRET --project aresfirst-portal
pnpm studio:provision -- --project aresfirst-portal --installation ares-team-23247 --team 23247 --output C:\secure-temp\ares-studio-installation.json
Remove-Item Env:\ABUSE_HMAC_SECRET
```

Use `--workspace team/season/robot` for a narrower scope. Use `--rotate` only
after confirming Studio can be updated immediately, because the previous token
stops working as soon as the Firestore document changes. Tokens expire after
365 days by default; `--expires-days` accepts 1 through 730.

After copying the token into Studio's OS-protected credential store, securely
remove the one-time handoff file. Revocation is immediate by changing the
installation document's `status` to `revoked`.

## Data ownership and portability

The endpoint is an optional CMS adapter, not part of Studio's core domain.
Other teams can use local Markdown, Google Drive, a generic webhook, or their
own compatible CMS publisher without depending on aresfirst.org. Robot code
never calls this API; the desktop app remains the cloud boundary.
