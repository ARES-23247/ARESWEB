import { typedHandler } from "../utils/handler";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import {
  AppEnv,
  ensureAdmin,
  logAuditAction,
  validateLength,
  MAX_INPUT_LENGTHS,
  getDbSettings,
  rateLimitMiddleware,
} from "../middleware";
import {
  getSettingsRoute,
  updateSettingsRoute,
  getStatsRoute,
  getPublicSettingsRoute,
  getBackupRoute as _getBackupRoute,
} from "../../../shared/routes/settings";
import { z } from "zod";



export const settingsRouter = new OpenAPIHono<AppEnv>();

const SENSITIVE_KEYS = new Set([
  "ENCRYPTION_SECRET", "BETTER_AUTH_SECRET", "BLUESKY_APP_PASSWORD",
  "BAND_ACCESS_TOKEN", "FACEBOOK_ACCESS_TOKEN", "TWITTER_API_SECRET",
  "TWITTER_ACCESS_SECRET", "INSTAGRAM_ACCESS_TOKEN", "GCAL_PRIVATE_KEY",
  "ZULIP_API_KEY", "GITHUB_PAT", "GITHUB_WEBHOOK_SECRET",
  "CLOUDFLARE_API_TOKEN", "R2_ACCESS_KEY", "R2_SECRET_KEY",
]);

function maskSecret(value: string): string {
  if (!value || value.length <= 4) return "••••";
  return "••••••••" + value.slice(-4);
}

const settingsSchema = z.record(z.string(), z.string().max(10000));

settingsRouter.use("/admin/*", ensureAdmin);

settingsRouter.openapi(getSettingsRoute, typedHandler<typeof getSettingsRoute>(async (c) => {
  try {
    const settings = await getDbSettings(c);
    const masked: Record<string, string> = {};
    for (const [key, value] of Object.entries(settings)) {
      masked[key] = SENSITIVE_KEYS.has(key) ? maskSecret(value) : value;
    }
    return c.json({ success: true, settings: masked } as any, 200 as any);
  } catch (e) {
    console.error("GET_SETTINGS ERROR", e);
    return c.json({ success: false, error: "Failed to fetch settings" } as any, 500 as any);
  }
}));

settingsRouter.openapi(updateSettingsRoute, typedHandler<typeof updateSettingsRoute>(async (c) => {
  const db = c.get("db") as Kysely<DB>;
  try {
    const body = c.req.valid("json");
    const validationResult = settingsSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        { success: false, error: "Invalid settings format: " + validationResult.error.issues.map((i) => i.message).join(", ") } as any, 400 as any);
    }

    const entries = Object.entries(validationResult.data) as [string, string][];
    let updatedCount = 0;
    const sensitiveKeysUpdated: string[] = [];
    for (const [key, value] of entries) {
      if (SENSITIVE_KEYS.has(key)) {
        if (value.startsWith("••••")) continue;
        return c.json({ success: false, error: `Cannot update ${key} via API. Please use the admin console.` } as any, 403 as any);
      }

      const error = validateLength(value, MAX_INPUT_LENGTHS.generic, key);
      if (error) return c.json({ success: false, updated: 0 } as any, 400 as any);

      await db
        .insertInto("settings")
        .values({ key, value, updated_at: new Date().toISOString() })
        .onConflict((oc) => oc.column("key").doUpdateSet({ value, updated_at: new Date().toISOString() }))
        .execute();

      updatedCount++;
      if (SENSITIVE_KEYS.has(key)) sensitiveKeysUpdated.push(key);
    }

    const auditMessage = sensitiveKeysUpdated.length > 0
      ? `Updated ${updatedCount} integration keys (sensitive: ${sensitiveKeysUpdated.join(", ")})`
      : `Updated ${updatedCount} integration keys.`;

    c.executionCtx.waitUntil(logAuditAction(c, "updated_settings", "system_settings", null, auditMessage));
    return c.json({ success: true, updated: updatedCount } as any, 200 as any);
  } catch (e) {
    console.error("UPDATE_SETTINGS ERROR", e);
    return c.json({ success: false, error: "Update failed" } as any, 500 as any);
  }
}));

