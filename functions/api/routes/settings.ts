 
import { Hono, Context } from "hono";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { AppEnv, ensureAdmin, logAuditAction, validateLength, MAX_INPUT_LENGTHS, getDbSettings  } from "../middleware";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { settingsContract } from "../../../shared/schemas/contracts/settingsContract";

export const settingsRouter = new Hono<AppEnv>();
const s = initServer<AppEnv>();

// SEC-03: Infrastructure secrets that must never be returned in plaintext
const SENSITIVE_KEYS = new Set([
  'ENCRYPTION_SECRET', 'BETTER_AUTH_SECRET',
  'BLUESKY_APP_PASSWORD',
  'FACEBOOK_ACCESS_TOKEN', 'TWITTER_API_SECRET', 'TWITTER_ACCESS_SECRET',
  'INSTAGRAM_ACCESS_TOKEN', 'GCAL_PRIVATE_KEY',
  'ZULIP_API_KEY', 'GITHUB_PAT', 'GITHUB_WEBHOOK_SECRET',
  'CLOUDFLARE_API_TOKEN', 'R2_ACCESS_KEY', 'R2_SECRET_KEY',
]);

function maskSecret(value: string): string {
  if (!value || value.length <= 4) return '••••';
  return '••••••••' + value.slice(-4);
}



const settingsHandlers = {
   
  getSettings: async (_: any, c: Context<AppEnv>) => {
    try {
      const settings = await getDbSettings(c);
      const masked: Record<string, string> = {};
      for (const [key, value] of Object.entries(settings)) {
        masked[key] = SENSITIVE_KEYS.has(key) ? maskSecret(value) : value;
      }
      return { status: 200 as const, body: { success: true, settings: masked } as any };
    } catch {
      return { status: 500 as const, body: { success: false, settings: {} } as any };
    }
  },
   
  updateSettings: async ({ body }: { body: any }, c: Context<AppEnv>) => {
    const db = c.get("db") as Kysely<DB>;
    try {
      const entries = Object.entries(body) as [string, string][];
      for (const [key, value] of entries) {
        const error = validateLength(value, MAX_INPUT_LENGTHS.generic, key);
        if (error) return { status: 400 as const, body: { success: false, updated: 0 } as any };
        await db.insertInto("settings")
          .values({ key, value, updated_at: new Date().toISOString() })
          .onConflict((oc: any) => oc.column("key").doUpdateSet({ value, updated_at: new Date().toISOString() }))
          .execute();
      }
      c.executionCtx.waitUntil(logAuditAction(c, "updated_settings", "system_settings", null, `Updated ${entries.length} integration keys.`));
      return { status: 200 as const, body: { success: true, updated: entries.length } as any };
    } catch {
      return { status: 500 as const, body: { success: false, updated: 0 } as any };
    }
  },
   
  getStats: async (_: any, c: Context<AppEnv>) => {
    const db = c.get("db") as Kysely<DB>;
    try {
      const [posts, events, docs, inquiries, users] = await Promise.all([
        db.selectFrom("posts").select(db.fn.count("slug").as("count")).where("is_deleted", "=", 0).executeTakeFirst(),
        db.selectFrom("events").select(db.fn.count("id").as("count")).where("is_deleted", "=", 0).executeTakeFirst(),
        db.selectFrom("docs").select(db.fn.count("slug").as("count")).where("is_deleted", "=", 0).executeTakeFirst(),
        db.selectFrom("inquiries").select(db.fn.count("id").as("count")).where("status", "=", "pending").executeTakeFirst(),
        db.selectFrom("user").select(db.fn.count("id").as("count")).executeTakeFirst(),
      ]);
      return {
        status: 200 as const,
        body: {
          posts: Number(posts?.count || 0),
          events: Number(events?.count || 0),
          docs: Number(docs?.count || 0),
          inquiries: Number(inquiries?.count || 0),
          users: Number(users?.count || 0),
        } as any
      };
    } catch {
      return { status: 200 as const, body: { posts: 0, events: 0, docs: 0, inquiries: 0, users: 0 } as any };
    }
  }
};

const settingsTsRestRouter = s.router(settingsContract, settingsHandlers as any);



// Admin protection - Entire router
settingsRouter.use(ensureAdmin);

// Backup route remains manual as it's a file export
settingsRouter.get("/admin/backup", async (c: any) => {
  const db = c.get("db");
  try {
    const SAFE_TABLES = [
      "posts", "events", "docs", "docs_history", "docs_feedback",
      "media_tags", "user_profiles", "event_signups",
      "badges", "user_badges", "inquiries", "locations",
      "sponsor_metrics", "sponsor_tokens", "notifications",
      "sponsors", "comments", "awards",
      "page_analytics", "audit_log"
    ];
    
    const TABLE_COLUMNS: Record<string, string[]> = {
      user_profiles: ["user_id", "nickname", "pronouns", "subteams", "member_type", "bio", "favorite_first_thing", "fun_fact", "show_on_about", "favorite_robot_mechanism", "pre_match_superstition", "leadership_role", "rookie_year", "updated_at"],
      inquiries: ["id", "type", "name", "email", "status", "created_at"],
      audit_log: ["id", "action", "resource_type", "resource_id", "actor", "created_at"]
    };
    
    const backup: Record<string, unknown[]> = {};
    for (const tableName of SAFE_TABLES) {
      try {
        const cols = TABLE_COLUMNS[tableName];
        let q: any = db.selectFrom(tableName);
        if (cols) {
          q = q.select(cols);
        } else {
          q = q.selectAll();
        }
        backup[tableName] = await q.limit(1000).execute() as unknown[];
        
        if (tableName === "inquiries") {
          backup[tableName] = (backup[tableName] || []).map((r) => {
            const row = r as Record<string, unknown>;
            return {
              ...row,
              name: row.name ? String(row.name).substring(0, 1) + "***" : "***",
              email: "***@***.***"
            };
          });
        }
      } catch { /* skip */ }
    }
    
    c.executionCtx.waitUntil(logAuditAction(c, "database_export", "system", null, "Exported full D1 database backup as JSON."));
    return c.json({ success: true, timestamp: new Date().toISOString(), backup });
  } catch {
    return c.json({ success: false, error: "Backup failed" }, 500);
  }
});


createHonoEndpoints(settingsContract, settingsTsRestRouter, settingsRouter);
export default settingsRouter;


