/* eslint-disable @typescript-eslint/no-unused-vars */
import { typedHandler } from "../utils/handler";
import { ApiError } from "../middleware/errorHandler";
import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv } from "../middleware";
import { sendZulipMessage } from "../../utils/zulipSync";
import { githubWebhookRoute } from "../../../shared/routes/webhooks";

// ── GitHub Webhook Payload Types ────────────────────────────────────────

interface GitHubUser {
  login: string;
  name?: string;
}

interface GitHubRepository {
  full_name: string;
}

interface GitHubChangeValue {
  from?: unknown;
  to?: unknown;
}

interface ProjectChanges {
  [key: string]: GitHubChangeValue;
}

interface ProjectV2Item {
  node_id?: string;
}

interface ProjectV2Payload {
  action: string;
  projects_v2_item?: ProjectV2Item;
  changes?: ProjectChanges;
}

interface GitHubCommit {
  message: string;
  author?: {
    name?: string;
  };
}

interface PushPayload {
  ref?: string;
  commits?: GitHubCommit[];
  repository?: GitHubRepository;
}

interface PullRequest {
  title?: string;
  html_url?: string;
  user?: GitHubUser;
  merged?: boolean;
}

interface PullRequestPayload {
  action: string;
  pull_request?: PullRequest;
  repository?: GitHubRepository;
}

interface Issue {
  title?: string;
  html_url?: string;
  user?: GitHubUser;
}

interface IssuesPayload {
  action: string;
  issue?: Issue;
  repository?: GitHubRepository;
}

// Union type for all GitHub webhook payloads
type GitHubWebhookPayload =
  | ProjectV2Payload
  | PushPayload
  | PullRequestPayload
  | IssuesPayload
  | Record<string, unknown>;



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
    const sigBytes = new Uint8Array((sigHex.match(/.{1,2}/g) || []).map((byte: string) => parseInt(byte, 16)));

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
githubWebhookRouter.openapi(githubWebhookRoute, (async (c) => {
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
    throw new ApiError("Invalid signature", 401);
  }

  const event = c.req.header("X-GitHub-Event") || "unknown";
  let payload: GitHubWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as GitHubWebhookPayload;
  } catch {
    throw new ApiError("Invalid JSON", 400);
  }

  const engineeringStream = "engineering";

  try {
    switch (event) {
      case "projects_v2_item": {
        const p = payload as ProjectV2Payload;
        const action = p.action;
        const item = p.projects_v2_item;
        const changes = p.changes;

        if (action === "created") {
          c.executionCtx.waitUntil(sendZulipMessage(
            c.env,
            engineeringStream,
            "Project Board",
            `📋 **New project item created**\nItem ID: \`${item?.node_id || "unknown"}\``
          ).catch((err: unknown) => console.error(err)));
        } else if (action === "edited" && changes) {
          const fieldChanges = Object.entries(changes)
            .map(([key, val]) => `**${key}**: \`${String((val as { from?: unknown }).from)}\` → \`${String((val as { to?: unknown }).to)}\``)
            .join("\n");

          if (fieldChanges) {
            c.executionCtx.waitUntil(sendZulipMessage(
              c.env,
              engineeringStream,
              "Project Board",
              `🔄 **Project item updated**\nItem: \`${item?.node_id || "unknown"}\`\n${fieldChanges}`
            ).catch((err: unknown) => console.error(err)));
          }
        } else if (action === "deleted") {
          c.executionCtx.waitUntil(sendZulipMessage(
            c.env,
            engineeringStream,
            "Project Board",
            `🗑️ **Project item removed** from board`
          ).catch((err: unknown) => console.error(err)));
        }
        break;
      }

      case "push": {
        const p = payload as PushPayload;
        const ref = p.ref;
        const commits = p.commits;
        const repo = p.repository?.full_name || "unknown";
        const branch = ref?.replace("refs/heads/", "") || "unknown";
        const commitCount = commits?.length || 0;

        if (commitCount > 0) {
          const commitList = (commits || [])
            .slice(0, 5)
            .map((comm: GitHubCommit) => `• ${comm.message.split("\n")[0]} *(${comm.author?.name || 'unknown'})*`)
            .join("\n");

          c.executionCtx.waitUntil(sendZulipMessage(
            c.env,
            engineeringStream,
            `${repo}`,
            `⚡ **${commitCount} new commit${commitCount > 1 ? "s" : ""}** pushed to \`${branch}\`\n\n${commitList}${commitCount > 5 ? `\n...and ${commitCount - 5} more` : ""}`
          ).catch((err: unknown) => console.error(err)));
        }
        break;
      }

      case "pull_request": {
        const p = payload as PullRequestPayload;
        const action2 = p.action;
        const pr = p.pull_request;
        const repo2 = p.repository?.full_name || "unknown";

        if (["opened", "closed", "reopened"].includes(action2)) {
          const emoji = action2 === "opened" ? "🟢" : pr?.merged ? "🟣" : action2 === "closed" ? "🔴" : "🟡";
          const status = pr?.merged ? "merged" : action2;
          c.executionCtx.waitUntil(sendZulipMessage(
            c.env,
            engineeringStream,
            `${repo2}`,
            `${emoji} **PR ${status}**: [${pr?.title || "Untitled"}](${pr?.html_url || "#"}) by @${pr?.user?.login || "unknown"}`
          ).catch((err: unknown) => console.error(err)));
        }
        break;
      }

      case "issues": {
        const p = payload as IssuesPayload;
        const action3 = p.action;
        const issue = p.issue;
        const repo3 = p.repository?.full_name || "unknown";

        if (["opened", "closed", "reopened"].includes(action3)) {
          const emoji = action3 === "opened" ? "📝" : action3 === "closed" ? "✅" : "🔄";
          c.executionCtx.waitUntil(sendZulipMessage(
            c.env,
            engineeringStream,
            `${repo3}`,
            `${emoji} **Issue ${action3}**: [${issue?.title || "Untitled"}](${issue?.html_url || "#"}) by @${issue?.user?.login || "unknown"}`
          ).catch((err: unknown) => console.error(err)));
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
