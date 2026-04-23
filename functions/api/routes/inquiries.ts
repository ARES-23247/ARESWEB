import { Hono } from "hono";
import { siteConfig } from "../../utils/site.config";
import { AppEnv, MAX_INPUT_LENGTHS, getSocialConfig, parsePagination, getSessionUser, ensureAuth, logAuditAction, rateLimitMiddleware, turnstileMiddleware } from "../middleware";
import { sendZulipAlert } from "../../utils/zulipSync";
import { notifyByRole, NotifyAudience } from "../../utils/notifications";
import { buildGitHubConfig, createProjectItem } from "../../utils/githubProjects";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";


const inquiriesRouter = new Hono<AppEnv>();
const adminInquiriesRouter = new Hono<AppEnv>();

// ── GET / — list all inquiries (verified users) ──────────────────────────
inquiriesRouter.get("/", ensureAuth, async (c) => {
  try {
    const { limit, offset } = parsePagination(c, 50, 200);
    const user = await getSessionUser(c);
    
    // Check if user is verified
    if (!user || user.role === "unverified") {
      return c.json({ error: "Unauthorized" }, 403);
    }
    
    let filterClause = "";
    let maskPII = false;
    
    // EFF-05: Use member_type already fetched by getSessionUser
    if (user.role !== "admin") {
       const memberType = user.member_type || "student";
       
       if (memberType === "student") {
         // Students only see outreach/support and PII is masked
         filterClause = "WHERE type IN ('outreach', 'support')";
         maskPII = true;
       } else if (memberType !== "coach" && memberType !== "mentor") {
         return c.json({ error: "Unauthorized" }, 403);
       }
    }

    // PII-D01: Mask email/phone for unauthorized roles
    const nameSelect = maskPII ? "SUBSTR(name, 1, 1) || '***' as name" : "name";
    const emailSelect = maskPII ? "'***@***.***' as email" : "email";

    const query = filterClause 
      ? `SELECT id, type, ${nameSelect}, ${emailSelect}, metadata, status, created_at FROM inquiries ${filterClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      : `SELECT id, type, name, email, metadata, status, created_at FROM inquiries ORDER BY created_at DESC LIMIT ? OFFSET ?`;

    const { results } = await c.env.DB.prepare(query).bind(limit, offset).all();
    
    // PII-M01: Whitelist-based metadata masking
    const METADATA_WHITELIST = ['level', 'org', 'message', 'event_type', 'date', 'topic', 'position', 'subteam'];
    
    const sanitizedResults = maskPII ? (results || []).map((r: unknown) => {
      const row = r as Record<string, unknown>;
      if (typeof row.metadata === "string") {
        try {
          const meta = JSON.parse(row.metadata) as Record<string, unknown>;
          const cleanMeta: Record<string, unknown> = {};
          
          // Only allow whitelisted keys
          for (const key of METADATA_WHITELIST) {
            if (key in meta) cleanMeta[key] = meta[key];
          }
          
          row.metadata = JSON.stringify(cleanMeta);
        } catch { /* ignore */ }
      }
      return row;
    }) : results;

    return c.json({ inquiries: sanitizedResults });
  } catch (err) {
    console.error("D1 inquiry list error:", err);
    return c.json({ inquiries: [] }, 500);
  }
});

// ── POST /inquiries — Submit a new inquiry ─────────────────────────────
const inquirySchema = z.object({
  type: z.enum(["sponsor", "student", "mentor", "outreach", "support"]),
  name: z.string().min(1).max(MAX_INPUT_LENGTHS.name),
  email: z.string().email().max(MAX_INPUT_LENGTHS.email),
  metadata: z.record(z.string(), z.unknown()).optional(),
  turnstileToken: z.string().optional()
});

inquiriesRouter.post(
  "/",
  rateLimitMiddleware(5, 60),
  turnstileMiddleware(),
  zValidator("json", inquirySchema),
  async (c) => {
    const { type, name, email, metadata } = c.req.valid("json");

    // SEC-07: Simple time-based cooldown — prevent rapid-fire spam from same email
    const recentSubmission = await c.env.DB.prepare(
      "SELECT id FROM inquiries WHERE email = ? AND created_at > datetime('now', '-2 minutes') LIMIT 1"
    ).bind(email).first();
    if (recentSubmission) {
      return c.json({ error: "Please wait a few minutes before submitting another inquiry." }, 429);
    }

    const id = crypto.randomUUID();
    const batchRequests = [];

    // 1. Core Inquiry Insertion
    batchRequests.push(
      c.env.DB.prepare(
        "INSERT INTO inquiries (id, type, name, email, metadata) VALUES (?, ?, ?, ?, ?)"
      ).bind(id, type, name, email, metadata ? JSON.stringify(metadata) : null)
    );

    // 2. Auto-create a pending sponsor record (Batched)
    if (type === "sponsor") {
      let tierStr = "Pending";
      if (metadata && typeof metadata.level === "string") {
        tierStr = metadata.level.replace(" Tier Sponsor", "");
      }
      batchRequests.push(
        c.env.DB.prepare(
          "INSERT INTO sponsors (id, name, tier, logo_url, website_url, is_active) VALUES (?, ?, ?, ?, ?, 0)"
        ).bind(id, name, tierStr, null, null)
      );
    }

    // EFF-01: Use DB.batch() for atomic/consolidated writes
    await c.env.DB.batch(batchRequests);

    const baseUrl = new URL(c.req.url).origin;

    // Webhook or Email Notification
    try {
      const social = await getSocialConfig(c);
      // PII-03: Redact personal information from external webhook notifications
      const msg = `🔔 *New ${type.toUpperCase()} Inquiry* (ID: ${id.slice(0, 8)})\n*Review:* ${baseUrl}/dashboard?tab=inquiries`;
      
      let notified = false;

      // 1. Discord
      if (social.DISCORD_WEBHOOK_URL) {
        c.executionCtx.waitUntil(
          fetch(social.DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: msg })
          }).catch(console.error)
        );
        notified = true;
      }

      // 2. Slack
      if (social.SLACK_WEBHOOK_URL) {
        c.executionCtx.waitUntil(
          fetch(social.SLACK_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: msg })
          }).catch(console.error)
        );
        notified = true;
      }
      
      // 3. Teams
      if (social.TEAMS_WEBHOOK_URL) {
        c.executionCtx.waitUntil(
          fetch(social.TEAMS_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: msg })
          }).catch(console.error)
        );
        notified = true;
      }

      // Fallback to Cloudflare's free MailChannels if no webhooks are configured
      if (!notified) {
         c.executionCtx.waitUntil(
            fetch("https://api.mailchannels.net/tx/v1/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                personalizations: [{ to: [{ email: siteConfig.contact.email, name: `${siteConfig.team.name} Admissions` }] }],
                from: { email: `noreply@${new URL(baseUrl).hostname}`, name: `${siteConfig.team.name} Website Portal` },
                subject: `New ${type.toUpperCase()} Inquiry Submission`,
                content: [{ type: "text/plain", value: `You received a new ${type} inquiry (ID: ${id}).\nPlease review it in the Dashboard: ${baseUrl}/dashboard?tab=inquiries` }]
              })
            }).catch(console.error)
         );
      }

    } catch { /* ignore webhook error */ }

    // ── Zulip Admin Alert ──
    try {
      const metadataObj = metadata as Record<string, unknown> | undefined;
      const phoneStr = metadataObj?.phone ? `\n📱 **Phone:** (Masked)` : "";
      
      const alertBody = [
        `📧 **Contact:** (see Dashboard for details)${phoneStr}`,
        `🔗 [Review in Dashboard](${baseUrl}/dashboard?tab=inquiries)`,
      ].filter(Boolean).join("\n");

      c.executionCtx.waitUntil(
        sendZulipAlert(
          c.env,
          type === "sponsor" ? "Sponsor" : (type === "student" || type === "mentor") ? "Applicant" : "Outreach",
          `New ${type} inquiry received (ID: ${id.slice(0, 8)})`,
          alertBody
        ).catch(err => console.error("[Inquiry] Zulip alert failed:", err))
      );
    } catch { /* ignore Zulip error */ }
 
    // ── In-App Dashboard Notification ──
    try {
      const audiences: NotifyAudience[] = 
        (type === "outreach" || type === "support") 
          ? ["admin", "coach", "mentor", "student"]
          : ["admin", "coach", "mentor"];
          
      c.executionCtx.waitUntil(
        notifyByRole(c, audiences, {
          title: `New ${type.toUpperCase()} Inquiry`,
          message: `${name} submitted a new inquiry.`,
          link: "/dashboard?tab=inquiries",
          priority: type === "sponsor" ? "high" : "medium"
        }).catch(err => console.error("[Inquiry] In-App notification failed:", err))
      );
    } catch { /* ignore in-app error */ }


    // ── GitHub Auto-Escalation ──
    try {
      const social = await getSocialConfig(c);
      const ghConfig = buildGitHubConfig(social as Record<string, string>);
      if (ghConfig) {
         // PII-S03: Redact personal information from GitHub task body
         const redactedMeta = { ...(metadata as Record<string, unknown>) };
         if (redactedMeta.email) redactedMeta.email = "***@***.***";
         if (redactedMeta.phone) redactedMeta.phone = "***-***-****";
         
         const markdownBody = `**Details:**\n\`\`\`json\n${JSON.stringify(redactedMeta, null, 2)}\n\`\`\``;
         c.executionCtx.waitUntil(
           createProjectItem(ghConfig, `[${type.toUpperCase()}] New Inquiry (ID: ${id.slice(0, 8)})`, markdownBody)
             .catch((err: unknown) => console.error("[Inquiry] GitHub task creation failed:", err))
         );
      }
    } catch { /* ignore GitHub Error */ }

    return c.json({ success: true, id });
  }
);

