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
import { list, notDeleted } from "../../../src/db/query-helpers";




type LocationInput = z.infer<typeof locationSchema>;


type ListLocationsSuccess = z.infer<typeof listLocationsRoute.responses[200]["content"]["application/json"]["schema"]>;


type AdminListLocationsSuccess = z.infer<typeof adminListLocationsRoute.responses[200]["content"]["application/json"]["schema"]>;


type SaveLocationSuccess = z.infer<typeof saveLocationRoute.responses[200]["content"]["application/json"]["schema"]>;


type DeleteLocationSuccess = z.infer<typeof deleteLocationRoute.responses[200]["content"]["application/json"]["schema"]>;

const _locationsRouter = new OpenAPIHono<AppEnv>();


// Apply edge caching to public GET routes (non-admin, non-signups)
_locationsRouter.use("*", async (c, next) => {
  const path = c.req.path;
  if (c.req.method !== "GET" || path.includes("/admin/") || path.includes("/signups") || path.includes("/history")) {
    return next();
  }
  return edgeCacheMiddleware(180, 60, 300)(c, next);
});


// Apply caching to public locations list


_locationsRouter.use("/admin/*", ensureAdmin);

export const locationsRouter = _locationsRouter
    .openapi(listLocationsRoute, async (c) => {
        const db = getDb(c);
        const results = await list(db, schema.locations, {
            select: {
                id: schema.locations.id,
                name: schema.locations.name,
                address: schema.locations.address,
                mapsUrl: schema.locations.mapsUrl,
                isDeleted: schema.locations.isDeleted
            },
            where: notDeleted(schema.locations),
            orderBy: asc(schema.locations.name),
            useAll: true
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const locations = results.map((r: any) => ({
          ...r,
          id: r.id || undefined,
          isDeleted: Number(r.isDeleted || 0)
        }));

        return c.json({ locations: locations as LocationInput[] } satisfies ListLocationsSuccess, 200);
    })
    .openapi(adminListLocationsRoute, async (c) => {
        const db = getDb(c);
        const results = await list(db, schema.locations, {
            select: {
                id: schema.locations.id,
                name: schema.locations.name,
                address: schema.locations.address,
                mapsUrl: schema.locations.mapsUrl,
                isDeleted: schema.locations.isDeleted
            },
            orderBy: asc(schema.locations.name),
            useAll: true
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const locations = results.map((r: any) => ({
          ...r,
          id: r.id || undefined,
          isDeleted: Number(r.isDeleted || 0)
        }));

        return c.json({ locations: locations as LocationInput[] } satisfies AdminListLocationsSuccess, 200);
    })
    .openapi(saveLocationRoute, async (c) => {
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
    })
    .openapi(deleteLocationRoute, async (c) => {
        const { id } = c.req.valid("param");
        const db = getDb(c);
        await db.delete(schema.locations)
          .where(eq(schema.locations.id, id))
          .run();
        c.executionCtx.waitUntil(logAuditAction(c, "delete_location", "locations", id, "Location permanently deleted"));
        return c.json({ success: true } satisfies DeleteLocationSuccess, 200);
    });
export default locationsRouter;
