import { Hono } from "hono";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { siteConfig } from "../../utils/site.config";
import { AppEnv, getSocialConfig } from "../middleware";
import { sendZulipMessage } from "../../utils/zulipSync";
import { buildGitHubConfig, fetchProjectBoard, createProjectItem, fetchProjectFields, updateProjectItemStatus } from "../../utils/githubProjects";

export const zulipWebhookRouter = new Hono<AppEnv>();

interface ZulipOutgoingPayload {
  token: string;
  message: {
    sender_email: string;
    sender_full_name: string;
    content: string;
    display_recipient: string;
    subject: string;
    topic?: string;
    type: string;
  };
  trigger: string;
}

// SEC-F01: Timing-safe comparison for webhook tokens (Length-Independent)
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBuf = enc.encode(a);
  const bBuf = enc.encode(b);
  
  if (aBuf.length !== bBuf.length) {
    // If lengths differ, compare aBuf against itself to consume time
    // but ensure we return false at the end.
    let _result = 0;
    for (let i = 0; i < aBuf.length; i++) {
      _result |= aBuf[i] ^ aBuf[i];
    }
    return false;
  }

  let result = 0;
  for (let i = 0; i < aBuf.length; i++) {
    result |= aBuf[i] ^ bBuf[i];
  }
  return result === 0;
}

