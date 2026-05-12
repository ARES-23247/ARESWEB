import { OpenAPIHono } from "@hono/zod-openapi";

import { eq, asc, or, isNull } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { z } from "zod";
import {
  locationSchema,
  listLocationsRoute,
  adminListLocationsRoute,
  saveLocationRoute,
  deleteLocationRoute
} from "../../../shared/routes/locations";
import { AppEnv, ensureAdmin, logAuditAction } from "../middleware";
import { edgeCacheMiddleware } from "../middleware/cache";
import { findMany, upsertOne, deleteOneAndReturn, logAudit } from "../utils/drizzle-helpers";




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
        const results = await findMany(c, schema.locations, {
          where: or(eq(schema.locations.isDeleted, 0), isNull(schema.locations.isDeleted)),
          orderBy: asc(schema.locations.name),
        });

        const locations = results.map((r) => ({
          ...r,
          id: r.id || undefined,
          isDeleted: Number(r.isDeleted || 0)
        }));

        return c.json({ locations: locations as LocationInput[] } satisfies ListLocationsSuccess, 200);
    })
    .openapi(adminListLocationsRoute, async (c) => {
        const results = await findMany(c, schema.locations, {
          orderBy: asc(schema.locations.name),
        });

        const locations = results.map((r) => ({
          ...r,
          id: r.id || undefined,
          isDeleted: Number(r.isDeleted || 0)
        }));

        return c.json({ locations: locations as LocationInput[] } satisfies AdminListLocationsSuccess, 200);
    })
    .openapi(saveLocationRoute, async (c) => {
        const validatedData = c.req.valid("json");
        const id = validatedData.id || crypto.randomUUID();

        await upsertOne(c, schema.locations, {
          id,
          name: validatedData.name,
          address: validatedData.address,
          mapsUrl: validatedData.mapsUrl || null,
          isDeleted: validatedData.isDeleted || 0,
        });

        logAudit(c, "SAVE_LOCATION", "locations", id, `Saved location: ${validatedData.name}`);
        return c.json({ success: true, id } satisfies SaveLocationSuccess, 200);
    })
    .openapi(deleteLocationRoute, async (c) => {
        const { id } = c.req.valid("param");
        await deleteOneAndReturn(c, schema.locations, id);
        logAudit(c, "delete_location", "locations", id, "Location permanently deleted");
        return c.json({ success: true } satisfies DeleteLocationSuccess, 200);
    });
export default locationsRouter;
