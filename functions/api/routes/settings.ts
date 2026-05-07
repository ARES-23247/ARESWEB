/* eslint-disable @typescript-eslint/no-explicit-any */
import { typedHandler } from "../utils/handler";
import { OpenAPIHono } from "@hono/zod-openapi";
import { eq, count } from "drizzle-orm";
import * as schema from "../../../src/db/schema";

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
  const db = c.get("db") as any;
  try {
    const body = c.req.valid("json");
    const validationResult = settingsSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        { success: false, error: "Invalid settings format: " + validationResult.error.issues.map((i: any) => i.message).join(", ") } as any, 400 as any);
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
        .insert(schema.settings)
        .values({ key, value, updatedAt: new Date().toISOString() })
        .onConflictDoUpdate({
          target: schema.settings.key,
          set: { value, updatedAt: new Date().toISOString() }
        });

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
  const db = c.get("db") as any;
  try {
    const [posts, events, docs, inquiries, users] = await Promise.all([
      db.select({ count: count(schema.posts.slug) }).from(schema.posts).where(eq(schema.posts.isDeleted, 0)).get(),
      db.select({ count: count(schema.events.id) }).from(schema.events).where(eq(schema.events.isDeleted, 0)).get(),
      db.select({ count: count(schema.docs.slug) }).from(schema.docs).where(eq(schema.docs.isDeleted, 0)).get(),
      db.select({ count: count(schema.inquiries.id) }).from(schema.inquiries).where(eq(schema.inquiries.status, "pending")).get(),
      db.select({ count: count(schema.user.id) }).from(schema.user).get(),
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

const SCHEMA_MAP: Record<string, any> = {
  posts: schema.posts,
  events: schema.events,
  docs: schema.docs,
  docs_history: schema.docsHistory,
  docs_feedback: schema.docsFeedback,
  media_tags: schema.mediaTags,
  user_profiles: schema.userProfiles,
  event_signups: schema.eventSignups,
  badges: schema.badges,
  user_badges: schema.userBadges,
  inquiries: schema.inquiries,
  locations: schema.locations,
  sponsor_metrics: schema.sponsorMetrics,
  sponsor_tokens: schema.sponsorTokens,
  notifications: schema.notifications,
  sponsors: schema.sponsors,
  comments: schema.comments,
  awards: schema.awards,
  page_analytics: schema.pageAnalytics,
  audit_log: schema.auditLog,
};

// WR-16: Add rate limiting to backup endpoint to prevent DoS
settingsRouter.get("/admin/backup", rateLimitMiddleware(5, 300), async (c) => {
  const db = c.get("db") as any;
  try {
    const SAFE_TABLES = [
      "posts", "events", "docs", "docs_history", "docs_feedback",
      "media_tags", "user_profiles", "event_signups", "badges",
      "user_badges", "inquiries", "locations", "sponsor_metrics",
      "sponsor_tokens", "notifications", "sponsors", "comments",
      "awards", "page_analytics", "audit_log",
    ] as const;

    const TABLE_COLUMNS: Record<string, any[]> = {
      user_profiles: [
        schema.userProfiles.userId, schema.userProfiles.nickname, schema.userProfiles.pronouns, 
        schema.userProfiles.subteams, schema.userProfiles.memberType, schema.userProfiles.bio, 
        schema.userProfiles.favoriteFirstThing, schema.userProfiles.funFact, schema.userProfiles.showOnAbout,
        schema.userProfiles.favoriteRobotMechanism, schema.userProfiles.preMatchSuperstition,
        schema.userProfiles.leadershipRole, schema.userProfiles.rookieYear, schema.userProfiles.updatedAt,
      ],
      inquiries: [
        schema.inquiries.id, schema.inquiries.type, schema.inquiries.name, 
        schema.inquiries.email, schema.inquiries.status, schema.inquiries.createdAt
      ],
      audit_log: [
        schema.auditLog.id, schema.auditLog.action, schema.auditLog.resourceType, 
        schema.auditLog.resourceId, schema.auditLog.actor, schema.auditLog.createdAt
      ],
    };

    const backup: Record<string, unknown[]> = {};
    const backupPromises = SAFE_TABLES.map(async (tableName) => {
      try {
        const tableSchema = SCHEMA_MAP[tableName];
        if (!tableSchema) return { tableName, data: [] };
        
        const cols = TABLE_COLUMNS[tableName];
        let query;
        if (cols && cols.length > 0) {
          const selectObj: Record<string, any> = {};
          cols.forEach(col => {
            selectObj[col.name] = col;
          });
          query = db.select(selectObj).from(tableSchema);
        } else {
          query = db.select().from(tableSchema);
        }
        
        const data = (await query.limit(1000).all()) as unknown[];

        if (tableName === "inquiries") {
          return {
            tableName,
            data: (data || []).map((r: any) => {
              const row = r as Record<string, unknown>;
              return { ...row, name: row.name ? String(row.name).substring(0, 1) + "***" : "***", email: "***@***.***" };
            }),
          };
        }
        return { tableName, data };
      } catch (e) {
        console.error(`Backup error for table ${tableName}:`, e);
        return { tableName, data: [] };
      }
    });

    const results = await Promise.all(backupPromises);
    for (const res of results) backup[res.tableName] = res.data;

    c.executionCtx.waitUntil(logAuditAction(c, "database_export", "system", null, "Exported full D1 database backup as JSON."));
    return c.json({ success: true, timestamp: new Date().toISOString(), backup } as any, 200 as any);
  } catch (e) {
    console.error("BACKUP ERROR", e);
    return c.json({ success: false, error: "Backup failed" } as any, 500 as any);
  }
});

export default settingsRouter;