// ── POST /webhooks/zulip — Handle outgoing webhook from Zulip ────────
// ── POST /webhooks/zulip — Handle outgoing webhook from Zulip ────────
zulipWebhookRouter.post("/", async (c) => {
  let body: ZulipOutgoingPayload;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ content: "❌ Invalid request payload." });
  }

  const config = await getSocialConfig(c);
  const expectedToken = config.ZULIP_WEBHOOK_TOKEN;
  if (!expectedToken) {
    console.error("[ZulipWebhook] ZULIP_WEBHOOK_TOKEN is not configured.");
    return c.json({ content: "❌ Webhook token not configured on server." }, 401);
  }
  if (!timingSafeEqual(body.token, expectedToken)) {
    console.warn("[ZulipWebhook] Invalid token");
    return c.json({ content: "❌ Unauthorized: Invalid webhook token." }, 401);
  }

  const rawContent = body.message?.content || "";
  // Strip the bot mention prefix
  const cleaned = rawContent.replace(/@\*\*[^*]+\*\*/g, "").trim();
  
  if (!cleaned) {
    return c.json({ content: "🤖 Hello! I am the ARES Bot. Type `!help` to see what I can do." });
  }

  // FUN-F01: Use regex to handle quoted arguments (supporting spaces in stream names)
  // e.g. !broadcast "Engineering Team" Hello world
  const args = cleaned.match(/[^\s"']+|"([^"]*)"|'([^']*)'/g)?.map(arg => 
    arg.replace(/^["']|["']$/g, "")
  ) || [];
  
  const command = args[0]?.toLowerCase();

  // SEC-05: Authorize destructive commands by checking sender role in DB
  const PRIVILEGED_COMMANDS = ["!task", "!broadcast"];
  const db = c.get("db") as Kysely<DB>;

  if (PRIVILEGED_COMMANDS.includes(command || "")) {
    const senderEmail = body.message?.sender_email;
    if (senderEmail) {
      const user = await db.selectFrom("user as u")
        .select("u.role")
        .where("u.email", "=", senderEmail)
        .where("u.role", "in", ["admin", "author"])
        .executeTakeFirst();
      if (!user) {
        return c.json({ content: `🔒 Permission denied. \`${command}\` requires admin or author privileges. Your Zulip email (${senderEmail}) is not linked to an authorized ARESWEB account.` });
      }
    }
  }

  try {
    switch (command) {
      case "!help":
        return c.json({
          content: [
            "🤖 **ARES Bot Commands**",
            "",
            "| Command | Description |",
            "|---|---|",
            "| `!tasks` | List open GitHub Project items |",
            "| `!task <title>` | Create a new draft task |",
            "| `!task <index> done` | Mark a task as Done |",
            "| `!stats` | ARESWEB quick stats |",
            "| `!inquiries` | Pending inquiry count |",
            "| `!events` | Upcoming events |",
            "| `!broadcast <stream> <msg>` | Broadcast an admin msg |",
            "| `!help` | Show this help |",
          ].join("\n"),
        });

      case "!tasks": {
        const config = await getSocialConfig(c);
        const ghConfig = buildGitHubConfig(config);
        if (!ghConfig) {
          return c.json({ content: "⚠️ GitHub Projects not configured. Add `GITHUB_PAT` and `GITHUB_PROJECT_ID` in ARESWEB Integrations." });
        }
        const board = await fetchProjectBoard(ghConfig);
        if (board.items.length === 0) {
          return c.json({ content: `📋 **${board.title}** — No items found.` });
        }
        const lines = board.items.slice(0, 15).map((item, i) => {
          const status = item.status ? `\`${item.status}\`` : "—";
          const assignee = item.assignees.length > 0 ? `@${item.assignees[0]}` : "";
          return `${i + 1}. **${item.title}** ${status} ${assignee}`;
        });
        return c.json({
          content: `📋 **${board.title}** (${board.totalCount} total)\n\n${lines.join("\n")}`,
        });
      }

      case "!task": {
        const taskArgs = args.slice(1);
        if (taskArgs.length === 0) {
          return c.json({ content: "Usage: `!task <title>` to create, or `!task <#> done` to complete." });
        }

        // Check if it's a completion command: "!task 3 done"
        const indexArg = parseInt(taskArgs[0]);
        if (!isNaN(indexArg) && taskArgs[1]?.toLowerCase() === "done") {
          const config = await getSocialConfig(c);
          const ghConfig = buildGitHubConfig(config);
          if (!ghConfig) return c.json({ content: "⚠️ GitHub Projects not configured." });

          const board = await fetchProjectBoard(ghConfig);
          const target = board.items[indexArg - 1];
          if (!target) return c.json({ content: `❌ No task at index ${indexArg}.` });

          // Find the "Status" field and "Done" option
          const fields = await fetchProjectFields(ghConfig);
          const statusField = fields.find(f => f.name === "Status" && f.options);
          const doneOption = statusField?.options?.find(o => o.name.toLowerCase().includes("done"));

          if (!statusField || !doneOption) {
            return c.json({ content: "⚠️ Could not find 'Status' field or 'Done' option on the project board." });
          }

          await updateProjectItemStatus(ghConfig, target.id, statusField.id, doneOption.id);
          return c.json({ content: `✅ **${target.title}** marked as Done!` });
        }

        // Otherwise, create a new task
        const title = taskArgs.join(" ");
        const config = await getSocialConfig(c);
        const ghConfig = buildGitHubConfig(config);
        if (!ghConfig) return c.json({ content: "⚠️ GitHub Projects not configured." });

        const itemId = await createProjectItem(ghConfig, title, `Created via Zulip by ${body.message.sender_full_name}`);
        return c.json({ content: `✅ Created task: **${title}**\nItem ID: \`${itemId}\`` });
      }

      case "!stats": {
        const [postsRes, eventsRes, usersRes, inquiriesRes] = await Promise.all([
          db.selectFrom("posts").select(eb => eb.fn.count("slug").as("count")).where("is_deleted", "=", 0).where("status", "=", "published").executeTakeFirst(),
          db.selectFrom("events").select(eb => eb.fn.count("id").as("count")).where("is_deleted", "=", 0).where("status", "=", "published").executeTakeFirst(),
          db.selectFrom("user_profiles").select(eb => eb.fn.count("user_id").as("count")).executeTakeFirst(),
          db.selectFrom("inquiries").select(eb => eb.fn.count("id").as("count")).where("status", "=", "pending").executeTakeFirst(),
        ]);

        return c.json({
          content: [
            "📊 **ARESWEB Quick Stats**",
            "",
            `| Metric | Count |`,
            `|---|---|`,
            `| Published Posts | ${postsRes?.count || 0} |`,
            `| Active Events | ${eventsRes?.count || 0} |`,
            `| Team Members | ${usersRes?.count || 0} |`,
            `| Pending Inquiries | ${inquiriesRes?.count || 0} |`,
          ].join("\n"),
        });
      }

      case "!inquiries": {
        const result = await db.selectFrom("inquiries")
          .select(eb => eb.fn.count("id").as("count"))
          .where("status", "=", "pending")
          .executeTakeFirst();
        const count = Number(result?.count || 0);
        return c.json({
          content: count > 0
            ? `🔔 **${count} pending inquir${count === 1 ? "y" : "ies"}** — [Review in Dashboard](${siteConfig.urls.base}/dashboard?tab=inquiries)`
            : "✅ No pending inquiries! All caught up.",
        });
      }

      case "!events": {
        const results = await db.selectFrom("events")
          .select(["title", "date_start", "location"])
          .where("is_deleted", "=", 0)
          .where("status", "=", "published")
          .where("date_start", ">=", new Date().toISOString().split('T')[0])
          .orderBy("date_start", "asc")
          .limit(10)
          .execute();

        if (!results || results.length === 0) {
          return c.json({ content: "📅 No upcoming events scheduled." });
        }

        const lines = results.map((e) => {
          const dt = new Date(String(e.date_start)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          return `• **${e.title}** — ${dt}${e.location ? ` @ ${e.location}` : ""}`;
        });

        return c.json({
          content: `📅 **Upcoming Events** (${results.length})\n\n${lines.join("\n")}`,
        });
      }

      case "!broadcast": {
        const streamTarget = args[1];
        const msgCore = args.slice(2).join(" ");
        if (!streamTarget || !msgCore) {
           return c.json({ content: "⚠️ Usage: `!broadcast <stream> <message...>` (use quotes for stream names with spaces)" });
        }
        
        const broadcastContent = `${msgCore}\n\n*— Broadcasted by ${body.message.sender_full_name} via ARES Bot*`;

        c.executionCtx.waitUntil((async () => {
          const socialConfig = await getSocialConfig(c);
          await sendZulipMessage(socialConfig, streamTarget, "Broadcast", broadcastContent).catch(() => {});
        })());

        return c.json({ content: `✅ Broadcast dispatched to \`${streamTarget}\`.` });
      }

      default:
        // ── Phase 1: Bi-directional Comments Sync ──
        // Only process stream messages that are not meant as commands
        if (body.message?.type === "stream" && (body.message.topic || body.message.subject)) {
          const topicStr = body.message.topic || body.message.subject;
          const topicParts = topicStr.split("/");
          if (topicParts.length >= 2 && ["post", "event", "doc"].includes(topicParts[0])) {
            const targetType = topicParts[0];
            const targetId = topicParts.slice(1).join("/");

            let userId: string;
            const existingUser = await db.selectFrom("user")
              .select("id")
              .where("email", "=", body.message.sender_email)
              .executeTakeFirst();

            if (existingUser) {
              userId = existingUser.id as string;
            } else {
              userId = "zulip-shadow";
            }

            try {
              await db.insertInto("comments")
                .values({
                  target_type: targetType,
                  target_id: targetId,
                  user_id: userId,
                  content: rawContent,
                  zulip_message_id: String(body.trigger === "message" ? (body as any).message_id || 0 : 0),
                  zulip_sender_id: 0, // Placeholder for shadow user or resolve to number if possible
                  created_at: new Date().toISOString()
                })
                .execute();
              return c.json({ content: "" });
            } catch {
              /* ignore sync error */
            }
          }
        }

        // If it was a deliberate ping that wasn't a comment sync context, reply with help
        if (rawContent.includes("@**")) {
           return c.json({
             content: `❓ Unknown command: \`${command || "(empty)"}\`. Type \`!help\` for available commands.`,
           });
        }
        
        return c.json({ content: "" });
    }
  } catch (err) {
    return c.json({
      content: `❌ Command failed: ${(err as Error)?.message || "Unknown error"}`,
    });
  }
});

export default zulipWebhookRouter;
