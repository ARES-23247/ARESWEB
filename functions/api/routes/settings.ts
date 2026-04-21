import { Hono } from "hono";
import { AppEnv, ensureAdmin, getDbSettings, logAuditAction, validateLength, MAX_INPUT_LENGTHS  } from "./_shared";

const settingsRouter = new Hono<AppEnv>();

// ── GET /admin/settings — get all integrations settings ───────────────
settingsRouter.get("/", ensureAdmin, async (c) => {
  try {
    const settings = await getDbSettings(c);
    return c.json({ success: true, settings });
  } catch (err) {
    console.error("D1 settings read error:", err);
    return c.json({ success: false, settings: {} }, 500);
  }
});

// ── POST /admin/settings — upsert settings key-value pairs ────────────
settingsRouter.post("/", ensureAdmin, async (c) => {
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

// ── GET /admin/backup — Export database as JSON ───────────────
settingsRouter.get("/admin/backup", ensureAdmin, async (c) => {
  try {
    // SEC-02: Whitelist known safe table names instead of dynamic interpolation from sqlite_master
    const SAFE_TABLES = [
      "posts", "events", "docs", "docs_history", "docs_feedback",
      "settings", "media_tags", "user_profiles", "event_signups",
      "badges", "user_badges", "inquiries", "locations",
      "sponsor_metrics", "sponsor_tokens", "notifications",
      "sponsors", "comments", "outreach_events", "awards",
      "page_analytics", "audit_log"
    ];
    
    const backup: Record<string, Record<string, unknown>[]> = {};
    for (const tableName of SAFE_TABLES) {
      try {
        const { results } = await c.env.DB.prepare(`SELECT * FROM "${tableName}"`).all();
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
