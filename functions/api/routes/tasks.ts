import { Hono } from "hono";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { taskContract } from "../../../shared/schemas/contracts/taskContract";
import { AppEnv, ensureAuth, getSessionUser, rateLimitMiddleware, getSocialConfig } from "../middleware";
import { sendZulipMessage } from "../../utils/zulipSync";
import { siteConfig } from "../../utils/site.config";

const s = initServer<AppEnv>();
export const tasksRouter = new Hono<AppEnv>();

const tasksTsRestRouter: any = s.router(taskContract as any, {
  list: async ({ query }: { query: any }, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      let q = db.selectFrom("tasks as t")
        .leftJoin("user_profiles as ap", "t.assigned_to", "ap.user_id")
        .leftJoin("user_profiles as cp", "t.created_by", "cp.user_id")
        .select([
          "t.id", "t.title", "t.description", "t.status", "t.priority",
          "t.sort_order", "t.assigned_to", "t.created_by", "t.due_date",
          "t.created_at", "t.updated_at",
          "ap.nickname as assignee_name",
          "cp.nickname as creator_name",
        ])
        .orderBy("t.sort_order", "asc")
        .orderBy("t.created_at", "desc");

      if (query?.status) {
        q = q.where("t.status", "=", query.status);
      }

      const results = await q.execute();

      const tasks = results.map(r => ({
        id: String(r.id),
        title: String(r.title),
        description: r.description || null,
        status: String(r.status || "todo"),
        priority: String(r.priority || "normal"),
        sort_order: Number(r.sort_order || 0),
        assigned_to: r.assigned_to || null,
        assignee_name: r.assignee_name || null,
        created_by: String(r.created_by),
        creator_name: r.creator_name || null,
        due_date: r.due_date || null,
        created_at: String(r.created_at),
        updated_at: String(r.updated_at),
      }));

      return { status: 200 as const, body: { tasks } };
    } catch (err) {
      console.error("[Tasks] List error:", err);
      return { status: 500 as const, body: { error: "Failed to fetch tasks" } };
    }
  },

  create: async ({ body }: { body: any }, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } };

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      await db.insertInto("tasks")
        .values({
          id,
          title: body.title,
          description: body.description || null,
          status: body.status || "todo",
          priority: body.priority || "normal",
          sort_order: 0,
          assigned_to: body.assigned_to || null,
          created_by: user.id,
          due_date: body.due_date || null,
          created_at: now,
          updated_at: now,
        })
        .execute();

      await db.insertInto("audit_log").values({
        id: crypto.randomUUID(),
        actor: user.id,
        action: "create_task",
        resource_type: "task",
        resource_id: id,
        details: `Created task: ${body.title}`,
        created_at: now,
      }).execute();

      const task = {
        id,
        title: body.title,
        description: body.description || null,
        status: body.status || "todo",
        priority: body.priority || "normal",
        sort_order: 0,
        assigned_to: body.assigned_to || null,
        assignee_name: null,
        created_by: user.id,
        creator_name: user.nickname || user.name || null,
        due_date: body.due_date || null,
        created_at: now,
        updated_at: now,
      };

      if (body.assigned_to) {
        try {
          const assignee = await db.selectFrom("user").select("email").where("id", "=", body.assigned_to).executeTakeFirst();
          if (assignee?.email) {
            const env = await getSocialConfig(c);
            await sendZulipMessage(env, assignee.email, null, `You have been assigned a new task: **${body.title}**\n\n[Open Task Dashboard](${siteConfig.urls.base}/dashboard?tab=tasks)`, "private");
          }
        } catch (e) {
          console.error("Zulip DM fail", e);
        }
      }

      return { status: 200 as const, body: { success: true, task } };
    } catch (err) {
      console.error("[Tasks] Create error:", err);
      return { status: 500 as const, body: { error: "Failed to create task" } };
    }
  },

  update: async ({ params, body }: { params: any; body: any }, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } };

      // Check task exists and authorization
      const existing = await db.selectFrom("tasks")
        .select(["id", "assigned_to", "title", "created_by"])
        .where("id", "=", params.id)
        .executeTakeFirst();
      
      if (!existing) return { status: 404 as const, body: { error: "Task not found" } };

      const isAdmin = user.role === "admin";
      const isOwner = existing.created_by === user.id;

      if (!isAdmin && !isOwner) {
        return { status: 403 as const, body: { error: "You are not authorized to update this task" } };
      }

      // Build update object dynamically
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.title !== undefined) updates.title = body.title;
      if (body.description !== undefined) updates.description = body.description;
      if (body.status !== undefined) updates.status = body.status;
      if (body.priority !== undefined) updates.priority = body.priority;
      if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to;
      if (body.due_date !== undefined) updates.due_date = body.due_date;
      if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

      await db.updateTable("tasks")
        .set(updates)
        .where("id", "=", params.id)
        .execute();

      await db.insertInto("audit_log").values({
        id: crypto.randomUUID(),
        actor: user.id,
        action: "update_task",
        resource_type: "task",
        resource_id: params.id,
        details: "Updated task",
        created_at: new Date().toISOString(),
      }).execute();

      if (body.assigned_to && body.assigned_to !== existing.assigned_to) {
        try {
          const assignee = await db.selectFrom("user").select("email").where("id", "=", body.assigned_to).executeTakeFirst();
          if (assignee?.email) {
            const env = await getSocialConfig(c);
            await sendZulipMessage(env, assignee.email, null, `You have been assigned to an existing task: **${updates.title || existing.title}**\n\n[Open Task Dashboard](${siteConfig.urls.base}/dashboard?tab=tasks)`, "private");
          }
        } catch (e) {
          console.error("Zulip DM fail", e);
        }
      }

      return { status: 200 as const, body: { success: true } };
    } catch (err) {
      console.error("[Tasks] Update error:", err);
      return { status: 500 as const, body: { error: "Failed to update task" } };
    }
  },

  reorder: async ({ body }: { body: any }, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } };

      const now = new Date().toISOString();
      for (const item of body.items) {
        await db.updateTable("tasks")
          .set({ status: item.status, sort_order: item.sort_order, updated_at: now })
          .where("id", "=", item.id)
          .execute();
      }

      await db.insertInto("audit_log").values({
        id: crypto.randomUUID(),
        actor: user.id,
        action: "reorder_tasks",
        resource_type: "task",
        resource_id: "multiple",
        details: `Reordered ${body.items.length} tasks`,
        created_at: now,
      }).execute();

      return { status: 200 as const, body: { success: true } };
    } catch (err) {
      console.error("[Tasks] Reorder error:", err);
      return { status: 500 as const, body: { error: "Failed to reorder tasks" } };
    }
  },

  delete: async ({ params }: { params: any }, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } };

      const existing = await db.selectFrom("tasks")
        .select(["created_by"])
        .where("id", "=", params.id)
        .executeTakeFirst();
      
      if (!existing) return { status: 404 as const, body: { error: "Task not found" } };

      const isAdmin = user.role === "admin";
      const isOwner = existing.created_by === user.id;

      if (!isAdmin && !isOwner) {
        return { status: 403 as const, body: { error: "You are not authorized to delete this task" } };
      }

      await db.deleteFrom("tasks")
        .where("id", "=", params.id)
        .execute();

      await db.insertInto("audit_log").values({
        id: crypto.randomUUID(),
        actor: user.id,
        action: "delete_task",
        resource_type: "task",
        resource_id: params.id,
        details: "Deleted task",
        created_at: new Date().toISOString(),
      }).execute();

      return { status: 200 as const, body: { success: true } };
    } catch (err) {
      console.error("[Tasks] Delete error:", err);
      return { status: 500 as const, body: { error: "Failed to delete task" } };
    }
  },
} as any);

// Middleware: all task endpoints require auth
tasksRouter.use("*", ensureAuth);
tasksRouter.use("*", rateLimitMiddleware(30, 60));

createHonoEndpoints(taskContract, tasksTsRestRouter, tasksRouter);
export default tasksRouter;
