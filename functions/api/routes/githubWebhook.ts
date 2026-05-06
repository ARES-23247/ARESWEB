import { typedHandler } from "../utils/handler";
/* eslint-disable @typescript-eslint/no-explicit-any -- GitHub webhook payloads are dynamic and external */
import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv } from "../middleware";
import { sendZulipMessage } from "../../utils/zulipSync";
import { githubWebhookRoute } from "../../../shared/routes/webhooks";

const githubWebhookRouter = new OpenAPIHono<AppEnv>();

// ── HMAC-SHA256 Signature Verification ───────────────────────────────
async function verifyGitHubSignature(
  secret: string,
  payload: string,
  signature: string
): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const PREFIX = "sha256=";
    const sigHex = signature.length >= PREFIX.length ? signature.slice(PREFIX.length) : signature;
    const sigBytes = new Uint8Array((sigHex.match(/.{1,2}/g) || []).map(byte => parseInt(byte, 16)));

    const prefixMatches = signature.length >= PREFIX.length &&
      signature.substring(0, PREFIX.length) === PREFIX;

    if (!prefixMatches || sigBytes.length === 0) {
      await crypto.subtle.verify("HMAC", key, new Uint8Array(64), enc.encode(payload));
      return false;
    }

    return await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      enc.encode(payload)
    );
  } catch {
    return false;
  }
}

// ── POST /webhooks/github — Receive GitHub webhook events ────────────
githubWebhookRouter.openapi(githubWebhookRoute, typedHandler<typeof githubWebhookRoute>(async (c) => {
  const secret = c.env.GITHUB_WEBHOOK_SECRET;
  const rawBody = await c.req.text();

  if (!secret) {
    console.warn("[GitHubWebhook] GITHUB_WEBHOOK_SECRET not configured. Rejecting request.");
    return c.json({ error: "Webhook not configured" }, 503);
  }

  const sig = c.req.header("X-Hub-Signature-256") || "";
  const valid = await verifyGitHubSignature(secret, rawBody, sig);
  if (!valid) {
    console.warn("[GitHubWebhook] Invalid signature");
    return c.json({ error: "Invalid signature" }, 401);
  }

  const event = c.req.header("X-GitHub-Event") || "unknown";
  let payload: any; // Webhook payloads are dynamic, 'any' is acceptable for top-level switch
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const engineeringStream = "engineering";

  try {
    switch (event) {
      case "projects_v2_item": {
        const action = payload.action;
        const item = payload.projects_v2_item;
        const changes = payload.changes;

        if (action === "created") {
          c.executionCtx.waitUntil(sendZulipMessage(
            c.env,
            engineeringStream,
            "Project Board",
            `📋 **New project item created**\nItem ID: \`${item?.node_id || "unknown"}\``
          ).catch(err => console.error(err)));
        } else if (action === "edited" && changes) {
          const fieldChanges = Object.entries(changes)
            .map(([key, val]: [string, any]) => `**${key}**: \`${String(val.from)}\` → \`${String(val.to)}\``)
            .join("\n");

          if (fieldChanges) {
            c.executionCtx.waitUntil(sendZulipMessage(
              c.env,
              engineeringStream,
              "Project Board",
              `🔄 **Project item updated**\nItem: \`${item?.node_id || "unknown"}\`\n${fieldChanges}`
            ).catch(err => console.error(err)));
          }
        } else if (action === "deleted") {
          c.executionCtx.waitUntil(sendZulipMessage(
            c.env,
            engineeringStream,
            "Project Board",
            `🗑️ **Project item removed** from board`
          ).catch(err => console.error(err)));
        }
        break;
      }

      case "push": {
        const ref = payload.ref;
        const commits = payload.commits;
        const repo = payload.repository?.full_name || "unknown";
        const branch = ref?.replace("refs/heads/", "") || "unknown";
        const commitCount = commits?.length || 0;

        if (commitCount > 0) {
          const commitList = (commits || [])
            .slice(0, 5)
            .map((comm: any) => `• ${comm.message.split("\n")[0]} *(${comm.author?.name || 'unknown'})*`)
            .join("\n");

          c.executionCtx.waitUntil(sendZulipMessage(
            c.env,
            engineeringStream,
            `${repo}`,
            `⚡ **${commitCount} new commit${commitCount > 1 ? "s" : ""}** pushed to \`${branch}\`\n\n${commitList}${commitCount > 5 ? `\n...and ${commitCount - 5} more` : ""}`
          ).catch(err => console.error(err)));
        }
        break;
      }

      case "pull_request": {
        const action2 = payload.action;
        const pr = payload.pull_request;
        const repo2 = payload.repository?.full_name || "unknown";

        if (["opened", "closed", "reopened"].includes(action2)) {
          const emoji = action2 === "opened" ? "🟢" : pr?.merged ? "🟣" : action2 === "closed" ? "🔴" : "🟡";
          const status = pr?.merged ? "merged" : action2;
          c.executionCtx.waitUntil(sendZulipMessage(
            c.env,
            engineeringStream,
            `${repo2}`,
            `${emoji} **PR ${status}**: [${pr?.title || "Untitled"}](${pr?.html_url || "#"}) by @${pr?.user?.login || "unknown"}`
          ).catch(err => console.error(err)));
        }
        break;
      }

      case "issues": {
        const action3 = payload.action;
        const issue = payload.issue;
        const repo3 = payload.repository?.full_name || "unknown";

        if (["opened", "closed", "reopened"].includes(action3)) {
          const emoji = action3 === "opened" ? "📝" : action3 === "closed" ? "✅" : "🔄";
          c.executionCtx.waitUntil(sendZulipMessage(
            c.env,
            engineeringStream,
            `${repo3}`,
            `${emoji} **Issue ${action3}**: [${issue?.title || "Untitled"}](${issue?.html_url || "#"}) by @${issue?.user?.login || "unknown"}`
          ).catch(err => console.error(err)));
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("[GitHubWebhook] Error processing event:", err);
  }

  return c.json({ received: true, event }, 200);
}));

export default githubWebhookRouter;
