import { Hono } from "hono";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { communicationsContract } from "../../../shared/schemas/contracts/communicationsContract";
import { AppEnv, getSocialConfig, logAuditAction, logSystemError } from "../middleware/utils";

const s = initServer<AppEnv>();
export const communicationsRouter = new Hono<AppEnv>();

const handlers = {
  getStats: async ({ c }: { c: any }) => {
    try {
      const db = c.get("db") as any;
      const users = await db.selectFrom("user").select(["email"]).execute();
      const activeMembers = users.filter((m: any) => m.email);
      return { status: 200, body: { activeUsers: activeMembers.length } };
    } catch (err) {
      console.error("[Communications] Error fetching stats:", err);
      return { status: 500, body: { success: false, error: "Internal server error" } };
    }
  },

  sendMassEmail: async ({ body, c }: { body: any, c: any }) => {
    try {
      const socialConfig = await getSocialConfig(c);
      
      if (!socialConfig.RESEND_API_KEY) {
        return { status: 400, body: { success: false, error: "Resend API key is not configured." } };
      }

      const fromEmail = socialConfig.RESEND_FROM_EMAIL || "team@aresfirst.org";

      // Fetch users from database
      const db = c.get("db") as any;
      const users = await db.selectFrom("user").select(["email"]).execute();
      const activeMembers = users.filter((m: any) => m.email);

      if (activeMembers.length === 0) {
        return { status: 400, body: { success: false, error: "No active users found to send emails to." } };
      }

      const BATCH_LIMIT = 50;
      const emailPayloads = [];

      // Resend Batch API allows sending an array of up to 100 emails at once, but we will chunk to 50 for safety.
      // Each user gets their own individual email so they don't see everyone else's address.
      for (const member of activeMembers) {
        emailPayloads.push({
          from: `ARES Robotics <${fromEmail}>`,
          to: [member.email],
          subject: body.subject,
          html: body.htmlContent,
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

      await logAuditAction(c, "SEND_MASS_EMAIL", "communications", "broadcast", `Sent to ${sentCount} recipients. Subject: ${body.subject}`);

      return { 
        status: 200, 
        body: { 
          success: true, 
          message: "Emails dispatched successfully",
          recipientCount: sentCount
        } 
      };

    } catch (err: any) {
      console.error("[Communications] Send mass email failed:", err);
      const db = c.get("db");
      await logSystemError(db, "Communications", "Failed to send mass email", err.message);
      return { status: 500, body: { success: false, error: err.message || "Failed to dispatch emails" } };
    }
  }
};

const communicationsTsRestRouter = s.router(communicationsContract, handlers as any);
createHonoEndpoints(communicationsContract, communicationsTsRestRouter, communicationsRouter);

export default communicationsRouter;
