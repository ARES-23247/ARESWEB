import { OpenAPIHono } from "@hono/zod-openapi";

import { eq, asc } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { z } from "zod";
import {
  locationSchema,
  listLocationsRoute,
  adminListLocationsRoute,
  saveLocationRoute,
  deleteLocationRoute
} from "../../../shared/routes/locations";
import { AppEnv, ensureAdmin, logAuditAction, getDb } from "../middleware";
import { edgeCacheMiddleware } from "../middleware/cache";




type LocationInput = z.infer<typeof locationSchema>;


type ListLocationsSuccess = z.infer<typeof listLocationsRoute.responses[200]["content"]["application/json"]["schema"]>;


type AdminListLocationsSuccess = z.infer<typeof adminListLocationsRoute.responses[200]["content"]["application/json"]["schema"]>;


type SaveLocationSuccess = z.infer<typeof saveLocationRoute.responses[200]["content"]["application/json"]["schema"]>;


type DeleteLocationSuccess = z.infer<typeof deleteLocationRoute.responses[200]["content"]["application/json"]["schema"]>;

export const locationsRouter = new OpenAPIHono<AppEnv>();


// Apply edge caching to public GET routes (non-admin, non-signups)
locationsRouter.use("*", async (c, next) => {
  const path = c.req.path;
  if (c.req.method !== "GET" || path.includes("/admin/") || path.includes("/signups") || path.includes("/history")) {
    return next();
  }
  return edgeCacheMiddleware(180, 60, 300)(c, next);
});


// Apply caching to public locations list


locationsRouter.use("/admin/*", ensureAdmin);

locationsRouter.openapi(listLocationsRoute, async (c) => {
    const db = getDb(c);
    const results = await db.select({
        id: schema.locations.id,
        name: schema.locations.name,
        address: schema.locations.address,
        maps_url: schema.locations.mapsUrl,
        isDeleted: schema.locations.isDeleted
      })
      .from(schema.locations)
      .where(eq(schema.locations.isDeleted, 0))
      .orderBy(asc(schema.locations.name))
      .all();

    const locations = results.map((r) => ({
      ...r,
      id: r.id || undefined,
      isDeleted: Number(r.isDeleted || 0)
    }));

    return c.json({ locations: locations as LocationInput[] } satisfies ListLocationsSuccess, 200);
});

locationsRouter.openapi(adminListLocationsRoute, async (c) => {
    const db = getDb(c);
    const results = await db.select({
        id: schema.locations.id,
        name: schema.locations.name,
        address: schema.locations.address,
        maps_url: schema.locations.mapsUrl,
        isDeleted: schema.locations.isDeleted
      })
      .from(schema.locations)
      .orderBy(asc(schema.locations.name))
      .all();

    const locations = results.map((r) => ({
      ...r,
      id: r.id || undefined,
      isDeleted: Number(r.isDeleted || 0)
    }));

    return c.json({ locations: locations as LocationInput[] } satisfies AdminListLocationsSuccess, 200);
});

locationsRouter.openapi(saveLocationRoute, async (c) => {
    const validatedData = c.req.valid("json");
    const db = getDb(c);
    const id = validatedData.id || crypto.randomUUID();

    await db.insert(schema.locations)
      .values({
        id,
        name: validatedData.name,
        address: validatedData.address,
        mapsUrl: validatedData.mapsUrl || null,
        isDeleted: validatedData.isDeleted || 0,
      })
      .onConflictDoUpdate({
        target: schema.locations.id,
        set: {
          name: validatedData.name,
          address: validatedData.address,
          mapsUrl: validatedData.mapsUrl || null,
          isDeleted: validatedData.isDeleted || 0,
        }
      })
      .run();

    c.executionCtx.waitUntil(logAuditAction(c, "SAVE_LOCATION", "locations", id, `Saved location: ${validatedData.name}`));
    return c.json({ success: true, id } satisfies SaveLocationSuccess, 200);
});

locationsRouter.openapi(deleteLocationRoute, async (c) => {
    const { id } = c.req.valid("param");
    const db = getDb(c);
    await db.update(schema.locations)
      .set({ isDeleted: 1 })
      .where(eq(schema.locations.id, id))
      .run();
    c.executionCtx.waitUntil(logAuditAction(c, "delete_location", "locations", id, "Location soft-deleted"));
    return c.json({ success: true } satisfies DeleteLocationSuccess, 200);
});

export default locationsRouter;
