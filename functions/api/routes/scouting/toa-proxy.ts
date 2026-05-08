/* eslint-disable @typescript-eslint/no-explicit-any */
import { typedHandler } from "../../utils/handler";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv } from "../../middleware";
import { toaProxyRoute } from "../../../../shared/routes/scouting";



const toaProxy = new OpenAPIHono<AppEnv>();

toaProxy.openapi(toaProxyRoute, typedHandler<typeof toaProxyRoute>(async (c) => {
  const { path } = c.req.valid("param");
  const toaKey = c.env.TOA_API_KEY;

  if (!toaKey) {
    return c.json(
      { error: "TOA_API_KEY not configured. Contact an administrator.", status: 500 }, 500);
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
        { error: `TOA upstream error: ${upstream.status}`, status: upstream.status }, 502);
    }

    const data = await upstream.json();
    return c.json(data, 200);
  } catch (err) {
    console.error("[TOA Proxy] Fetch error:", err);
    return c.json(
      { error: "Failed to reach The Orange Alliance API", status: 502 }, 502);
  }
}));

export default toaProxy;