// ── PATCH /:id/status — update status (authorized) ──────────────────────────────────
const statusSchema = z.object({
  status: z.enum(["pending", "approved", "resolved", "rejected"])
});

inquiriesRouter.patch("/:id/status", ensureAuth, zValidator("json", statusSchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user || user.role === "unverified") return c.json({ error: "Unauthorized" }, 403);
  
  if (user.role !== "admin") {
    const memberType = user.member_type || "student";
    if (memberType !== "coach" && memberType !== "mentor") {
      return c.json({ error: "Unauthorized" }, 403);
    }
  }

  const id = (c.req.param("id") || "");
  const { status } = c.req.valid("json");

  await c.env.DB.prepare(
    "UPDATE inquiries SET status = ? WHERE id = ?"
  ).bind(status, id).run();

  await logAuditAction(c, "inquiry_status_change", "inquiries", id, `Status changed to ${status}`);
  return c.json({ success: true });
});

// ── DELETE /:id — delete inquiry (authorized) ────────────────────────────────────────
inquiriesRouter.delete("/:id", ensureAuth, async (c) => {
  const user = await getSessionUser(c);
  if (!user || user.role === "unverified") return c.json({ error: "Unauthorized" }, 403);
  
  if (user.role !== "admin") {
    const memberType = user.member_type || "student";
    if (memberType !== "coach" && memberType !== "mentor") {
      return c.json({ error: "Unauthorized" }, 403);
    }
  }

  const id = (c.req.param("id") || "");
  await c.env.DB.prepare("DELETE FROM inquiries WHERE id = ?").bind(id).run();
  await logAuditAction(c, "inquiry_deleted", "inquiries", id, "Inquiry permanently deleted");
  return c.json({ success: true });
});

export async function purgeOldInquiries(db: D1Database, days: number) {
  if (days <= 0) return { deleted: 0 };
  
  // Deletes inquiries where status is 'resolved' or 'rejected' and created_at is older than X days
  const { meta } = await db.prepare(
    `DELETE FROM inquiries 
     WHERE (status = 'resolved' OR status = 'rejected') 
     AND created_at < datetime('now', '-' || ? || ' days')`
  ).bind(days).run();
  
  return { deleted: meta.changes };
}

export { inquiriesRouter, adminInquiriesRouter };
