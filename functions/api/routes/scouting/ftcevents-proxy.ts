import { Context } from "hono";
import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv } from "../../middleware";
import { ftcEventsProxyRoute } from "../../../../shared/routes/scouting";

const ftcEventsProxy = new OpenAPIHono<AppEnv>();

ftcEventsProxy.openapi(ftcEventsProxyRoute, async (c: Context<AppEnv>) => {
  const { path } = c.req.valid("param");
  const username = c.env.FTC_EVENTS_USERNAME;
  const apiKey = c.env.FTC_EVENTS_API_KEY;

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
    return c.json(data, 200);
  } catch (err) {
    console.error("[FTC Events Proxy] Fetch error:", err);
    return c.json(
      { error: "Failed to reach FTC Events API", status: 502 },
      502
    );
  }
});

export default ftcEventsProxy;

