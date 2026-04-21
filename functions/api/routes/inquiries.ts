import { Hono } from "hono";
import { Bindings, MAX_INPUT_LENGTHS, validateLength, getSocialConfig } from "./_shared";
import { sendZulipAlert } from "../../utils/zulipSync";
import { buildGitHubConfig, createProjectItem } from "../../utils/githubProjects";

const inquiriesRouter = new Hono<{ Bindings: Bindings }>();

// ── GET /admin/inquiries — List all inquiries ──────────────────────────
inquiriesRouter.get("/admin/inquiries", async (c) => {
  try {
    const limit = Math.min(Number(c.req.query("limit") || "50"), 200);
    const offset = Number(c.req.query("offset") || "0");
    const { results } = await c.env.DB.prepare(
      "SELECT id, type, name, email, metadata, status, created_at FROM inquiries ORDER BY created_at DESC LIMIT ? OFFSET ?"
    ).bind(limit, offset).all();
    return c.json({ inquiries: results });
  } catch (err) {
    console.error("D1 inquiry list error:", err);
    return c.json({ inquiries: [] }, 500);
  }
});

// ── POST /inquiries — Submit a new inquiry ─────────────────────────────
inquiriesRouter.post("/inquiries", async (c) => {
  try {
    const body = await c.req.json();
    const { type, name, email, metadata } = body;

    if (!type || !name || !email) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    // SEC-04: Input length validation
    const nameErr = validateLength(name, MAX_INPUT_LENGTHS.name, "Name");
    const emailErr = validateLength(email, MAX_INPUT_LENGTHS.email, "Email");
    if (nameErr) return c.json({ error: nameErr }, 400);
    if (emailErr) return c.json({ error: emailErr }, 400);

    // SEC-07: Simple time-based cooldown — prevent rapid-fire spam from same email
    const recentSubmission = await c.env.DB.prepare(
      "SELECT id FROM inquiries WHERE email = ? AND created_at > datetime('now', '-2 minutes') LIMIT 1"
    ).bind(email).first();
    if (recentSubmission) {
      return c.json({ error: "Please wait a few minutes before submitting another inquiry." }, 429);
    }

    const id = crypto.randomUUID();

    await c.env.DB.prepare(
      "INSERT INTO inquiries (id, type, name, email, metadata) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, type, name, email, metadata ? JSON.stringify(metadata) : null).run();

    // Auto-create a pending sponsor record in the dashboard
    if (type === "sponsor") {
      let tierStr = "Pending";
      if (metadata && typeof metadata.level === "string") {
        tierStr = metadata.level.replace(" Tier Sponsor", "");
      }
      try {
        await c.env.DB.prepare(
          "INSERT INTO sponsors (id, name, tier, logo_url, website_url, is_active) VALUES (?, ?, ?, ?, ?, 0)"
        ).bind(id, name, tierStr, null, null).run();
      } catch (err) {
        console.error("Failed to insert sponsor draft", err);
      }
    }

    // Webhook or Email Notification
    try {
      const social = await getSocialConfig(c);
      const msg = `🔔 *New ${type.toUpperCase()} Inquiry*\n*Name:* ${name}\n*Email:* ${email}\n*Data:* \`${JSON.stringify(metadata)}\``;
      
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
         // You can customize the from/to email to a configured settings address if needed
         c.executionCtx.waitUntil(
            fetch("https://api.mailchannels.net/tx/v1/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                personalizations: [{ to: [{ email: "info@aresfirst.org", name: "ARES Admissions" }] }],
                from: { email: "noreply@aresfirst.org", name: "ARES Website Portal" },
                subject: `New ${type.toUpperCase()} Inquiry Submission`,
                content: [{ type: "text/plain", value: `You received a new ${type} inquiry from ${name} (${email}).\n\nPayload:\n${JSON.stringify(metadata, null, 2)}` }]
              })
            }).catch(console.error)
         );
      }

    } catch { /* ignore webhook error */ }

    // ── Zulip Admin Alert ──
    try {
      const alertBody = [
        `📧 **Email:** ${email}`,
        metadata ? `📎 **Details:** \`${JSON.stringify(metadata)}\`` : "",
        `🔗 [Review in Dashboard](https://aresfirst.org/dashboard?tab=inquiries)`,
      ].filter(Boolean).join("\n");

      c.executionCtx.waitUntil(
        sendZulipAlert(
          c.env,
          type === "sponsor" ? "Sponsor" : type === "join" ? "Applicant" : "Outreach",
          `New ${type} inquiry from ${name}`,
          alertBody
        ).catch(err => console.error("[Inquiry] Zulip alert failed:", err))
      );
    } catch { /* ignore Zulip error */ }

    // ── GitHub Auto-Escalation ──
    try {
      const social = await getSocialConfig(c);
      const ghConfig = buildGitHubConfig(social as Record<string, string>);
      if (ghConfig) {
         const markdownBody = `**Email:** ${email}\n\n**Details:**\n\`\`\`json\n${JSON.stringify(metadata, null, 2)}\n\`\`\``;
         c.executionCtx.waitUntil(
           createProjectItem(ghConfig, `[${type.toUpperCase()}] New Inquiry from ${name}`, markdownBody)
             .catch(err => console.error("[Inquiry] GitHub task creation failed:", err))
         );
      }
    } catch { /* ignore GitHub Error */ }

    return c.json({ success: true, id });
  } catch (err) {
    console.error("D1 inquiry submit error:", err);
    return c.json({ error: "Submission failed" }, 500);
  }
});

// ── PATCH /admin/inquiries/:id/status ──────────────────────────────────
inquiriesRouter.patch("/admin/inquiries/:id/status", async (c) => {
  try {
    const id = c.req.param("id");
    const { status } = await c.req.json();
    
    if (!status) return c.json({ error: "Missing status" }, 400);

    await c.env.DB.prepare(
      "UPDATE inquiries SET status = ? WHERE id = ?"
    ).bind(status, id).run();

    return c.json({ success: true });
  } catch {
    return c.json({ error: "Update failed" }, 500);
  }
});

// ── DELETE /admin/inquiries/:id ────────────────────────────────────────
inquiriesRouter.delete("/admin/inquiries/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await c.env.DB.prepare("DELETE FROM inquiries WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch {
    return c.json({ error: "Delete failed" }, 500);
  }
});

export default inquiriesRouter;
