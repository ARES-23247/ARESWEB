# Onshape to Zulip integration

Onshape has no native Zulip connector, so ARESWEB relays Onshape webhook
events into Zulip through the `communicationsApi` Cloud Function:

```
Onshape webhook -> POST /api/webhooks/onshape?token=<secret> -> Zulip stream
```

Only user-initiated event types are relayed — `version.created`,
`document.created`, `comment.created`, and `revision.created`. Noisy events
such as `document.modified` are acknowledged with `{ "status": "ignored" }`
so Onshape does not retry them, and they never reach Zulip.

Security properties:

- The shared secret lives in Google Secret Manager as `ONSHAPE_WEBHOOK_TOKEN`
  and is bound only to `communicationsApi`. Onshape embeds it in the callback
  URL query because Onshape webhooks carry no signature header.
- The token is compared timing-safely before the payload is interpreted, the
  endpoint is IP rate limited, and the body is validated against a strict
  schema (`documentId` is shape-checked before it reaches the link template).
- Display text from Onshape (user, document, and version names) is stripped of
  markdown metacharacters before it is rendered in Zulip.
- Failures to deliver to Zulip surface as HTTP 502 so Onshape retries them;
  ignored event types and successful deliveries return promptly.

The target Zulip stream defaults to `engineering`. Override it by setting the
`ONSHAPE_ZULIP_STREAM` environment variable on `communicationsApi` (for
example `firebase functions:config`-free gen 2 environment configuration) and
redeploying.

## One-time Google Cloud setup

Performed by an operator with the deployer role; the secret must exist before
the route is deployed:

1. Generate a 256-bit URL-safe token.
2. Store it in Secret Manager:

   ```bash
   printf %s "<token>" | gcloud secrets create ONSHAPE_WEBHOOK_TOKEN \
     --project aresfirst-portal --data-file=-
   ```

3. Grant the runtime service account read access if the deploy did not add it
   automatically:

   ```bash
   gcloud secrets add-iam-policy-binding ONSHAPE_WEBHOOK_TOKEN \
     --project aresfirst-portal \
     --member "serviceAccount:aresweb-communications-runtime@aresfirst-portal.iam.gserviceaccount.com" \
     --role roles/secretmanager.secretAccessor
   ```

Retrieve the token during setup with
`gcloud secrets versions access latest --secret ONSHAPE_WEBHOOK_TOKEN --project aresfirst-portal`.
Never store it in source, logs, or browser storage.

## Register the webhook in Onshape

Onshape webhooks are registered through the Onshape REST API by a team mentor
account (Education plans include API access). The account that creates the
webhook must own or share the monitored documents.

1. In Onshape, open **Account → API Access** and create an access key pair for
   the mentor account. Keep the secret in the mentor's password manager; it is
   never needed by ARESWEB.
2. Build the callback URL with the stored token:

   ```text
   https://aresfirst.org/api/webhooks/onshape?token=<ONSHAPE_WEBHOOK_TOKEN>
   ```

3. Register the webhook for the team's CAD document (or company-wide):

   ```bash
   curl -u "<access-key-id>:<access-key-secret>" \
     -H "Content-Type: application/json" \
     -X POST https://cad.onshape.com/api/webhooks \
     -d '{
       "url": "https://aresfirst.org/api/webhooks/onshape?token=<token>",
       "events": ["version.created", "document.created", "comment.created", "revision.created"],
       "documentId": "<cad-document-id>",
       "options": { "documentId": true, "workspaceId": true, "elementId": true, "userId": true }
     }'
   ```

4. Verify end to end by creating a test version in the document and watching
   for the `**[CAD]**` message in the target Zulip stream.

## Rotating the token

Rotation requires a new Secret Manager version, a redeploy of
`communicationsApi`, and re-registering (or updating) the Onshape webhook with
the new callback URL. Do not delete the old secret version until Onshape has
stopped sending to it.