settingsRouter.openapi(getStatsRoute, typedHandler<typeof getStatsRoute>(async (c) => {
  const db = c.get("db") as Kysely<DB>;
  try {
    const [posts, events, docs, inquiries, users] = await Promise.all([
      db.selectFrom("posts").select(db.fn.count("slug").as("count")).where("is_deleted", "=", 0).executeTakeFirst(),
      db.selectFrom("events").select(db.fn.count("id").as("count")).where("is_deleted", "=", 0).executeTakeFirst(),
      db.selectFrom("docs").select(db.fn.count("slug").as("count")).where("is_deleted", "=", 0).executeTakeFirst(),
      db.selectFrom("inquiries").select(db.fn.count("id").as("count")).where("status", "=", "pending").executeTakeFirst(),
      db.selectFrom("user").select(db.fn.count("id").as("count")).executeTakeFirst(),
    ]);
    return c.json({
      posts: Number(posts?.count || 0),
      events: Number(events?.count || 0),
      docs: Number(docs?.count || 0),
      inquiries: Number(inquiries?.count || 0),
      users: Number(users?.count || 0),
    } as any, 200 as any);
  } catch (e) {
    console.error("GET_STATS ERROR", e);
    return c.json({ error: "Failed to fetch stats" } as any, 500 as any);
  }
}));

settingsRouter.openapi(getPublicSettingsRoute, typedHandler<typeof getPublicSettingsRoute>(async (c) => {
  try {
    const settings = await getDbSettings(c);
    const publicKeys = ["COMMUNITY_PHOTO_DRIVE_URL", "COMMUNITY_DOCS_URL"];
    const publicSettings: Record<string, string> = {};
    for (const key of publicKeys) {
      if (settings[key]) publicSettings[key] = settings[key];
    }
    return c.json({ success: true, settings: publicSettings } as any, 200 as any);
  } catch (e) {
    console.error("GET_PUBLIC_SETTINGS ERROR", e);
    return c.json({ success: false, error: "Failed to fetch public settings" } as any, 500 as any);
  }
}));

// WR-16: Add rate limiting to backup endpoint to prevent DoS
settingsRouter.get("/admin/backup", rateLimitMiddleware(5, 300), async (c) => {
  const db = c.get("db") as Kysely<DB>;
  try {
    const SAFE_TABLES = [
      "posts", "events", "docs", "docs_history", "docs_feedback",
      "media_tags", "user_profiles", "event_signups", "badges",
      "user_badges", "inquiries", "locations", "sponsor_metrics",
      "sponsor_tokens", "notifications", "sponsors", "comments",
      "awards", "page_analytics", "audit_log",
    ] as const;

    const TABLE_COLUMNS: Record<string, string[]> = {
      user_profiles: [
        "user_id", "nickname", "pronouns", "subteams", "member_type",
        "bio", "favorite_first_thing", "fun_fact", "show_on_about",
        "favorite_robot_mechanism", "pre_match_superstition",
        "leadership_role", "rookie_year", "updated_at",
      ],
      inquiries: ["id", "type", "name", "email", "status", "created_at"],
      audit_log: ["id", "action", "resource_type", "resource_id", "actor", "created_at"],
    };

    const backup: Record<string, unknown[]> = {};
    const backupPromises = SAFE_TABLES.map(async (tableName) => {
      try {
        const cols = TABLE_COLUMNS[tableName];
        const anyDb = db as unknown as Kysely<Record<string, Record<string, unknown>>>;
        const q = cols
          ? anyDb.selectFrom(tableName).select(cols)
          : anyDb.selectFrom(tableName).selectAll();
        const data = (await q.limit(1000).execute()) as unknown[];

        if (tableName === "inquiries") {
          return {
            tableName,
            data: (data || []).map((r) => {
              const row = r as Record<string, unknown>;
              return { ...row, name: row.name ? String(row.name).substring(0, 1) + "***" : "***", email: "***@***.***" };
            }),
          };
        }
        return { tableName, data };
      } catch {
        return { tableName, data: [] };
      }
    });

    const results = await Promise.all(backupPromises);
    for (const res of results) backup[res.tableName] = res.data;

    c.executionCtx.waitUntil(logAuditAction(c, "database_export", "system", null, "Exported full D1 database backup as JSON."));
    return c.json({ success: true, timestamp: new Date().toISOString(), backup } as any, 200 as any);
  } catch {
    return c.json({ success: false, error: "Backup failed" } as any, 500 as any);
  }
});

export default settingsRouter;
