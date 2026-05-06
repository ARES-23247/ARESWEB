// ── FTC Events API Proxy ─────────────────────────────────────────────
// Proxies requests to the FIRST FTC Events API v2.0, injecting Basic
// Auth credentials server-side. Protects API keys from client exposure.

import { Hono } from "hono";
import type { Context } from "hono";
import { AppEnv } from "../../middleware";

const ftcEventsProxy = new Hono<AppEnv>();

ftcEventsProxy.get("/:path{.+}", async (c: Context<AppEnv>) => {
  const path = c.req.param("path");
  const env = c.env as Record<string, unknown>;
  const username = env.FTC_EVENTS_USERNAME as string | undefined;
  const apiKey = env.FTC_EVENTS_API_KEY as string | undefined;

  if (!username || !apiKey) {
    return c.json(
      { error: "FTC Events API credentials not configured. Contact an administrator.", status: 500 },
      500
    );
  }

  const authHeader = "Basic " + btoa(`${username}:${apiKey}`);
  const url = `https://ftc-api.firstinspires.org/v2.0/${path}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    if (!upstream.ok) {
      console.error(`[FTC Events Proxy] Upstream ${upstream.status} for ${path}`);
      return c.json(
        { error: `FTC Events upstream error: ${upstream.status}`, status: upstream.status },
        502
      );
    }

    const data = await upstream.json();
    return c.json(data);
  } catch (err) {
    console.error("[FTC Events Proxy] Fetch error:", err);
    return c.json(
      { error: "Failed to reach FTC Events API", status: 502 },
      502
    );
  }
});

export default ftcEventsProxy;

