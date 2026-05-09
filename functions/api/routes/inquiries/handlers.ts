import { eq, desc, inArray, and, sql, gt } from "drizzle-orm";
import { QUERY_LIMITS } from "../../utils/queryLimits";
import * as schema from "../../../../src/db/schema";
import type { RouteHandler } from "@hono/zod-openapi";
import { getSocialConfig, logAuditAction, SocialConfig, getDb } from "../../middleware";
import { ApiError } from "../../middleware/errorHandler";
import type { DrizzleDB } from "../../../../src/db/types";



import { encrypt, decrypt } from "../../../utils/crypto";
import { safeJSONStringify } from "../../../utils/json";
import { sendZulipMessage } from "../../../utils/zulipSync";
import { notifyByRole, NotifyAudience } from "../../../utils/notifications";
import { buildGitHubConfig, createProjectItem } from "../../../utils/githubProjects";
import { sendEmail } from "../../../utils/email";
import { InquiryReceipt } from "../../templates/InquiryTemplates";
import { safeWaitUntil } from "../../utils/safeWaitUntil";

import {
  listInquiriesRoute,
  submitInquiryRoute,
  updateInquiryStatusRoute,
  updateInquiryNotesRoute,
  deleteInquiryRoute
} from "../../../../shared/routes/inquiries";
import { AppEnv } from "../../middleware";



/**
 * Deletes old inquiries that have been resolved or rejected.
 */
export async function purgeOldInquiries(db: DrizzleDB, days: number) {
  if (days <= 0) return { deleted: 0 };
  
  const res = await db.run(sql`
    DELETE FROM inquiries
    WHERE id IN (
      SELECT id FROM inquiries
      WHERE status IN ('resolved', 'rejected')
      AND created_at < datetime('now', '-' || ${days} || ' days')
      LIMIT ${QUERY_LIMITS.MAX_PAGE}
    )
  `);
  
  return { deleted: res.meta?.changes ?? 0 };
}

export const handleListInquiries: RouteHandler<typeof listInquiriesRoute, AppEnv> = async (c) => {
  const { limit = 50, offset = 0 } = c.req.valid("query");
    const db = getDb(c);
    const user = c.get("sessionUser");
    if (!user) throw new ApiError("Unauthorized", 401);

    const secret = c.get("env")?.ENCRYPTION_SECRET || c.env.ENCRYPTION_SECRET;
    let maskPII = false;
    let filterOutreach = false;

    if (user.role !== "admin") {
      const memberType = user.member_type || "student";
      if (memberType === "student") {
        maskPII = true;
        filterOutreach = true;
      }
    }

    const dbQuery = db.select({
        id: schema.inquiries.id,
        type: schema.inquiries.type,
        name: schema.inquiries.name,
        email: schema.inquiries.email,
        metadata: schema.inquiries.metadata,
        status: schema.inquiries.status,
        created_at: schema.inquiries.createdAt,
        zulip_message_id: schema.inquiries.zulipMessageId,
        notes: schema.inquiries.notes
      })
      .from(schema.inquiries)
      .orderBy(desc(schema.inquiries.createdAt))
      .limit(limit)
      .offset(offset);
    
    if (filterOutreach) {
      dbQuery.where(inArray(schema.inquiries.type, ["outreach", "support"]));
    }

    const results = await dbQuery.all();
    const METADATA_WHITELIST = ['level', 'org', 'message', 'event_type', 'date', 'topic', 'position', 'subteam'];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inquiries = await Promise.all(results.map(async (r: any) => {
      let name = String(r.name);
      let email = String(r.email);
      
      try { 
        if (name.includes(":")) name = await decrypt(name, secret); 
      } catch { 
        name = "[ENCRYPTED NAME]";
      }
      
      try { 
        if (email.includes(":")) email = await decrypt(email, secret); 
      } catch { 
        email = "[ENCRYPTED EMAIL]";
      }
      
      let metadata = r.metadata;

      if (maskPII) {
        name = name.substring(0, 1) + "*".repeat(name.length - 1);
        email = email.replace(/(.{2})(.*)(?=@)/, (_, a, b) => a + "*".repeat(b.length));
        if (metadata) {
          try {
            const meta = JSON.parse(metadata) as Record<string, unknown>;
            const clean: Record<string, unknown> = {};
            for (const key of METADATA_WHITELIST) if (key in meta) clean[key] = meta[key];
            metadata = JSON.stringify(clean);
          } catch { /* ignore */ }
        }
      }
      
      return {
        id: String(r.id),
        type: r.type,
        name,
        email,
        metadata: metadata || null,
        status: r.status,
        created_at: String(r.created_at),
        zulip_message_id: r.zulip_message_id,
        notes: r.notes
      };
    }));

    return c.json({ inquiries }, 200);
};

