import { Hono } from "hono";
import { AppEnv  } from "./_shared";
import { sendZulipMessage } from "../../utils/zulipSync";

const githubWebhookRouter = new Hono<AppEnv>();

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
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
    const computed = "sha256=" + Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    return computed === signature;
  } catch {
    return false;
  }
}

// ── POST /webhooks/github — Receive GitHub webhook events ────────────
githubWebhookRouter.post("/", async (c) => {
  const secret = c.env.GITHUB_WEBHOOK_SECRET;
  const rawBody = await c.req.text();

  // SEC-02: Fail-closed — reject all requests if secret is not configured
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
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const engineeringStream = "engineering";

  try {
    switch (event) {
      case "projects_v2_item": {
        const action = payload.action as string;
        const item = payload.projects_v2_item as { node_id?: string; content_node_id?: string } | undefined;
        const changes = payload.changes as Record<string, { from?: unknown; to?: unknown }> | undefined;

        if (action === "created") {
          await sendZulipMessage(
            c.env,
            engineeringStream,
            "Project Board",
            `📋 **New project item created**\nItem ID: \`${item?.node_id || "unknown"}\``
          );
        } else if (action === "edited" && changes) {
          // Check if status field changed
          const fieldChanges = Object.entries(changes)
            .map(([key, val]) => `**${key}**: \`${String(val.from)}\` → \`${String(val.to)}\``)
            .join("\n");

          if (fieldChanges) {
            await sendZulipMessage(
              c.env,
              engineeringStream,
              "Project Board",
              `🔄 **Project item updated**\nItem: \`${item?.node_id || "unknown"}\`\n${fieldChanges}`
            );
          }
        } else if (action === "deleted") {
          await sendZulipMessage(
            c.env,
            engineeringStream,
            "Project Board",
            `🗑️ **Project item removed** from board`
          );
        }
        break;
      }

      case "push": {
        const ref = payload.ref as string;
        const commits = payload.commits as { message: string; author: { name: string } }[] | undefined;
        const repo = (payload.repository as { full_name?: string })?.full_name || "unknown";
        const branch = ref?.replace("refs/heads/", "") || "unknown";
        const commitCount = commits?.length || 0;

        if (commitCount > 0) {
          const commitList = (commits || [])
            .slice(0, 5)
            .map(c => `• ${c.message.split("\n")[0]} *(${c.author.name})*`)
            .join("\n");

          await sendZulipMessage(
            c.env,
            engineeringStream,
            `${repo}`,
            `⚡ **${commitCount} new commit${commitCount > 1 ? "s" : ""}** pushed to \`${branch}\`\n\n${commitList}${commitCount > 5 ? `\n...and ${commitCount - 5} more` : ""}`
          );
        }
        break;
      }

      case "pull_request": {
        const action2 = payload.action as string;
        const pr = payload.pull_request as { title?: string; html_url?: string; user?: { login?: string }; merged?: boolean } | undefined;
        const repo2 = (payload.repository as { full_name?: string })?.full_name || "unknown";

        if (["opened", "closed", "reopened"].includes(action2)) {
          const emoji = action2 === "opened" ? "🟢" : pr?.merged ? "🟣" : action2 === "closed" ? "🔴" : "🟡";
          const status = pr?.merged ? "merged" : action2;
          await sendZulipMessage(
            c.env,
            engineeringStream,
            `${repo2}`,
            `${emoji} **PR ${status}**: [${pr?.title || "Untitled"}](${pr?.html_url || "#"}) by @${pr?.user?.login || "unknown"}`
          );
        }
        break;
      }

      case "issues": {
        const action3 = payload.action as string;
        const issue = payload.issue as { title?: string; html_url?: string; user?: { login?: string } } | undefined;
        const repo3 = (payload.repository as { full_name?: string })?.full_name || "unknown";

        if (["opened", "closed", "reopened"].includes(action3)) {
          const emoji = action3 === "opened" ? "📝" : action3 === "closed" ? "✅" : "🔄";
          await sendZulipMessage(
            c.env,
            engineeringStream,
            `${repo3}`,
            `${emoji} **Issue ${action3}**: [${issue?.title || "Untitled"}](${issue?.html_url || "#"}) by @${issue?.user?.login || "unknown"}`
          );
        }
        break;
      }

      default:
        console.log(`[GitHubWebhook] Unhandled event: ${event}`);
    }
  } catch (err) {
    console.error("[GitHubWebhook] Error processing event:", err);
  }

  return c.json({ received: true, event });
});

export default githubWebhookRouter;
