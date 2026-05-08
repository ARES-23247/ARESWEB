 
import { typedHandler } from "../../utils/handler";
import { ApiError } from "../../middleware/errorHandler";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv } from "../../middleware";
import { toaProxyRoute } from "../../../../shared/routes/scouting";



const toaProxy = new OpenAPIHono<AppEnv>();

toaProxy.openapi(toaProxyRoute, typedHandler<typeof toaProxyRoute>(async (c) => {
  const { path } = c.req.valid("param");
  const toaKey = c.env.TOA_API_KEY;

  if (!toaKey) {
    throw new ApiError("TOA_API_KEY not configured. Contact an administrator.", 500);
  }

  const url = `https://theorangealliance.org/api/${path}`;

    const upstream = await fetch(url, {
      headers: {
        "X-TOA-Key": toaKey,
        "X-Application-Origin": "ARES-23247-ARESWEB",
        "Content-Type": "application/json",
      },
    });

    if (!upstream.ok) {
      console.error(`[TOA Proxy] Upstream ${upstream.status} for ${path}`);
      throw new ApiError(`TOA upstream error: ${upstream.status}`, 502);
    }

    const data = await upstream.json();
    return c.json(data, 200);
}));

export default toaProxy;

