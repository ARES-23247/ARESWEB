
import { Kysely, sql } from "kysely";
import { DB } from "../../../../shared/schemas/database";

import { AppEnv, getSocialConfig, logAuditAction, SocialConfig } from "../../middleware";
import { encrypt, decrypt } from "../../../utils/crypto";
import { safeJSONStringify } from "../../../utils/json";
import { sendZulipMessage } from "../../../utils/zulipSync";
import { notifyByRole, NotifyAudience } from "../../../utils/notifications";
import { buildGitHubConfig, createProjectItem } from "../../../utils/githubProjects";
import { initServer } from "ts-rest-hono";
const _s = initServer<AppEnv>();

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

export const inquiryHandlers: any = {
  list: async (input: any, c: any) => {
    try {
      const { query } = input;
      const db = c.get("db") as Kysely<DB>;
      const user = c.get("sessionUser");
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } };

      const limit = query.limit || 50;
      const offset = query.offset || 0;
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
        .select(["id", "type", "name", "email", "metadata", "status", "created_at"])
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
          type: r.type as any,
          name,
          email,
          metadata: metadata || null,
          status: r.status as any,
          created_at: String(r.created_at)
        };
      }));

      return { status: 200 as const, body: { inquiries: inquiries as any[] } };
    } catch (e) {
      console.error("[Inquiry:List] Error", e);
      return { status: 500 as const, body: { error: "Failed to fetch inquiries" } };
    }
  },
  submit: async (input: any, c: any) => {
    try {
      const { body } = input;
      const db = c.get("db") as Kysely<DB>;
      const { type, name, email, metadata } = body;
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
            const currentMeta = safeJSONStringify(metadata, null as any);
            if (r.metadata === currentMeta) {
              return { status: 200 as const, body: { success: true, id: r.id } };
            }
          }
        } catch { /* ignore */ }
      }

      const id = crypto.randomUUID();
      const encryptedName = await encrypt(name, secret);
      const encryptedEmail = await encrypt(email, secret);
      
      let metadataStr = safeJSONStringify(metadata, null as any);
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
        if (metadata && typeof (metadata as any).level === "string") {
          tierStr = (metadata as any).level;
          tierStr = tierStr.replace(" Tier Sponsor", "");
        }
        const encryptedSponsorName = await encrypt(name, secret);
        await db.insertInto("sponsors")
          .values({
            id,
            name: encryptedSponsorName,
            tier: tierStr as any,
            is_active: 0,
          })
          .execute();
      }

      const baseUrl = new URL(c.req.url).origin;

      c.executionCtx.waitUntil((async () => {
        const social = await getSocialConfig(c);
        const msg = `🔔 *New ${type.toUpperCase()} Inquiry* (ID: ${id.slice(0, 8)})\n*Review:* ${baseUrl}/dashboard/inquiries`;
        
        if (social.DISCORD_WEBHOOK_URL) {
          await fetch(social.DISCORD_WEBHOOK_URL, { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ content: msg }) 
          }).catch(() => {});
        }
        
        const topic = `${type.charAt(0).toUpperCase() + type.slice(1)} Inquiry: ${name}`;
        const zulipContent = `**New ${type} inquiry received**\n\n**Name:** ${name}\n**Email:** ${email}\n**ID:** ${id.slice(0, 8)}\n\n[Review Inquiry](${baseUrl}/dashboard/inquiries)`;
        await sendZulipMessage(social, "contacts", topic, zulipContent).catch(() => {});

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

      return { status: 200 as const, body: { success: true, id } };
    } catch (e) {
      console.error("[Inquiry:Submit] Error", e);
      return { status: 500 as const, body: { error: "Submission failed" } };
    }
  },
  updateStatus: async (input: any, c: any) => {
    try {
      const { params, body } = input;
      const db = c.get("db") as Kysely<DB>;
      await db.updateTable("inquiries")
        .set({ status: body.status })
        .where("id", "=", params.id)
        .execute();

      c.executionCtx.waitUntil(logAuditAction(c, "inquiry_status_change", "inquiries", params.id, `Status changed to ${body.status}`));
      return { status: 200 as const, body: { success: true, status: body.status as any } };
    } catch (err) {
      console.error("[Inquiry:UpdateStatus] Error", err);
      return { status: 500 as const, body: { error: "Update failed" } };
    }
  },
  delete: async (input: any, c: any) => {
    try {
      const { params } = input;
      const db = c.get("db") as Kysely<DB>;
      await db.deleteFrom("inquiries").where("id", "=", params.id).execute();
      c.executionCtx.waitUntil(logAuditAction(c, "inquiry_deleted", "inquiries", params.id, "Inquiry deleted"));
      return { status: 200, body: { success: true } };
    } catch (e: any) {
      console.error("[Inquiry:Delete] Error", e);
      return { status: 500, body: { error: e?.message || "Delete failed" } };
    }
  },
};
