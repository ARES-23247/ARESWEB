import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv, ensureAdmin, getSocialConfig, logAuditAction, logSystemError } from "../middleware";
import type { HonoContext } from "@shared/types/api";
import {
  sendMassEmailRoute,
  getStatsRoute,
} from "../../../shared/routes/communications";

export const communicationsRouter = new OpenAPIHono<AppEnv>();

// Require admin for all communications endpoints
communicationsRouter.use("/mass-email", ensureAdmin);
communicationsRouter.use("/stats", ensureAdmin);

// Get stats
communicationsRouter.openapi(getStatsRoute, async (c) => {
  try {
    const db = c.get("db") as any;
    if (!db) {
      console.error("[Communications] db context is null/undefined");
      return c.json({ success: false, error: "Database not initialized" } as any, 500);
    }
    const users = await db.selectFrom("user").select(["email"]).execute();

    const activeMembers = users.filter((m: any) => m.email);
    return c.json({ activeUsers: activeMembers.length }, 200);

  } catch (err: any) {
    console.error("[Communications] Error fetching stats:", err);
    return c.json({ success: false, error: err?.message || "Internal server error" } as any, 500);
  }
});

// Send mass email
communicationsRouter.openapi(sendMassEmailRoute, async (c) => {
  try {
    const { subject, htmlContent } = c.req.valid("json");
    const socialConfig = await getSocialConfig(c);

    if (!socialConfig.RESEND_API_KEY) {
      return c.json({ success: false, error: "Resend API key is not configured." } as any, 400);
    }

    const fromEmail = socialConfig.RESEND_FROM_EMAIL || "team@aresfirst.org";

    // Fetch users from database
    const db = c.get("db") as any;
    const users = await db.selectFrom("user").select(["email"]).execute();

    const activeMembers = users.filter((m: any) => m.email);

    if (activeMembers.length === 0) {
      return c.json({ success: false, error: "No active users found to send emails to." } as any, 400);
    }

    const BATCH_LIMIT = 50;
    const emailPayloads = [];

    // Resend Batch API allows sending an array of up to 100 emails at once, but we will chunk to 50 for safety.
    // Each user gets their own individual email so they don't see everyone else's address.
    for (const member of activeMembers) {
      emailPayloads.push({
        from: `ARES Robotics <${fromEmail}>`,
        to: [member.email],
        subject,
        html: htmlContent,
      });
    }

    let sentCount = 0;
    for (let i = 0; i < emailPayloads.length; i += BATCH_LIMIT) {
      const chunk = emailPayloads.slice(i, i + BATCH_LIMIT);

      const resendRes = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${socialConfig.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });

      if (!resendRes.ok) {
        const errText = await resendRes.text();
        throw new Error(`Resend API Error: ${errText}`);
      }

      const resData = await resendRes.json();
      // Batch returns an array of data or an error
      if (resData && (resData as any).error) {
         throw new Error(`Resend Batch Error: ${(resData as any).error.message}`);
      }

      sentCount += chunk.length;
    }

    await logAuditAction(c, "SEND_MASS_EMAIL", "communications", "broadcast", `Sent to ${sentCount} recipients. Subject: ${subject}`);

    return c.json({
      success: true,
      message: "Emails dispatched successfully",
      recipientCount: sentCount
    }, 200);

  } catch (err: any) {
    // WR-09: Sanitize error message to avoid logging PII (email addresses)
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    // Only log error type/class, not full details which may contain emails
    const sanitizedErrMsg = errMsg.length > 200
      ? errMsg.substring(0, 200) + "... (truncated)"
      : errMsg;
    console.error("[Communications] Send mass email failed:", sanitizedErrMsg);
    try {
      const db = c.get("db");
      await logSystemError(db, "Communications", "Failed to send mass email", errMsg);
    } catch { /* don't let logging failure mask the real error */ }
    return c.json({ success: false, error: errMsg || "Failed to dispatch emails" } as any, 500);
  }
});

export default communicationsRouter;
