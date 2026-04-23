import { Hono } from "hono";
import { AppEnv, ensureAdmin, getDbSettings, logAuditAction, validateLength, MAX_INPUT_LENGTHS, rateLimitMiddleware  } from "../middleware";

const settingsRouter = new Hono<AppEnv>();

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

// ── GET /admin/settings — get all integrations settings ───────────────
settingsRouter.get("/", ensureAdmin, async (c) => {
  try {
    const settings = await getDbSettings(c);
    // Mask sensitive values for defense-in-depth
    const masked: Record<string, string> = {};
    for (const [key, value] of Object.entries(settings)) {
      masked[key] = SENSITIVE_KEYS.has(key) ? maskSecret(value) : value;
    }
    return c.json({ success: true, settings: masked });
  } catch (err) {
    console.error("D1 settings read error:", err);
    return c.json({ success: false, settings: {} }, 500);
  }
});

// ── POST /admin/settings — upsert settings key-value pairs ────────────
settingsRouter.post("/", ensureAdmin, rateLimitMiddleware(15, 60), async (c) => {
  try {
    const body = await c.req.json();
    const entries = Object.entries(body) as [string, string][];
    
    for (const [key, value] of entries) {
      // SEC-01: Length validation for all keys
      const error = validateLength(value, MAX_INPUT_LENGTHS.generic, key);
      if (error) return c.json({ error }, 400);

      await c.env.DB.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
      ).bind(key, value).run();
    }
    
    await logAuditAction(c, "updated_settings", "system_settings", null, `Updated ${entries.length} integration keys.`);
    return c.json({ success: true, updated: entries.length });
  } catch (err) {
    console.error("D1 settings write error:", err);
    return c.json({ error: "Settings save failed" }, 500);
  }
});

// ── GET /admin/stats — Fast counting for Dashboard ────────────────────
settingsRouter.get("/stats", ensureAdmin, async (c) => {
  try {
    const [posts, events, docs, inquiries, users] = await c.env.DB.batch([
      c.env.DB.prepare("SELECT COUNT(*) as count FROM posts WHERE is_deleted = 0"),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM events WHERE is_deleted = 0"),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM docs WHERE is_deleted = 0"),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM inquiries WHERE status = 'pending'"),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM user"),
    ]);

    return c.json({
      posts: (posts.results?.[0] as { count: number })?.count || 0,
      events: (events.results?.[0] as { count: number })?.count || 0,
      docs: (docs.results?.[0] as { count: number })?.count || 0,
      inquiries: (inquiries.results?.[0] as { count: number })?.count || 0,
      users: (users.results?.[0] as { count: number })?.count || 0,
    });
  } catch (err) {
    console.error("D1 stats error:", err);
    return c.json({ posts: 0, events: 0, docs: 0, inquiries: 0, users: 0 });
  }
});

// ── GET /admin/backup — Export database as JSON ───────────────
settingsRouter.get("/admin/backup", ensureAdmin, async (c) => {
  try {
    // SEC-02: Whitelist known safe table names.
    // PII-S01: CRITICAL - Explicitly exclude "settings" from full export to prevent secret leak.
    const SAFE_TABLES = [
      "posts", "events", "docs", "docs_history", "docs_feedback",
      "media_tags", "user_profiles", "event_signups",
      "badges", "user_badges", "inquiries", "locations",
      "sponsor_metrics", "sponsor_tokens", "notifications",
      "sponsors", "comments", "awards",
      "page_analytics", "audit_log"
    ];
    
    // SEC-F02: Explicit column selections per table to prevent accidental PII/secret transit.
    // Tables without a mapping use SELECT * (safe because they contain no secrets).
    const TABLE_COLUMNS: Record<string, string> = {
      user_profiles: "user_id, nickname, pronouns, subteams, member_type, bio, favorite_first_thing, fun_fact, show_on_about, favorite_robot_mechanism, pre_match_superstition, leadership_role, rookie_year, avatar, updated_at",
      inquiries: "id, type, SUBSTR(name, 1, 1) || '***' as name, '***@***.***' as email, status, created_at",
      audit_log: "id, action, resource_type, resource_id, actor, created_at" // PII-S02: Exclude 'details' from full backup to prevent PII leak
    };
    
    const backup: Record<string, Record<string, unknown>[]> = {};
    for (const tableName of SAFE_TABLES) {
      try {
        const cols = TABLE_COLUMNS[tableName] || "*";
        // SEC-SQL: Use literal table names from our hardcoded SAFE_TABLES whitelist.
        const { results } = await c.env.DB.prepare(`SELECT ${cols} FROM "${tableName}"`).all();
        backup[tableName] = results;
      } catch {
        // Table may not exist yet — skip silently
      }
    }
    
    await logAuditAction(c, "database_export", "system", null, "Exported full D1 database backup as JSON.");
    
    return c.json({ success: true, timestamp: new Date().toISOString(), backup });
  } catch (err) {
    console.error("D1 backup error:", err);
    return c.json({ success: false, error: "Backup generation failed" }, 500);
  }
});

export default settingsRouter;
