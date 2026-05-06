import { Context } from "hono";
import { OpenAPIHono } from "@hono/zod-openapi";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { AppEnv, ensureAdmin, logAuditAction } from "../middleware";
import { getAwardsRoute, saveAwardRoute, deleteAwardRoute } from "../../../shared/routes/awards";

export const awardsRouter = new OpenAPIHono<AppEnv>();

awardsRouter.openapi(getAwardsRoute, async (c: Context<AppEnv>) => {
  try {
    const db = c.get("db") as Kysely<DB>;
    const { limit = 50, offset = 0 } = c.req.valid('query');
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

    return c.json({ awards }, 200);
  } catch (e) {
    console.error("GET_AWARDS ERROR", e);
    return c.json({ error: "Failed to fetch awards", code: "INTERNAL_SERVER_ERROR" }, 500);
  }
});

awardsRouter.use("/admin/*", ensureAdmin);

awardsRouter.openapi(saveAwardRoute, async (c: Context<AppEnv>) => {
  try {
    const validatedData = c.req.valid('json');
    const db = c.get("db") as Kysely<DB>;
    const { id, title, year, event_name, description, image_url, season_id } = validatedData;

    let finalId: string | undefined = id;
    let exists = false;
    if (id) {
      const numericId = Number(id);
      if (isNaN(numericId) || numericId <= 0) {
        return c.json({ error: "Invalid award ID", code: "BAD_REQUEST" }, 400);
      }
      const row = await db.selectFrom("awards").select("id").where("id", "=", numericId).executeTakeFirst();
      if (row) {
        exists = true;
        finalId = String(row.id);
      }
    }

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
        return c.json({ error: "Invalid award ID for update", code: "BAD_REQUEST" }, 400);
      }
      await db.updateTable("awards").set(values).where("id", "=", updateId).execute();
      c.executionCtx.waitUntil(logAuditAction(c, "award_updated", "awards", finalId, `Award "${title}" (${year}) updated`));
    } else {
      try {
        const res = await db.insertInto("awards").values(values).executeTakeFirst();
        const newId = res && "insertId" in res ? String(res.insertId) : "new";
        c.executionCtx.waitUntil(logAuditAction(c, "award_created", "awards", newId, `Award "${title}" (${year}) created`));
        finalId = newId;
      } catch (insertError: unknown) {
        const err = insertError as Error;
        if (err?.message?.includes('UNIQUE') || err?.message?.includes('constraint')) {
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

    return c.json({ success: true, id: finalId! }, 200);
  } catch (e) {
    console.error("SAVE_AWARD ERROR", e);
    return c.json({ error: "Failed to save award", code: "INTERNAL_SERVER_ERROR" }, 500);
  }
});

awardsRouter.openapi(deleteAwardRoute, async (c: Context<AppEnv>) => {
  try {
    const db = c.get("db") as Kysely<DB>;
    const params = c.req.valid('param');
    const numericId = Number(params.id);
    if (isNaN(numericId) || numericId <= 0) {
      return c.json({ error: "Invalid award ID", code: "BAD_REQUEST" }, 400);
    }
    await db.updateTable("awards").set({ is_deleted: 1 }).where("id", "=", numericId).execute();
    c.executionCtx.waitUntil(logAuditAction(c, "award_deleted", "awards", params.id, "Award soft-deleted"));
    return c.json({ success: true }, 200);
  } catch (e) {
    console.error("DELETE_AWARD ERROR", e);
    return c.json({ error: "Failed to delete award", code: "INTERNAL_SERVER_ERROR" }, 500);
  }
});

export default awardsRouter;
