import { typedHandler } from "../utils/handler";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv, ensureAdmin, getSocialConfig, logAuditAction, logSystemError } from "../middleware";

import { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../../src/db/schema";
import * as relations from "../../../src/db/relations";
import {

  sendMassEmailRoute,
  getStatsRoute,
} from "../../../shared/routes/communications";

type DrizzleDb = DrizzleD1Database<typeof schema & typeof relations>;


export const communicationsRouter = new OpenAPIHono<AppEnv>();

// Require admin for all communications endpoints
communicationsRouter.use("/mass-email", ensureAdmin);
communicationsRouter.use("/stats", ensureAdmin);

// Get stats
communicationsRouter.openapi(getStatsRoute, typedHandler<typeof getStatsRoute>(async (c) => {
  try {
    const db = c.get("db") as DrizzleDb | null;
    if (!db) {
      console.error("[Communications] db context is null/undefined");
      return c.json({ success: false, error: "Database not initialized" }, 500);
    }
    const users = await db.select({ email: schema.user.email }).from(schema.user);

    const activeMembers = users.filter((m) => m.email);
    return c.json({ activeUsers: activeMembers.length }, 200);

  } catch (err: unknown) {
    console.error("[Communications] Error fetching stats:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal server error";
    return c.json({ success: false, error: errorMessage }, 500);
  }
}));

// Send mass email
communicationsRouter.openapi(sendMassEmailRoute, typedHandler<typeof sendMassEmailRoute>(async (c) => {
  try {
    const { subject, htmlContent } = c.req.valid("json");
    const socialConfig = await getSocialConfig(c);

    if (!socialConfig.RESEND_API_KEY) {
      return c.json({ success: false, error: "Resend API key is not configured." }, 400);
    }

    const fromEmail = socialConfig.RESEND_FROM_EMAIL || "team@aresfirst.org";

    // Fetch users from database
    const db = c.get("db") as DrizzleDb;
    const users = await db.select({ email: schema.user.email }).from(schema.user);

    const activeMembers = users.filter((m) => m.email);

    if (activeMembers.length === 0) {
      return c.json({ success: false, error: "No active users found to send emails to." }, 400);
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

      const resData = (await resendRes.json()) as Record<string, unknown>;
      if (resData && typeof resData.error === "object" && resData.error !== null) {
        const error = resData.error as Record<string, unknown>;
        throw new Error(`Resend Batch Error: ${error.message || "Unknown error"}`);
      }

      sentCount += chunk.length;
    }

    await logAuditAction(c, "SEND_MASS_EMAIL", "communications", "broadcast", `Sent to ${sentCount} recipients. Subject: ${subject}`);

    return c.json({
      success: true,
      message: "Emails dispatched successfully",
      recipientCount: sentCount
    }, 200);

  } catch (err: unknown) {
    // WR-09: Sanitize error message to avoid logging PII (email addresses)
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    // Only log error type/class, not full details which may contain emails
    const sanitizedErrMsg = errMsg.length > 200
      ? errMsg.substring(0, 200) + "... (truncated)"
      : errMsg;
    console.error("[Communications] Send mass email failed:", sanitizedErrMsg);
    try {
      const db = c.get("db") as DrizzleDb;
      await logSystemError(db, "Communications", "Failed to send mass email", errMsg);
    } catch { /* don't let logging failure mask the real error */ }
    return c.json({ success: false, error: errMsg || "Failed to dispatch emails" }, 500);
  }
}));

export default communicationsRouter;
