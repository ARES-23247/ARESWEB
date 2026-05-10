import { ApiError } from "../middleware/errorHandler";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv, ensureAdmin, getSocialConfig, logAuditAction, getDb } from "../middleware";
import * as schema from "../../../src/db/schema";
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
    const db = getDb(c);
    const users = await db.select({ email: schema.user.email }).from(schema.user).all();

    const activeMembers = users.filter((m) => m.email);
    return c.json({ activeUsers: activeMembers.length }, 200);
});

// Send mass email
communicationsRouter.openapi(sendMassEmailRoute, async (c) => {
    const body = c.req.valid("json");
    const { subject, htmlContent } = body;
    const socialConfig = await getSocialConfig(c);

    if (!socialConfig.RESEND_API_KEY) {
      throw new ApiError("Resend API key is not configured.", 400);
    }

    const fromEmail = socialConfig.RESEND_FROM_EMAIL || "team@aresfirst.org";

    // Fetch users from database
    const db = getDb(c);
    const users = await db.select({ email: schema.user.email }).from(schema.user).all();

    const activeMembers = users.filter((m) => m.email);

    if (activeMembers.length === 0) {
      throw new ApiError("No active users found to send emails to.", 400);
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
});

export default communicationsRouter;
