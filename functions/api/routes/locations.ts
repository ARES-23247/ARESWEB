/* eslint-disable @typescript-eslint/no-explicit-any -- ts-rest handler input validated by contract library */
import { ServerInferRequest } from "../../../shared/types/api";
import { Hono } from "hono";
import { Kysely } from "kysely";
import { z } from "zod";
import { DB } from "../../../shared/schemas/database";
import { createHonoEndpoints } from "ts-rest-hono";
import { locationContract, locationSchema } from "../../../shared/schemas/contracts/locationContract";
import { AppEnv, ensureAdmin, logAuditAction, s } from "../middleware";
import type { HonoContext } from "@shared/types/api";
 

// IN-01: Type inference for location schema
type LocationInput = z.infer<typeof locationSchema>;


export const locationsRouter = new Hono<AppEnv>();


const locationsHandlers: any = {
  list: async (input: ServerInferRequest<typeof locationContract["list"]>, c: HonoContext) => {
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

      // IN-01: Cast to LocationInput[] instead of any[]
      return { status: 200 as const, body: { locations: locations as LocationInput[] } };
    } catch (e) {
      console.error("LIST_LOCATIONS ERROR", e);
      return { status: 500 as const, body: { error: "Failed to fetch locations" } };
    }
  },
    adminList: async (input: ServerInferRequest<typeof locationContract["adminList"]>, c: HonoContext) => {
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

      // IN-01: Cast to LocationInput[] instead of any[]
      return { status: 200 as const, body: { locations: locations as LocationInput[] } };
    } catch (e) {
      console.error("ADMIN_LIST_LOCATIONS ERROR", e);
      return { status: 500 as const, body: { error: "Failed to fetch locations" } };
    }
  },
    save: async (input: ServerInferRequest<typeof locationContract["save"]>, c: HonoContext) => {
    try {
      // Validate input against schema before database insertion
      const validationResult = locationSchema.safeParse(input.body);
      if (!validationResult.success) {
        return {
          status: 400 as const,
          body: {
            error: "Invalid input: " + validationResult.error.issues.map(i => i.message).join(", ")
          }
        };
      }

      const db = c.get("db") as Kysely<DB>;
      const validatedData = validationResult.data;
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
      return { status: 200 as const, body: { success: true, id } };
    } catch (e) {
      console.error("SAVE_LOCATION ERROR", e);
      return { status: 500 as const, body: { error: "Failed to save location", success: false } };
    }
  },
    delete: async (input: ServerInferRequest<typeof locationContract["delete"]>, c: HonoContext) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      await db.updateTable("locations")
        .set({ is_deleted: 1 })
        .where("id", "=", input.params.id)
        .execute();
      c.executionCtx.waitUntil(logAuditAction(c, "delete_location", "locations", input.params.id, "Location soft-deleted"));
      return { status: 200 as const, body: { success: true } };
    } catch (e) {
      console.error("DELETE_LOCATION ERROR", e);
      return { status: 500 as const, body: { error: "Failed to delete location", success: false } };
    }
  },
};
const locationsTsRestRouter = s.router(locationContract, locationsHandlers as any);

locationsRouter.use("/admin/*", ensureAdmin);
createHonoEndpoints(
  locationContract,
  locationsTsRestRouter,
  locationsRouter,
  {
    responseValidation: true,
    responseValidationErrorHandler: (err, _c) => {
      console.error('[Contract] Response validation failed:', err.cause);
      return { error: { message: 'Internal server error' }, status: 500 };
    }
  }
);


export default locationsRouter;

