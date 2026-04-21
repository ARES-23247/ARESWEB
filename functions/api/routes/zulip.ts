import { Hono } from "hono";
import { Bindings, ensureAdmin, getSocialConfig } from "./_shared";

const zulipRouter = new Hono<{ Bindings: Bindings }>();

// GET /zulip/presence — Fetch realm presence
zulipRouter.get("/presence", ensureAdmin, async (c) => {
  try {
    const config = await getSocialConfig(c);
    if (!config.ZULIP_BOT_EMAIL || !config.ZULIP_API_KEY) {
      return c.json({ error: "Zulip not configured." }, 400);
    }
    
    const authHeader = "Basic " + btoa(`${config.ZULIP_BOT_EMAIL}:${config.ZULIP_API_KEY}`);
    const url = `${config.ZULIP_URL || "https://ares.zulipchat.com"}/api/v1/realm/presence`;

    const res = await fetch(url, {
      method: "GET",
      headers: { "Authorization": authHeader }
    });

    if (!res.ok) {
      return c.json({ error: await res.text() }, res.status);
    }

    const data = await res.json() as { result: string; presences: Record<string, unknown> };
    return c.json({ success: true, presence: data.presences });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

export default zulipRouter;
