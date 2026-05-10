
import { ApiError } from "../../middleware/errorHandler";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv } from "../../middleware";
import { ftcEventsProxyRoute } from "../../../../shared/routes/scouting";



const ftcEventsProxy = new OpenAPIHono<AppEnv>();

ftcEventsProxy.openapi(ftcEventsProxyRoute, async (c) => {
  const { path } = c.req.valid("param");
  const username = c.env.FTC_EVENTS_USERNAME;
  const apiKey = c.env.FTC_EVENTS_API_KEY;

  if (!username || !apiKey) {
    throw new ApiError("FTC Events API credentials not configured. Contact an administrator.", 500);
  }

  const authHeader = "Basic " + btoa(`${username}:${apiKey}`);
  const url = `https://ftc-api.firstinspires.org/v2.0/${path}`;

    const upstream = await fetch(url, {
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    if (!upstream.ok) {
      console.error(`[FTC Events Proxy] Upstream ${upstream.status} for ${path}`);
      throw new ApiError(`FTC Events upstream error: ${upstream.status}`, 502);
    }

    const data = await upstream.json();
    return c.json(data, 200);
});

export default ftcEventsProxy;



