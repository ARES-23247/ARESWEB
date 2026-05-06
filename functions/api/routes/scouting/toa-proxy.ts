// ── The Orange Alliance API Proxy ─────────────────────────────────────
// Proxies requests to TOA, injecting the API key server-side so it
// never reaches the client. Protects against key leakage and CORS issues.

import { Hono } from "hono";
import type { Context } from "hono";
import { AppEnv } from "../../middleware";

const toaProxy = new Hono<AppEnv>();

toaProxy.get("/:path{.+}", async (c: Context<AppEnv>) => {
  const path = c.req.param("path");
  const toaKey = (c.env as Record<string, unknown>).TOA_API_KEY as string | undefined;

  if (!toaKey) {
    return c.json(
      { error: "TOA_API_KEY not configured. Contact an administrator.", status: 500 },
      500
    );
  }

  const url = `https://theorangealliance.org/api/${path}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        "X-TOA-Key": toaKey,
        "X-Application-Origin": "ARES-23247-ARESWEB",
        "Content-Type": "application/json",
      },
    });

    if (!upstream.ok) {
      console.error(`[TOA Proxy] Upstream ${upstream.status} for ${path}`);
      return c.json(
        { error: `TOA upstream error: ${upstream.status}`, status: upstream.status },
        502
      );
    }

    const data = await upstream.json();
    return c.json(data);
  } catch (err) {
    console.error("[TOA Proxy] Fetch error:", err);
    return c.json(
      { error: "Failed to reach The Orange Alliance API", status: 502 },
      502
    );
  }
});

export default toaProxy;

