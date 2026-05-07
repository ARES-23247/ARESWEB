import { typedHandler } from "../utils/handler";
import { OpenAPIHono } from "@hono/zod-openapi";

import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { siteConfig } from "../../utils/site.config";
import { AppEnv, getSocialConfig } from "../middleware";
import { sendZulipMessage } from "../../utils/zulipSync";
import { calculateIRV } from "../../utils/irvCalculator";
import { zulipWebhookRoute } from "../../../shared/routes/webhooks";



export const zulipWebhookRouter = new OpenAPIHono<AppEnv>();

// SEC-F01: Timing-safe comparison for webhook tokens (Length-Independent)
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBuf = enc.encode(a);
  const bBuf = enc.encode(b);

  const MAX_TOKEN_LENGTH = 128;

  let result = 0;
  for (let i = 0; i < MAX_TOKEN_LENGTH; i++) {
    const aByte = i < aBuf.length ? aBuf[i] : 0;
    const bByte = i < bBuf.length ? bBuf[i] : 0;
    result |= aByte ^ bByte;
  }
  return result === 0 && aBuf.length === bBuf.length;
}

// ── POST /webhooks/zulip — Handle outgoing webhook from Zulip ────────
zulipWebhookRouter.openapi(zulipWebhookRoute, typedHandler<typeof zulipWebhookRoute>(async (c) => {
  const body = c.req.valid("json");

  const config = await getSocialConfig(c);
  const expectedToken = config.ZULIP_WEBHOOK_TOKEN;
  if (!expectedToken) {
    return c.json({ content: "❌ Webhook token not configured on server." }, 401);
  }
  if (!timingSafeEqual(body.token, expectedToken)) {
    return c.json({ content: "❌ Unauthorized: Invalid webhook token." }, 401);
  }

  const rawContent = body.message?.content || "";
  const cleaned = rawContent.replace(/@\*\*[^*]+\*\*/g, "").trim();
  
  if (!cleaned) {
    return c.json({ content: "🤖 Hello! I am the ARES Bot. Type `!help` to see what I can do." }, 200);
  }

  const args = cleaned.match(/[^\s"']+|"([^"]*)"|'([^']*)'/g)?.map((arg: string) => 
    arg.replace(/^["']|["']$/g, "")
  ) || [];
  
  const command = args[0]?.toLowerCase();

  const PRIVILEGED_COMMANDS = ["!task", "!broadcast"];
  const db = c.get("db") as any;

  if (PRIVILEGED_COMMANDS.includes(command || "")) {
    const senderEmail = body.message?.sender_email;
    if (senderEmail) {
      const user = await db.selectFrom("user as u")
        .select("u.role")
        .where("u.email", "=", senderEmail)
        .where("u.role", "in", ["admin", "author"])
        .executeTakeFirst();
      if (!user) {
        return c.json({ content: `🔒 Permission denied. \`${command}\` requires admin or author privileges. Your Zulip email (${senderEmail}) is not linked to an authorized ARESWEB account.` }, 200);
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
            "| `!tasks` | List open tasks |",
            "| `!task <title>` | Create a new task |",
            "| `!task <#> done` | Mark a task as Done |",
            "| `!stats` | ARESWEB quick stats |",
            "| `!inquiries` | Pending inquiry count |",
            "| `!events` | Upcoming events |",
            "| `!broadcast <stream> <msg>` | Broadcast an admin msg |",
            "| `!rcv` | Ranked choice voting (type `!rcv` for help) |",
            "| `!help` | Show this help |",
          ].join("\n"),
        }, 200);

      case "!tasks": {
        const taskResults = await db.selectFrom("tasks")
          .leftJoin("user_profiles as ap", "tasks.assigned_to", "ap.user_id")
          .select(["tasks.id", "tasks.title", "tasks.status", "ap.nickname as assignee_name"])
          .where("tasks.status", "!=", "done")
          .orderBy("tasks.sort_order", "asc")
          .orderBy("tasks.created_at", "desc")
          .limit(15)
          .execute();

        if (taskResults.length === 0) {
          return c.json({ content: "📋 **Task Board** — No open tasks." }, 200);
        }
        const lines = taskResults.map((item: any, i: any) => {
          const status = item.status ? `\`${item.status}\`` : "—";
          const assignee = item.assignee_name ? `@${item.assignee_name}` : "";
          return `${i + 1}. **${item.title}** ${status} ${assignee}`;
        });

        const totalRes = await db.selectFrom("tasks")
          .select((eb: any) => eb.fn.count("id").as("count"))
          .executeTakeFirst() ;
        const total = Number(totalRes?.count || taskResults.length);

        return c.json({
          content: `📋 **Task Board** (${total} total)\n\n${lines.join("\n")}`,
        }, 200);
      }

      case "!task": {
        const taskArgs = args.slice(1);
        if (taskArgs.length === 0) {
          return c.json({ content: "Usage: `!task <title>` to create, or `!task <#> done` to complete." }, 200);
        }

        const indexArg = parseInt(taskArgs[0]);
        if (!isNaN(indexArg) && taskArgs[1]?.toLowerCase() === "done") {
          const openTasks = await db.selectFrom("tasks")
            .select(["id", "title"])
            .where("status", "!=", "done")
            .orderBy("sort_order", "asc")
            .orderBy("created_at", "desc")
            .limit(15)
            .execute();
          const target = openTasks[indexArg - 1];
          if (!target) return c.json({ content: `❌ No task at index ${indexArg}.` }, 200);

          await db.updateTable("tasks")
            .set({ status: "done", updated_at: new Date().toISOString() })
            .where("id", "=", target.id)
            .execute();

          return c.json({ content: `✅ **${target.title}** marked as Done!` }, 200);
        }

        const title = taskArgs.join(" ");
        const senderEmail = body.message?.sender_email;
        let creatorId = "system";
        if (senderEmail) {
          const senderUser = await db.selectFrom("user")
            .select("id")
            .where("email", "=", senderEmail)
            .executeTakeFirst();
          if (senderUser?.id) creatorId = senderUser.id;
        }

        const taskId = crypto.randomUUID();
        const now = new Date().toISOString();
        await db.insertInto("tasks")
          .values({
            id: taskId,
            title,
            description: `Created via Zulip by ${body.message.sender_full_name}`,
            status: "todo",
            priority: "normal",
            sort_order: 0,
            created_by: creatorId,
            created_at: now,
            updated_at: now,
          })
          .execute();

        return c.json({ content: `✅ Created task: **${title}**` }, 200);
      }

      case "!stats": {
        const [postsRes, eventsRes, usersRes, inquiriesRes] = await Promise.all([
          db.selectFrom("posts").select((eb: any) => eb.fn.count("slug").as("count")).where("is_deleted", "=", 0).where("status", "=", "published").executeTakeFirst() ,
          db.selectFrom("events").select((eb: any) => eb.fn.count("id").as("count")).where("is_deleted", "=", 0).where("status", "=", "published").executeTakeFirst() ,
          db.selectFrom("user_profiles").select((eb: any) => eb.fn.count("user_id").as("count")).executeTakeFirst() ,
          db.selectFrom("inquiries").select((eb: any) => eb.fn.count("id").as("count")).where("status", "=", "pending").executeTakeFirst() ,
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
        }, 200);
      }

      case "!inquiries": {
        const result = await db.selectFrom("inquiries")
          .select((eb: any) => eb.fn.count("id").as("count"))
          .where("status", "=", "pending")
          .executeTakeFirst() ;
        const count = Number(result?.count || 0);
        return c.json({
          content: count > 0
            ? `🔔 **${count} pending inquir${count === 1 ? "y" : "ies"}** — [Review in Dashboard](${siteConfig.urls.base}/dashboard?tab=inquiries)`
            : "✅ No pending inquiries! All caught up.",
        }, 200);
      }

      case "!events": {
        const results = await db.selectFrom("events")
          .select(["title", "date_start", "date_end", "location"])
          .where("is_deleted", "=", 0)
          .where("status", "=", "published")
          .where("date_start", ">=", new Date().toISOString().split('T')[0])
          .orderBy("date_start", "asc")
          .limit(10)
          .execute();

        if (!results || results.length === 0) {
          return c.json({ content: "📅 No upcoming events scheduled." }, 200);
        }

        const lines = results.map((e: any) => {
          const dtStart = new Date(String(e.date_start)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          const dtEnd = e.date_end ? ` - ${new Date(String(e.date_end)).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "";
          return `• **${e.title}** — ${dtStart}${dtEnd}${e.location ? ` @ ${e.location}` : ""}`;
        });

        return c.json({
          content: `📅 **Upcoming Events** (${results.length})\n\n${lines.join("\n")}`,
        }, 200);
      }

      case "!broadcast": {
        const streamTarget = args[1];
        const msgCore = args.slice(2).join(" ");
        if (!streamTarget || !msgCore) {
           return c.json({ content: "⚠️ Usage: `!broadcast <stream> <message...>` (use quotes for stream names with spaces)" }, 200);
        }
        
        const broadcastContent = `${msgCore}\n\n*— Broadcasted by ${body.message.sender_full_name} via ARES Bot*`;

        c.executionCtx.waitUntil((async () => {
          const socialConfig = await getSocialConfig(c);
          await sendZulipMessage(socialConfig, streamTarget, "Broadcast", broadcastContent).catch(() => {});
        })());

        return c.json({ content: `✅ Broadcast dispatched to \`${streamTarget}\`.` }, 200);
      }

      case "!rcv": {
        const rcvSubcommand = args[1]?.toLowerCase();
        
        if (!rcvSubcommand || rcvSubcommand === "help") {
          return c.json({
            content: [
              "🗳️ **Ranked Choice Voting (IRV)**",
              "",
              "| Command | Description |",
              "|---|---|",
              "| `!rcv create \"Title\" \"Opt 1\" \"Opt 2\"` | Create a poll (Admin) |",
              "| `!rcv vote <id> 2 1 3` | Rank options (1st=2, 2nd=1...) |",
              "| `!rcv status <id>` | View poll options & vote count |",
              "| `!rcv tally <id>` | Close poll & calculate winner (Admin) |",
            ].join("\n"),
          }, 200);
        }

        const senderEmail = body.message?.sender_email;

        // Helper to check admin
        const ensureAdmin = async () => {
          if (!senderEmail) return false;
          const user = await db.selectFrom("user as u")
            .select("u.role")
            .where("u.email", "=", senderEmail)
            .where("u.role", "in", ["admin", "author"])
            .executeTakeFirst();
          return !!user;
        };

        if (rcvSubcommand === "create") {
          if (!(await ensureAdmin())) {
            return c.json({ content: "🔒 Permission denied. `!rcv create` requires admin privileges." }, 200);
          }
          const title = args[2];
          const options = args.slice(3);
          if (!title || options.length < 2) {
             return c.json({ content: "⚠️ Usage: `!rcv create \"Title\" \"Option 1\" \"Option 2\" ...`" }, 200);
          }
          
          const pollId = Math.random().toString(36).slice(2, 6);
          const pollData = {
            title,
            options,
            votes: {} as Record<string, number[]>,
            active: true
          };

          await db.insertInto("settings")
            .values({ key: `rcv_poll_${pollId}`, value: JSON.stringify(pollData) })
            .execute();

          const optionsList = options.map((opt: string, i: number) => `${i + 1}️⃣ **${opt}**`).join("\n");
          return c.json({
            content: `📊 **Poll Created: ${title}** (ID: \`${pollId}\`)\n\n**Options:**\n${optionsList}\n\nTo vote, reply with: \`!rcv vote ${pollId} <1st_choice> <2nd_choice>...\`\nExample ranking option 2 first, then 1: \`!rcv vote ${pollId} 2 1\``
          }, 200);
        }

        const pollId = args[2];
        if (!pollId) {
          return c.json({ content: "⚠️ Please specify a poll ID." }, 200);
        }
        
        const pollRecord = await db.selectFrom("settings").select("value").where("key", "=", `rcv_poll_${pollId}`).executeTakeFirst();
        if (!pollRecord) {
          return c.json({ content: `❌ Poll \`${pollId}\` not found.` }, 200);
        }

        const poll = JSON.parse(pollRecord.value as string);

        if (rcvSubcommand === "status") {
          const optionsList = poll.options.map((opt: string, i: number) => `${i + 1}️⃣ **${opt}**`).join("\n");
          const voteCount = Object.keys(poll.votes).length;
          return c.json({
             content: `📊 **Poll: ${poll.title}** (ID: \`${pollId}\`) - ${poll.active ? "🟢 Active" : "🔴 Closed"}\n\n**Options:**\n${optionsList}\n\n**Total Votes:** ${voteCount}`
          }, 200);
        }

        if (rcvSubcommand === "vote") {
          if (!poll.active) {
            return c.json({ content: "❌ This poll is closed." }, 200);
          }
          if (!senderEmail) return c.json({ content: "❌ Could not identify voter." }, 200);
          
          const rankings = args.slice(3).map((n: string) => parseInt(n) - 1); // 0-indexed
          
          if (rankings.length === 0 || rankings.some((r: number) => isNaN(r) || r < 0 || r >= poll.options.length)) {
            return c.json({ content: `⚠️ Invalid ranking. Use numbers 1 to ${poll.options.length} separated by spaces.` }, 200);
          }

          if (new Set(rankings).size !== rankings.length) {
            return c.json({ content: "⚠️ Invalid ranking. Do not repeat options." }, 200);
          }

          poll.votes[senderEmail] = rankings;
          
          await db.updateTable("settings")
            .set({ value: JSON.stringify(poll), updated_at: new Date().toISOString() })
            .where("key", "=", `rcv_poll_${pollId}`)
            .execute();

          return c.json({ content: `✅ Your vote for \`${pollId}\` has been recorded! (You ranked ${rankings.length} option(s))` }, 200);
        }

        if (rcvSubcommand === "tally") {
           if (!(await ensureAdmin())) {
            return c.json({ content: "🔒 Permission denied. `!rcv tally` requires admin privileges." }, 200);
          }
          if (!poll.active) {
             return c.json({ content: "⚠️ This poll is already closed." }, 200);
          }

          poll.active = false;
          await db.updateTable("settings")
            .set({ value: JSON.stringify(poll), updated_at: new Date().toISOString() })
            .where("key", "=", `rcv_poll_${pollId}`)
            .execute();

          const ballots = Object.values(poll.votes) as number[][];
          if (ballots.length === 0) {
            return c.json({ content: `🔴 **Poll Closed: ${poll.title}**\nNo votes were cast.` }, 200);
          }

          const result = calculateIRV(poll.options.length, ballots);

          let resultMsg = `🔴 **Poll Closed: ${poll.title}**\n**Total Ballots:** ${ballots.length}\n\n`;
          
          for (const round of result.rounds) {
             resultMsg += `**Round ${round.roundNumber}:**\n`;
             for (const [cIdx, votes] of Object.entries(round.voteCounts)) {
                resultMsg += `- ${poll.options[parseInt(cIdx)]}: ${votes} votes\n`;
             }
             if (round.eliminatedCandidates.length > 0) {
                const elimNames = round.eliminatedCandidates.map((idx: number) => poll.options[idx]).join(", ");
                resultMsg += `❌ *Eliminated: ${elimNames}*\n`;
             }
             resultMsg += "\n";
          }

          if (result.winner !== undefined) {
             resultMsg += `🏆 **WINNER: ${poll.options[result.winner]}**!`;
          } else if (result.tied !== undefined) {
             const tiedNames = result.tied.map((idx: number) => poll.options[idx]).join(" and ");
             resultMsg += `🤝 **TIE between: ${tiedNames}**!`;
          }

          return c.json({ content: resultMsg }, 200);
        }

        return c.json({ content: "⚠️ Unknown `!rcv` subcommand." }, 200);
      }

      default:
        if (body.message?.type === "stream" && (body.message.topic || body.message.subject)) {
          const topicStr = body.message.topic || body.message.subject || "";
          const topicParts = topicStr.split("/");
          if (topicParts.length >= 2 && ["post", "event", "doc"].includes(topicParts[0])) {
            const targetType = topicParts[0];
            const targetId = topicParts.slice(1).join("/");

            const existingUser = await db.selectFrom("user")
              .select(["id", "role"])
              .where("email", "=", body.message.sender_email || "")
              .executeTakeFirst();

            if (!existingUser || existingUser.role === "unverified" || !existingUser.id) {
              return c.json({ content: "" }, 200);
            }

            const userId = existingUser.id;

            try {
              await db.insertInto("comments")
                .values({
                  target_type: targetType,
                  target_id: targetId,
                  user_id: userId ,
                  content: rawContent,
                  zulip_message_id: String(body.trigger === "message" ? body.message.id : 0),
                  created_at: new Date().toISOString()
                })
                .execute();
              return c.json({ content: "" }, 200);
            } catch {
              /* ignore sync error */
            }
          }
        }

        if (rawContent.includes("@**")) {
           return c.json({
             content: `❓ Unknown command: \`${command || "(empty)"}\`. Type \`!help\` for available commands.`,
           }, 200);
        }
        
        return c.json({ content: "" }, 200);
    }
  } catch (err) {
    return c.json({
      content: `❌ Command failed: ${(err as Error)?.message || "Unknown error"}`,
    }, 200);
  }
}));

export default zulipWebhookRouter;
