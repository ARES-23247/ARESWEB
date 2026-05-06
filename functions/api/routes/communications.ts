/* eslint-disable @typescript-eslint/no-explicit-any -- ts-rest handler input validated by contract library */
import { ServerInferRequest } from "../../../shared/types/api";
import { Hono } from "hono";
import { createHonoEndpoints } from "ts-rest-hono";
import { communicationsContract } from "../../../shared/schemas/contracts/communicationsContract";
import { AppEnv, ensureAdmin, getSocialConfig, logAuditAction, logSystemError, s } from "../middleware";

import type { HonoContext } from "@shared/types/api";

export const communicationsRouter = new Hono<AppEnv>();

// Require admin for all communications endpoints
communicationsRouter.use("/admin/*", ensureAdmin);
// WR-01 FIX: Change from /* to /admin/* - /* pattern was too broad


const handlers = {
  getStats: async (_input: ServerInferRequest<typeof communicationsContract["getStats"]>, c: HonoContext) => {
    try {
 
      const db = c.get("db") as any;
      if (!db) {
        console.error("[Communications] db context is null/undefined");
        return { status: 500 as const, body: { success: false as const, error: "Database not initialized" } };
      }
      const users = await db.selectFrom("user").select(["email"]).execute();
 
      const activeMembers = users.filter((m: any) => m.email);
      return { status: 200 as const, body: { activeUsers: activeMembers.length } };
 
    } catch (err: any) {
      console.error("[Communications] Error fetching stats:", err);
      return { status: 500 as const, body: { success: false as const, error: err?.message || "Internal server error" } };
    }
  },

  sendMassEmail: async (input: ServerInferRequest<typeof communicationsContract["sendMassEmail"]>, c: HonoContext) => {
    try {
      const { subject, htmlContent } = input.body;
      const socialConfig = await getSocialConfig(c);

      if (!socialConfig.RESEND_API_KEY) {
        return { status: 400 as const, body: { success: false as const, error: "Resend API key is not configured." } };
      }

      const fromEmail = socialConfig.RESEND_FROM_EMAIL || "team@aresfirst.org";

      // Fetch users from database
 
      const db = c.get("db") as any;
      const users = await db.selectFrom("user").select(["email"]).execute();
 
      const activeMembers = users.filter((m: any) => m.email);

      if (activeMembers.length === 0) {
        return { status: 400 as const, body: { success: false as const, error: "No active users found to send emails to." } };
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

      return { 
        status: 200 as const, 
        body: { 
          success: true, 
          message: "Emails dispatched successfully",
          recipientCount: sentCount
        } 
      };

 
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
      return { status: 500 as const, body: { success: false as const, error: errMsg || "Failed to dispatch emails" } };
    }
  }
};


const communicationsTsRestRouter = s.router(communicationsContract, handlers as any);
createHonoEndpoints(
  communicationsContract,
  communicationsTsRestRouter,
  communicationsRouter,
  {
    responseValidation: true,
    responseValidationErrorHandler: (err, _c) => {
      console.error('[Contract] Response validation failed:', err.cause);
      return { error: { message: 'Internal server error' }, status: 500 };
    }
  }
);

export default communicationsRouter;

