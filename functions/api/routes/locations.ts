import { Hono } from "hono";
import { Kysely } from "kysely";
import { DB } from "../../../src/schemas/database";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { locationContract } from "../../../src/schemas/contracts/locationContract";
import { AppEnv, ensureAdmin, logAuditAction } from "../middleware";

const s = initServer<AppEnv>();
export const locationsRouter = new Hono<AppEnv>();

const locationsTsRestRouter: any = s.router(locationContract as any, {
    list: async (_: any, c: any) => {
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

      return { status: 200 as const, body: { locations: locations as any[] } };
    } catch {
      return { status: 200 as const, body: { locations: [] } };
    }
  },
    adminList: async (_: any, c: any) => {
    try {
                  const db = c.get("db") as Kysely<DB>;
      const results = await db.selectFrom("locations")
        .selectAll()
        .orderBy("name", "asc")
        .execute();

      const locations = results.map(r => ({
        ...r,
        id: r.id || undefined,
        is_deleted: Number(r.is_deleted || 0)
      }));

      return { status: 200 as const, body: { locations: locations as any[] } };
    } catch {
      return { status: 200 as const, body: { locations: [] } };
    }
  },
    save: async ({ body }: { body: any }, c: any) => {
    try {
                  const db = c.get("db") as Kysely<DB>;
      const id = body.id || crypto.randomUUID();
      
      await db.insertInto("locations")
        .values({
          id,
          name: body.name,
          address: body.address,
          maps_url: body.maps_url || null,
          is_deleted: body.is_deleted || 0,
        })
        .onConflict(oc => oc.column("id").doUpdateSet({
          name: body.name,
          address: body.address,
          maps_url: body.maps_url || null,
          is_deleted: body.is_deleted || 0,
        }))
        .execute();

      c.executionCtx.waitUntil(logAuditAction(c, "SAVE_LOCATION", "locations", id, `Saved location: ${body.name}`));
      return { status: 200 as const, body: { success: true, id } };
    } catch {
      return { status: 200 as const, body: { success: false } };
    }
  },
    delete: async ({ params }: { params: any }, c: any) => {
    try {
                  const db = c.get("db") as Kysely<DB>;
      await db.updateTable("locations")
        .set({ is_deleted: 1 })
        .where("id", "=", params.id)
        .execute();
      c.executionCtx.waitUntil(logAuditAction(c, "delete_location", "locations", params.id, "Location soft-deleted"));
      return { status: 200 as const, body: { success: true } };
    } catch {
      return { status: 200 as const, body: { success: false } };
    }
  },
} as any);

locationsRouter.use("/admin/*", ensureAdmin);
createHonoEndpoints(locationContract, locationsTsRestRouter, locationsRouter);

export default locationsRouter;
