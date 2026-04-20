import { Hono } from "hono";
import { Bindings, ensureAdmin } from "./_shared";

const settingsRouter = new Hono<{ Bindings: Bindings }>();

// ── GET /admin/settings — get all integrations settings ───────────────
settingsRouter.get("/admin/settings", ensureAdmin, async (c) => {
  try {
    const { results } = await c.env.DB.prepare("SELECT key, value FROM settings").all();
    const settings: Record<string, string> = {};
    for (const row of results as { key: string; value: string }[]) {
      settings[row.key] = row.value;
    }
    return c.json({ success: true, settings });
  } catch (err) {
    console.error("D1 settings read error:", err);
    return c.json({ settings: {} }, 500);
  }
});

// ── POST /admin/settings — upsert settings key-value pairs ────────────
settingsRouter.post("/admin/settings", ensureAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const entries = Object.entries(body) as [string, string][];
    
    for (const [key, value] of entries) {
      await c.env.DB.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
      ).bind(key, value).run();
    }
    
    return c.json({ success: true, updated: entries.length });
  } catch (err) {
    console.error("D1 settings write error:", err);
    return c.json({ error: "Settings save failed" }, 500);
  }
});

export default settingsRouter;
