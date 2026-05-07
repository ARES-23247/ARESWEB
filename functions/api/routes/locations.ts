import { typedHandler } from "../utils/handler";
import { OpenAPIHono } from "@hono/zod-openapi";

import { Kysely } from "kysely";
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
locationsRouter.use("/", edgeCacheMiddleware(300, 60));

locationsRouter.use("/admin/*", ensureAdmin);

locationsRouter.openapi(listLocationsRoute, typedHandler<typeof listLocationsRoute>(async (c) => {
  try {
    const db = c.get("db") as Kysely<DB>;
    const results = await db.selectFrom("locations")
      .select(["id", "name", "address", "maps_url", "is_deleted"])
      .where("is_deleted", "=", 0)
      .orderBy("name", "asc")
      .execute();

    const locations = results.map(r => ({
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
    const db = c.get("db") as Kysely<DB>;
    const results = await db.selectFrom("locations")
      .select(["id", "name", "address", "maps_url", "is_deleted"])
      .orderBy("name", "asc")
      .execute();

    const locations = results.map(r => ({
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
    const db = c.get("db") as Kysely<DB>;
    const id = validatedData.id || crypto.randomUUID();

    await db.insertInto("locations")
      .values({
        id,
        name: validatedData.name,
        address: validatedData.address,
        maps_url: validatedData.maps_url || null,
        is_deleted: validatedData.is_deleted || 0,
      })
      .onConflict(oc => oc.column("id").doUpdateSet({
        name: validatedData.name,
        address: validatedData.address,
        maps_url: validatedData.maps_url || null,
        is_deleted: validatedData.is_deleted || 0,
      }))
      .execute();

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
    const db = c.get("db") as Kysely<DB>;
    await db.updateTable("locations")
      .set({ is_deleted: 1 })
      .where("id", "=", id)
      .execute();
    c.executionCtx.waitUntil(logAuditAction(c, "delete_location", "locations", id, "Location soft-deleted"));
    return c.json({ success: true }, 200);
  } catch (e) {
    console.error("DELETE_LOCATION ERROR", e);
    return c.json({ error: "Failed to delete location", success: false }, 500);
  }
}));

export default locationsRouter;
