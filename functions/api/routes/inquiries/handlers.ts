/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAPI handler input validated by Zod schemas */
import { Kysely, sql } from "kysely";
import { DB } from "../../../../shared/schemas/database";
import { getSocialConfig, logAuditAction, SocialConfig } from "../../middleware";
import { encrypt, decrypt } from "../../../utils/crypto";
import { safeJSONStringify } from "../../../utils/json";
import { sendZulipMessage } from "../../../utils/zulipSync";
import { notifyByRole, NotifyAudience } from "../../../utils/notifications";
import { buildGitHubConfig, createProjectItem } from "../../../utils/githubProjects";
import type { RouteHandler } from "@hono/zod-openapi";
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
export async function purgeOldInquiries(db: Kysely<DB>, days: number) {
  if (days <= 0) return { deleted: 0 };
  const res = await db.deleteFrom("inquiries")
    .where("id", "in", (eb) => eb.selectFrom("inquiries")
      .select("id")
      .where("status", "in", ["resolved", "rejected"])
      .where("created_at", "<", sql<string>`datetime('now', '-' || ${days} || ' days')`)
      .limit(100)
    )
    .execute();
  return { deleted: res.length };
}

export const handleListInquiries: RouteHandler<typeof listInquiriesRoute, AppEnv> = async (c: any) => {
  try {
    const { limit = 50, offset = 0 } = c.req.valid("query");
    const db = c.get("db") as Kysely<DB>;
    const user = c.get("sessionUser");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const secret = c.env.ENCRYPTION_SECRET;
    let maskPII = false;
    let filterOutreach = false;

    if (user.role !== "admin") {
      const memberType = user.member_type || "student";
      if (memberType === "student") {
        maskPII = true;
        filterOutreach = true;
      }
    }

    let dbQuery = db.selectFrom("inquiries")
      .select(["id", "type", "name", "email", "metadata", "status", "created_at", "zulip_message_id", "notes"])
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset);
    
    if (filterOutreach) {
      dbQuery = dbQuery.where("type", "in", ["outreach", "support"]);
    }

    const results = await dbQuery.execute();
    const METADATA_WHITELIST = ['level', 'org', 'message', 'event_type', 'date', 'topic', 'position', 'subteam'];

    const inquiries = await Promise.all(results.map(async (r) => {
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
  } catch (e) {
    console.error("[Inquiry:List] Error", e);
    return c.json({ error: "Failed to fetch inquiries" }, 500);
  }
};

export const handleSubmitInquiry: RouteHandler<typeof submitInquiryRoute, AppEnv> = async (c: any) => {
  try {
    const { type, name, email, metadata } = c.req.valid("json");
    const db = c.get("db") as Kysely<DB>;
    const secret = c.env.ENCRYPTION_SECRET;

    // Prevents double submissions
    const recent = await db.selectFrom("inquiries")
      .select(["id", "email", "metadata"])
      .where("type", "=", type)
      .where("created_at", ">", sql<string>`datetime('now', '-60 seconds')`)
      .execute();

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

    await db.insertInto("inquiries")
      .values({
        id,
        type,
        name: encryptedName,
        email: encryptedEmail,
        metadata: metadataStr,
      })
      .execute();

    if (type === "sponsor") {
      let tierStr = "Pending";
      const meta = metadata as Record<string, unknown> | undefined;
      if (meta && typeof meta.level === "string") {
        tierStr = meta.level;
        tierStr = tierStr.replace(" Tier Sponsor", "");
      }
      const encryptedSponsorName = await encrypt(name, secret);
      await db.insertInto("sponsors")
        .values({
          id,
          name: encryptedSponsorName,
          tier: tierStr,
          is_active: 0,
        })
        .execute();
    }

    const baseUrl = new URL(c.req.url).origin;

    c.executionCtx.waitUntil((async () => {
      const social = await getSocialConfig(c);
      const msg = `\ud83d\udd14 *New ${type.toUpperCase()} Inquiry* (ID: ${id.slice(0, 8)})\n*Review:* ${baseUrl}/dashboard/inquiries`;
      
      if (social.DISCORD_WEBHOOK_URL) {
        await fetch(social.DISCORD_WEBHOOK_URL, { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify({ content: msg }) 
        }).catch(() => {});
      }
      
      const topic = `${type.charAt(0).toUpperCase() + type.slice(1)} Inquiry: ${name}`;
      const zulipContent = `**New ${type} inquiry received**\n\n**Name:** ${name}\n**Email:** ${email}\n**ID:** ${id.slice(0, 8)}\n\n[Review Inquiry](${baseUrl}/dashboard/inquiries)`;
      const messageId = await sendZulipMessage(social, "contacts", topic, zulipContent).catch(() => null);

      if (messageId) {
        await db.updateTable("inquiries").set({ zulip_message_id: messageId }).where("id", "=", id).execute();
      }

      const audiences: NotifyAudience[] = (type === "outreach" || type === "support") ? ["admin", "coach", "mentor", "student"] : ["admin", "coach", "mentor"];
      await notifyByRole(c, audiences, { 
        title: `New ${type.toUpperCase()} Inquiry`, 
        message: `${name} submitted a new inquiry.`, 
        link: "/dashboard/inquiries", 
        priority: type === "sponsor" ? "high" : "medium" 
      }).catch(() => {});

      if (type === "sponsor" || type === "student") {
        const ghConfig = buildGitHubConfig(social as SocialConfig);
        if (ghConfig) {
          await createProjectItem(ghConfig, `[${type.toUpperCase()}] New Inquiry (ID: ${id.slice(0, 8)})`, `Review: ${baseUrl}/dashboard/inquiries`).catch(() => {});
        }
      }
    })());

    return c.json({ success: true, id }, 200);
  } catch (e) {
    console.error("[Inquiry:Submit] Error", e);
    return c.json({ error: "Submission failed" }, 500);
  }
};

export const handleUpdateStatus: RouteHandler<typeof updateInquiryStatusRoute, AppEnv> = async (c: any) => {
  try {
    const { id } = c.req.valid("param");
    const { status } = c.req.valid("json");
    const db = c.get("db") as Kysely<DB>;
    await db.updateTable("inquiries")
      .set({ status })
      .where("id", "=", id)
      .execute();

    c.executionCtx.waitUntil(logAuditAction(c, "inquiry_status_change", "inquiries", id, `Status changed to ${status}`));
    return c.json({ success: true, status }, 200);
  } catch (err) {
    console.error("[Inquiry:UpdateStatus] Error", err);
    return c.json({ error: "Update failed" }, 500);
  }
};

export const handleUpdateNotes: RouteHandler<typeof updateInquiryNotesRoute, AppEnv> = async (c: any) => {
  try {
    const { id } = c.req.valid("param");
    const { notes } = c.req.valid("json");
    const db = c.get("db") as Kysely<DB>;
    await db.updateTable("inquiries")
      .set({ notes })
      .where("id", "=", id)
      .execute();

    c.executionCtx.waitUntil(logAuditAction(c, "inquiry_notes_change", "inquiries", id, `Notes updated`));
    return c.json({ success: true }, 200);
  } catch (err) {
    console.error("[Inquiry:UpdateNotes] Error", err);
    return c.json({ error: "Notes update failed" }, 500);
  }
};

export const handleDeleteInquiry: RouteHandler<typeof deleteInquiryRoute, AppEnv> = async (c: any) => {
  try {
    const { id } = c.req.valid("param");
    const db = c.get("db") as Kysely<DB>;
    await db.deleteFrom("inquiries").where("id", "=", id).execute();
    c.executionCtx.waitUntil(logAuditAction(c, "inquiry_deleted", "inquiries", id, "Inquiry deleted"));
    return c.json({ success: true }, 200);
  } catch (e: unknown) {
    const error = e as Error;
    console.error("[Inquiry:Delete] Error", error);
    return c.json({ error: error.message || "Delete failed" }, 500);
  }
};
