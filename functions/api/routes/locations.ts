import { typedHandler } from "../utils/handler";
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

export const locationsRouter = new OpenAPIHono<AppEnv>();

// Apply caching to public locations list
locationsRouter.use("/", edgeCacheMiddleware(180, 60, 300));

locationsRouter.use("/admin/*", ensureAdmin);

locationsRouter.openapi(listLocationsRoute, typedHandler<typeof listLocationsRoute>(async (c) => {
    const db = getDb(c);
    const results = await db.select({
        id: schema.locations.id,
        name: schema.locations.name,
        address: schema.locations.address,
        maps_url: schema.locations.mapsUrl,
        is_deleted: schema.locations.isDeleted
      })
      .from(schema.locations)
      .where(eq(schema.locations.isDeleted, 0))
      .orderBy(asc(schema.locations.name))
      .all();

    const locations = results.map((r) => ({
      ...r,
      id: r.id || undefined,
      is_deleted: Number(r.is_deleted || 0)
    }));

    return c.json({ locations: locations as LocationInput[] }, 200);
}));

locationsRouter.openapi(adminListLocationsRoute, typedHandler<typeof adminListLocationsRoute>(async (c) => {
    const db = getDb(c);
    const results = await db.select({
        id: schema.locations.id,
        name: schema.locations.name,
        address: schema.locations.address,
        maps_url: schema.locations.mapsUrl,
        is_deleted: schema.locations.isDeleted
      })
      .from(schema.locations)
      .orderBy(asc(schema.locations.name))
      .all();

    const locations = results.map((r) => ({
      ...r,
      id: r.id || undefined,
      is_deleted: Number(r.is_deleted || 0)
    }));

    return c.json({ locations: locations as LocationInput[] }, 200);
}));

locationsRouter.openapi(saveLocationRoute, typedHandler<typeof saveLocationRoute>(async (c) => {
    const validatedData = c.req.valid("json");
    const db = getDb(c);
    const id = validatedData.id || crypto.randomUUID();

    await db.insert(schema.locations)
      .values({
        id,
        name: validatedData.name,
        address: validatedData.address,
        mapsUrl: validatedData.maps_url || null,
        isDeleted: validatedData.is_deleted || 0,
      })
      .onConflictDoUpdate({
        target: schema.locations.id,
        set: {
          name: validatedData.name,
          address: validatedData.address,
          mapsUrl: validatedData.maps_url || null,
          isDeleted: validatedData.is_deleted || 0,
        }
      })
      .run();

    c.executionCtx.waitUntil(logAuditAction(c, "SAVE_LOCATION", "locations", id, `Saved location: ${validatedData.name}`));
    return c.json({ success: true, id }, 200);
}));

locationsRouter.openapi(deleteLocationRoute, typedHandler<typeof deleteLocationRoute>(async (c) => {
    const { id } = c.req.valid("param");
    const db = getDb(c);
    await db.update(schema.locations)
      .set({ isDeleted: 1 })
      .where(eq(schema.locations.id, id))
      .run();
    c.executionCtx.waitUntil(logAuditAction(c, "delete_location", "locations", id, "Location soft-deleted"));
    return c.json({ success: true }, 200);
}));

export default locationsRouter;
