import { typedHandler } from "../utils/handler";
import { OpenAPIHono } from "@hono/zod-openapi";

import { eq, asc } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { z } from "zod";
import { DB } from "../../../shared/schemas/database";
import { 
  locationSchema,
  listLocationsRoute,
  adminListLocationsRoute,
  saveLocationRoute,
  deleteLocationRoute
} from "../../../shared/routes/locations";
import { AppEnv, ensureAdmin, logAuditAction } from "../middleware";
import { edgeCacheMiddleware } from "../middleware/cache";



type LocationInput = z.infer<typeof locationSchema>;

export const locationsRouter = new OpenAPIHono<AppEnv>();

// Apply caching to public locations list
locationsRouter.use("/", edgeCacheMiddleware(180, 60, 300));

locationsRouter.use("/admin/*", ensureAdmin);

locationsRouter.openapi(listLocationsRoute, typedHandler<typeof listLocationsRoute>(async (c) => {
  try {
    const db = c.get("db") as any;
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

    const locations = results.map((r: any) => ({
      ...r,
      id: r.id || undefined,
      is_deleted: Number(r.is_deleted || 0)
    }));

    return c.json({ locations: locations as LocationInput[] }, 200);
  } catch (e) {
    console.error("LIST_LOCATIONS ERROR", e);
    return c.json({ error: "Failed to fetch locations" }, 500);
  }
}));

locationsRouter.openapi(adminListLocationsRoute, typedHandler<typeof adminListLocationsRoute>(async (c) => {
  try {
    const db = c.get("db") as any;
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

    const locations = results.map((r: any) => ({
      ...r,
      id: r.id || undefined,
      is_deleted: Number(r.is_deleted || 0)
    }));

    return c.json({ locations: locations as LocationInput[] }, 200);
  } catch (e) {
    console.error("ADMIN_LIST_LOCATIONS ERROR", e);
    return c.json({ error: "Failed to fetch locations" }, 500);
  }
}));

locationsRouter.openapi(saveLocationRoute, typedHandler<typeof saveLocationRoute>(async (c) => {
  try {
    const validatedData = c.req.valid("json");
    const db = c.get("db") as any;
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
  } catch (e) {
    console.error("SAVE_LOCATION ERROR", e);
    return c.json({ error: "Failed to save location", success: false }, 500);
  }
}));

locationsRouter.openapi(deleteLocationRoute, typedHandler<typeof deleteLocationRoute>(async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = c.get("db") as any;
    await db.update(schema.locations)
      .set({ isDeleted: 1 })
      .where(eq(schema.locations.id, id))
      .run();
    c.executionCtx.waitUntil(logAuditAction(c, "delete_location", "locations", id, "Location soft-deleted"));
    return c.json({ success: true }, 200);
  } catch (e) {
    console.error("DELETE_LOCATION ERROR", e);
    return c.json({ error: "Failed to delete location", success: false }, 500);
  }
}));

export default locationsRouter;
