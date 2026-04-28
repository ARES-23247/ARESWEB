
import { Hono } from "hono";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { mediaContract } from "../../../../shared/schemas/contracts/mediaContract";
import { AppEnv, ensureAdmin, getSessionUser } from "../../middleware";
import { mediaHandlers } from "./handlers";

const s = initServer<AppEnv>();
const mediaRouter = new Hono<AppEnv>();

const mediaTsRestRouter = s.router(mediaContract, mediaHandlers);

// Protections
mediaRouter.use("/admin/*", ensureAdmin);
mediaRouter.use("/admin", ensureAdmin);

createHonoEndpoints(mediaContract, mediaTsRestRouter, mediaRouter);

// GET /media/:key — Serve raw object from R2 (Must be after createHonoEndpoints to avoid catching /admin)
mediaRouter.get("/:key{.+$}", async (c) => {
  const key = c.req.param("key");
  try {
    const folder = key.includes("/") ? key.split("/")[0] : "Uncategorized";
    const publicFolders = ["Gallery", "Library"];
    if (!publicFolders.includes(folder)) {
      const user = await getSessionUser(c);
      if (!user) return c.text("Unauthorized", 401);
    }
    const cache = typeof caches !== 'undefined' ? (caches as any).default : null;
    const url = new URL(c.req.url);
    url.search = "";
    const cacheKey = new Request(url.toString(), { method: "GET" });
    
    if (cache) {
      const cached = await cache.match(cacheKey);
      if (cached && publicFolders.includes(folder)) return cached;
    }

    if (!c.env.ARES_STORAGE) return c.text("R2 Not Bound", 404);
    
    const object = await c.env.ARES_STORAGE.get(key);
    if (!object || !object.body) return c.text("Not Found", 404);

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    if (publicFolders.includes(folder)) headers.set("Cache-Control", "public, max-age=2592000, stale-while-revalidate=86400");
    else headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

    const response = new Response(object.body, { headers });
    if (cache && publicFolders.includes(folder) && c.executionCtx) {
      c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
    }
    return response;
  } catch (e) {
    console.error("[Media:Raw] Error", e);
    return c.text("Internal Error", 500);
  }
});

export default mediaRouter;
