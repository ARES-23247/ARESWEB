import { OpenAPIHono } from "@hono/zod-openapi";
import { 
  getMediaRoute, 
  getAdminMediaRoute, 
  uploadMediaRoute, 
  moveMediaRoute, 
  deleteMediaRoute, 
  syndicateMediaRoute 
} from "../../../../shared/routes/media";
import { AppEnv, ensureAdmin, getSessionUser } from "../../middleware";
import { mediaHandlers } from "./handlers";

export const mediaRouter = new OpenAPIHono<AppEnv>();

// Protections
mediaRouter.use("/admin/*", ensureAdmin);
mediaRouter.use("/admin", ensureAdmin);

// Register OpenAPI routes
mediaRouter.openapi(getMediaRoute, mediaHandlers.getMedia as any);
mediaRouter.openapi(getAdminMediaRoute, mediaHandlers.adminList as any);
mediaRouter.openapi(uploadMediaRoute, mediaHandlers.upload as any);
mediaRouter.openapi(moveMediaRoute, mediaHandlers.move as any);
mediaRouter.openapi(deleteMediaRoute, mediaHandlers.delete as any);
mediaRouter.openapi(syndicateMediaRoute, mediaHandlers.syndicate as any);

// GET /media/:key — Serve raw object from R2 (This is NOT an OpenAPI route because it returns binary/raw data)
mediaRouter.get("/:key{.+$}", async (c) => {
  const key = c.req.param("key");
  try {
    const folder = key.includes("/") ? key.split("/")[0] : "Uncategorized";
    const publicFolders = ["Gallery", "Library"];
    if (!publicFolders.includes(folder)) {
      const user = await getSessionUser(c);
      if (!user) return c.text("Unauthorized", 401);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cloudflare Workers Cache API type
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- R2Object writeHttpMetadata requires Headers type
    object.writeHttpMetadata(headers as any);
    headers.set("etag", object.httpEtag);
    if (publicFolders.includes(folder)) headers.set("Cache-Control", "public, max-age=2592000, stale-while-revalidate=86400");
    else headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- R2Object body is ReadableStream but types don't match
    const response = new Response(object.body as any, { headers });
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
