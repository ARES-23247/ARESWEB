import { Hono } from "hono";
import { Bindings, getSocialConfig } from "./_shared";
import { buildGitHubConfig, fetchProjectBoard, createProjectItem, fetchProjectFields, updateProjectItemStatus } from "../../utils/githubProjects";

const zulipWebhookRouter = new Hono<{ Bindings: Bindings }>();

interface ZulipOutgoingPayload {
  token: string;
  message: {
    sender_email: string;
    sender_full_name: string;
    content: string;
    display_recipient: string;
    subject: string;
    type: string;
  };
  trigger: string;
}

// ── POST /webhooks/zulip — Handle outgoing webhook from Zulip ────────
zulipWebhookRouter.post("/", async (c) => {
  let body: ZulipOutgoingPayload;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ content: "❌ Invalid request payload." });
  }

  // Validate webhook token
  const expectedToken = c.env.ZULIP_WEBHOOK_TOKEN;
  if (expectedToken && body.token !== expectedToken) {
    console.warn("[ZulipWebhook] Invalid token");
    return c.json({ content: "❌ Unauthorized: Invalid webhook token." });
  }

  const rawContent = body.message?.content || "";
  // Strip the bot mention prefix (e.g., "@**ARES Bot**")
  const cleaned = rawContent.replace(/@\*\*[^*]+\*\*/g, "").trim();
  const parts = cleaned.split(/\s+/);
  const command = parts[0]?.toLowerCase();

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
        const args = parts.slice(1);
        if (args.length === 0) {
          return c.json({ content: "Usage: `!task <title>` to create, or `!task <#> done` to complete." });
        }

        // Check if it's a completion command: "!task 3 done"
        const indexArg = parseInt(args[0]);
        if (!isNaN(indexArg) && args[1]?.toLowerCase() === "done") {
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
        const title = args.join(" ");
        const config = await getSocialConfig(c);
        const ghConfig = buildGitHubConfig(config);
        if (!ghConfig) return c.json({ content: "⚠️ GitHub Projects not configured." });

        const itemId = await createProjectItem(ghConfig, title, `Created via Zulip by ${body.message.sender_full_name}`);
        return c.json({ content: `✅ Created task: **${title}**\nItem ID: \`${itemId}\`` });
      }

      case "!stats": {
        const [postsRes, eventsRes, usersRes, inquiriesRes] = await Promise.all([
          c.env.DB.prepare("SELECT COUNT(*) as count FROM posts WHERE is_deleted = 0 AND status = 'published'").first<{ count: number }>(),
          c.env.DB.prepare("SELECT COUNT(*) as count FROM events WHERE is_deleted = 0 AND status = 'published'").first<{ count: number }>(),
          c.env.DB.prepare("SELECT COUNT(*) as count FROM user_profiles").first<{ count: number }>(),
          c.env.DB.prepare("SELECT COUNT(*) as count FROM inquiries WHERE status = 'pending'").first<{ count: number }>(),
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
        const result = await c.env.DB.prepare(
          "SELECT COUNT(*) as count FROM inquiries WHERE status = 'pending'"
        ).first<{ count: number }>();
        const count = result?.count || 0;
        return c.json({
          content: count > 0
            ? `🔔 **${count} pending inquir${count === 1 ? "y" : "ies"}** — [Review in Dashboard](https://aresfirst.org/dashboard?tab=inquiries)`
            : "✅ No pending inquiries! All caught up.",
        });
      }

      case "!events": {
        const { results } = await c.env.DB.prepare(
          "SELECT title, date_start, location FROM events WHERE is_deleted = 0 AND status = 'published' AND date_start >= date('now') ORDER BY date_start ASC LIMIT 10"
        ).all();

        if (!results || results.length === 0) {
          return c.json({ content: "📅 No upcoming events scheduled." });
        }

        const lines = results.map((e: Record<string, unknown>) => {
          const dt = new Date(String(e.date_start)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          return `• **${e.title}** — ${dt}${e.location ? ` @ ${e.location}` : ""}`;
        });

        return c.json({
          content: `📅 **Upcoming Events** (${results.length})\n\n${lines.join("\n")}`,
        });
      }

      case "!broadcast": {
        const streamTarget = parts[1];
        const msgCore = parts.slice(2).join(" ");
        if (!streamTarget || !msgCore) {
           return c.json({ content: "⚠️ Usage: `!broadcast <stream> <message...>`" });
        }
        
        // Dynamic import to prevent circular dependency problems if they exist, or just use sendZulipMessage if imported.
        // Actually we can simply use the identical fetch logic since we already have c.env credentials right here.
        const authHeader = "Basic " + btoa(`${c.env.ZULIP_BOT_EMAIL}:${c.env.ZULIP_API_KEY}`);
        const url = `${c.env.ZULIP_URL || "https://ares.zulipchat.com"}/api/v1/messages`;
        
        const content = `${msgCore}\n\n*— Broadcasted by ${body.message.sender_full_name} via ARES Bot*`;
        const formData = new URLSearchParams();
        formData.append("type", "stream");
        formData.append("to", streamTarget);
        formData.append("topic", "Broadcast");
        formData.append("content", content);

        c.executionCtx.waitUntil(
          fetch(url, {
            method: "POST",
            headers: {
              "Authorization": authHeader,
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: formData.toString()
          }).catch(err => console.error("[ZulipBroadcast] Error:", err))
        );

        return c.json({ content: `✅ Broadcast dispatched to \`${streamTarget}\`.` });
      }

      default:
        // ── Phase 1: Bi-directional Comments Sync ──
        // Only process stream messages that are not meant as commands
        if (body.message?.type === "stream" && body.message?.topic) {
          const topicParts = body.message.topic.split("/");
          if (topicParts.length >= 2 && ["post", "event", "doc"].includes(topicParts[0])) {
            const targetType = topicParts[0];
            const targetId = topicParts.slice(1).join("/");

            let userId: string;
            const existingUser = await c.env.DB.prepare(
              "SELECT id FROM user WHERE email = ? AND is_deleted = 0"
            ).bind(body.message.sender_email).first<{ id: string }>();

            if (existingUser) {
              userId = existingUser.id;
            } else {
              userId = "zulip-shadow";
            }

            try {
              await c.env.DB.prepare(
                `INSERT INTO comments (target_type, target_id, user_id, content, zulip_message_id, zulip_sender_id) 
                 VALUES (?, ?, ?, ?, ?, ?)`
              ).bind(
                targetType, 
                targetId, 
                userId, 
                rawContent, 
                String(body.trigger === "message" ? (body as Record<string, unknown>).message_id || "0" : "0"), 
                body.message.sender_email // Storing email as sender_id for easier matching
              ).run();
              return c.json({ content: "" }); // empty response to not trigger bot reply
            } catch (err) {
              console.error("[ZulipWebhook] Sync Error:", err);
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
    console.error("[ZulipWebhook] Command error:", err);
    return c.json({
      content: `❌ Command failed: ${(err as Error)?.message || "Unknown error"}`,
    });
  }
});

export default zulipWebhookRouter;
