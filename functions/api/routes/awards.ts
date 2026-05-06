/* eslint-disable @typescript-eslint/no-explicit-any -- ts-rest handler input validated by contract library */
import { Hono } from "hono";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { AppEnv, ensureAdmin, logAuditAction, s } from "../middleware";
import { createHonoEndpoints } from "ts-rest-hono";
import { awardContract } from "../../../shared/schemas/contracts/awardContract";
import type { HonoContext } from "@shared/types/api";

// Validation schema for saveAward (derived from contract)
const saveAwardSchema = awardContract.saveAward.body;

export const awardsRouter = new Hono<AppEnv>();

import { ServerInferRequest } from "../../../shared/types/api";

const awardsHandlers = {
  getAwards: async (input: ServerInferRequest<typeof awardContract["getAwards"]>, c: HonoContext) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const { limit = 50, offset = 0 } = input.query;
      const results = await db.selectFrom("awards")
        .select(["id", "title", "date", "event_name", "description", "icon_type as image_url", "season_id", "created_at"])
        .where("is_deleted", "=", 0)
        .orderBy("date", "desc")
        .orderBy("title", "asc")
        .limit(limit || 50)
        .offset(offset || 0)
        .execute();
      
      const awards = results.map(a => ({
        id: String(a.id),
        title: a.title,
        year: Number(a.date),
        event_name: a.event_name || null,
        description: a.description || null,
        image_url: a.image_url || "trophy",
        season_id: a.season_id ? Number(a.season_id) : null,
        created_at: a.created_at || new Date().toISOString(),
        updated_at: a.created_at || new Date().toISOString()
      }));

      return { status: 200 as const, body: { awards } };
    } catch (e) {
      console.error("GET_AWARDS ERROR", e);
      return { status: 500 as const, body: { error: "Failed to fetch awards" } };
    }
  },
  saveAward: async (input: ServerInferRequest<typeof awardContract["saveAward"]>, c: HonoContext) => {
    try {
      // Validate input against schema
      const validationResult = saveAwardSchema.safeParse(input.body);
      if (!validationResult.success) {
        return { status: 400 as const, body: { error: "Invalid input", details: validationResult.error.flatten() } };
      }
      const validatedData = validationResult.data;

      const db = c.get("db") as Kysely<DB>;
      const { id, title, year, event_name, description, image_url, season_id } = validatedData;

      let finalId: string | undefined = id;
      let exists = false;
      if (id) {
        const numericId = Number(id);
        if (isNaN(numericId) || numericId <= 0) {
          return { status: 400 as const, body: { error: "Invalid award ID", success: false } };
        }
        const row = await db.selectFrom("awards").select("id").where("id", "=", numericId).executeTakeFirst();
        if (row) {
          exists = true;
          finalId = String(row.id);
        }
      }

      // CR-06 FIX: Reduce race condition window by checking duplicates immediately before insert
      // Note: Full atomic upsert requires database unique constraint on (title, date, event_name)
      if (!exists) {
        const duplicate = await db.selectFrom("awards")
          .select("id")
          .where("title", "=", title)
          .where("date", "=", String(year))
          .where("event_name", "=", event_name || "")
          .where("is_deleted", "=", 0)
          .executeTakeFirst();
        if (duplicate) {
          exists = true;
          finalId = String(duplicate.id);
        }
      }

      const values = {
        title,
        date: String(year),
        event_name: event_name || "",
        description: description || null,
        icon_type: image_url || "trophy",
        season_id: season_id || null,
        is_deleted: 0
      } as const;

      if (exists && finalId) {
        const updateId = Number(finalId);
        if (isNaN(updateId) || updateId <= 0) {
          return { status: 400 as const, body: { error: "Invalid award ID for update", success: false } };
        }
        await db.updateTable("awards").set(values).where("id", "=", updateId).execute();
        c.executionCtx.waitUntil(logAuditAction(c, "award_updated", "awards", finalId, `Award "${title}" (${year}) updated`));
      } else {
        // Attempt insert with duplicate handling for race condition
        try {
          const res = await db.insertInto("awards").values({ ...values, id: undefined }).executeTakeFirst();
          const newId = res && "insertId" in res ? String(res.insertId) : "new";
          c.executionCtx.waitUntil(logAuditAction(c, "award_created", "awards", newId, `Award "${title}" (${year}) created`));
          finalId = newId;
        } catch (insertError: unknown) {
          const err = insertError as Error;
          // Check if this is a duplicate constraint violation (race condition)
          if (err?.message?.includes('UNIQUE') || err?.message?.includes('constraint')) {
            // Retry by fetching the duplicate that was just created
            const duplicate = await db.selectFrom("awards")
              .select("id")
              .where("title", "=", title)
              .where("date", "=", String(year))
              .where("event_name", "=", event_name || "")
              .where("is_deleted", "=", 0)
              .executeTakeFirst();
            if (duplicate) {
              finalId = String(duplicate.id);
              c.executionCtx.waitUntil(logAuditAction(c, "award_race_condition_handled", "awards", finalId, `Award "${title}" (${year}) race condition - returned existing record`));
            } else {
              throw insertError;
            }
          } else {
            throw insertError;
          }
        }
      }

      return { status: 200 as const, body: { success: true, id: finalId! } };
    } catch (e) {
      console.error("SAVE_AWARD ERROR", e);
      return { status: 500 as const, body: { error: "Failed to save award", success: false } };
    }
  },
  deleteAward: async (input: ServerInferRequest<typeof awardContract["deleteAward"]>, c: HonoContext) => {

    try {
      const db = c.get("db") as Kysely<DB>;
      const numericId = Number(input.params.id);
      if (isNaN(numericId) || numericId <= 0) {
        return { status: 400 as const, body: { error: "Invalid award ID", success: false } };
      }
      await db.updateTable("awards").set({ is_deleted: 1 }).where("id", "=", numericId).execute();
      c.executionCtx.waitUntil(logAuditAction(c, "award_deleted", "awards", input.params.id, "Award soft-deleted"));
      return { status: 200 as const, body: { success: true } };
    } catch (e) {
      console.error("DELETE_AWARD ERROR", e);
      return { status: 500 as const, body: { error: "Failed to delete award", success: false } };
    }
  },
};

const awardsTsRestRouter = s.router(awardContract, awardsHandlers as any);

awardsRouter.use("/admin/*", ensureAdmin);
createHonoEndpoints(
  awardContract,
  awardsTsRestRouter,
  awardsRouter,
  {
    responseValidation: true,
    responseValidationErrorHandler: (err, _c) => {
      console.error('[Contract] Response validation failed:', err.cause);
      return { error: { message: 'Internal server error' }, status: 500 };
    }
  }
);

export default awardsRouter;