export const handleSubmitInquiry: RouteHandler<typeof submitInquiryRoute, AppEnv> = async (c) => {
  const { type, name, email, metadata } = c.req.valid("json");
    const db = getDb(c);
    const secret = c.get("env")?.ENCRYPTION_SECRET || c.env.ENCRYPTION_SECRET;
    if (!secret) {
      console.error("[Inquiry:Submit] ENCRYPTION_SECRET is not configured!");
      throw new ApiError("Server configuration error: encryption key missing. Please contact the team.", 500);
    }

    // Prevents double submissions
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const recent = await db.select({
        id: schema.inquiries.id,
        email: schema.inquiries.email,
        metadata: schema.inquiries.metadata
      })
      .from(schema.inquiries)
      .where(and(
        eq(schema.inquiries.type, type),
        gt(schema.inquiries.createdAt, sixtySecondsAgo)
      ))
      .all();

    for (const r of recent) {
      try {
        const decryptedEmail = await decrypt(r.email, secret);
        if (decryptedEmail === email) {
          const currentMeta = safeJSONStringify(metadata, undefined);
          if (r.metadata === currentMeta) {
            return c.json({ success: true, id: r.id }, 200);
          }
        }
      } catch { /* ignore */ }
    }

    const id = crypto.randomUUID();
    const encryptedName = await encrypt(name, secret);
    const encryptedEmail = await encrypt(email, secret);
    
    let metadataStr = safeJSONStringify(metadata, undefined);
    if (metadataStr && metadataStr.length > 5000) {
      metadataStr = metadataStr.substring(0, 5000);
    }

    await db.insert(schema.inquiries)
      .values({
        id,
        type,
        name: encryptedName,
        email: encryptedEmail,
        metadata: metadataStr,
      })
      .run();

    if (type === "sponsor") {
      let tierStr = "Pending";
      const meta = metadata as Record<string, unknown> | undefined;
      if (meta && typeof meta.level === "string") {
        tierStr = meta.level;
        tierStr = tierStr.replace(" Tier Sponsor", "");
      }
      const encryptedSponsorName = await encrypt(name, secret);
      await db.insert(schema.sponsors)
        .values({
          id,
          name: encryptedSponsorName,
          tier: tierStr,
          isActive: 0,
        })
        .run();
    }

    const baseUrl = new URL(c.req.url).origin;

    safeWaitUntil(c.executionCtx, (async () => {
      const social = await getSocialConfig(c);
      const msg = `\ud83d\udd14 *New ${type.toUpperCase()} Inquiry* (ID: ${id.slice(0, 8)})\n*Review:* ${baseUrl}/dashboard/inquiries`;

      if (social.DISCORD_WEBHOOK_URL) {
        await fetch(social.DISCORD_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: msg })
        }).catch((err) => console.error("Failed to send Discord webhook:", err));
      }

      const topic = `${type.charAt(0).toUpperCase() + type.slice(1)} Inquiry: ${name}`;
      const zulipContent = `**New ${type} inquiry received**\n\n**Name:** ${name}\n**Email:** ${email}\n**ID:** ${id.slice(0, 8)}\n\n[Review Inquiry](${baseUrl}/dashboard/inquiries)`;
      const messageId = await sendZulipMessage(social, "contacts", topic, zulipContent).catch((err) => {
        console.error("Failed to send Zulip message:", err);
        return null;
      });

      if (messageId) {
        await db.update(schema.inquiries).set({ zulipMessageId: messageId }).where(eq(schema.inquiries.id, id)).run();
      }

      const audiences: NotifyAudience[] = (type === "outreach" || type === "support") ? ["admin", "coach", "mentor", "student"] : ["admin", "coach", "mentor"];
      await notifyByRole(c, audiences, {
        title: `New ${type.toUpperCase()} Inquiry`,
        message: `${name} submitted a new inquiry.`,
        link: "/dashboard/inquiries",
        priority: type === "sponsor" ? "high" : "medium"
      }).catch((err) => console.error("Failed to notify by role:", err));

      if (type === "sponsor" || type === "student") {
        const ghConfig = buildGitHubConfig(social as SocialConfig);
        if (ghConfig) {
          await createProjectItem(ghConfig, `[${type.toUpperCase()}] New Inquiry (ID: ${id.slice(0, 8)})`, `Review: ${baseUrl}/dashboard/inquiries`).catch((err) => {
            console.error("Failed to create GitHub project item:", err);
          });
        }
      }

      // Send automated email receipt for join (student/mentor) and support inquiries
      if (type === "student" || type === "mentor" || type === "support") {
        const subject = `Inquiry Received: ${type.charAt(0).toUpperCase() + type.slice(1)} - ARES 23247`;
        const html = (await InquiryReceipt({ name, type, id })).toString();

        await sendEmail(c, {
          to: email,
          subject,
          html,
        }).catch((err) => console.error("[Inquiry:Email] Failed to send receipt:", err));
      }
    })(), "Inquiry submission background tasks failed");

    return c.json({ success: true, id }, 200);
};

export const handleUpdateStatus: RouteHandler<typeof updateInquiryStatusRoute, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
    const { status } = c.req.valid("json");
    const db = getDb(c);
    await db.update(schema.inquiries)
      .set({ status })
      .where(eq(schema.inquiries.id, id))
      .run();

    c.executionCtx.waitUntil(logAuditAction(c, "inquiry_status_change", "inquiries", id, `Status changed to ${status}`));
    return c.json({ success: true, status }, 200);
};

export const handleUpdateNotes: RouteHandler<typeof updateInquiryNotesRoute, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
    const { notes } = c.req.valid("json");
    const db = getDb(c);
    await db.update(schema.inquiries)
      .set({ notes })
      .where(eq(schema.inquiries.id, id))
      .run();

    c.executionCtx.waitUntil(logAuditAction(c, "inquiry_notes_change", "inquiries", id, `Notes updated`));
    return c.json({ success: true }, 200);
};

export const handleDeleteInquiry: RouteHandler<typeof deleteInquiryRoute, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
    const db = getDb(c);
    await db.delete(schema.inquiries).where(eq(schema.inquiries.id, id)).run();
    c.executionCtx.waitUntil(logAuditAction(c, "inquiry_deleted", "inquiries", id, "Inquiry deleted"));
    return c.json({ success: true }, 200);
};
