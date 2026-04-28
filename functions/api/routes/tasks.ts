import { Hono, Context } from "hono";
import { Kysely, sql } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { taskContract } from "../../../shared/schemas/contracts/taskContract";
import { AppEnv, ensureAuth, getSessionUser, rateLimitMiddleware, getSocialConfig } from "../middleware";

import { sendZulipMessage } from "../../utils/zulipSync";
import { siteConfig } from "../../utils/site.config";

const s = initServer<AppEnv>();
export const tasksRouter = new Hono<AppEnv>();

const taskHandlers = {
  list: async ({ query }: { query: any }, c: Context<AppEnv>): Promise<any> => {
    try {
      const db = c.get("db") as Kysely<DB>;
      let q = db.selectFrom("tasks as t")
        .leftJoin("user_profiles as cp", "t.created_by", "cp.user_id")
        .select([
          "t.id", "t.title", "t.description", "t.status", "t.priority",
          "t.sort_order", "t.created_by", "t.due_date",
          "t.created_at", "t.updated_at",
          "cp.nickname as creator_name",
          // Aggregate assignees using a subquery and JSON aggregation
          (eb) => eb.selectFrom("task_assignments as ta")
            .leftJoin("user_profiles as up", "ta.user_id", "up.user_id")
            .select(sql<string>`json_group_array(json_object('id', ta.user_id, 'nickname', up.nickname))`.as("assignees"))
            .whereRef("ta.task_id", "=", "t.id")
            .as("assignees_json")
        ])
        .orderBy("t.sort_order", "asc")
        .orderBy("t.created_at", "desc");

      if (query?.status) {
        q = q.where("t.status", "=", query.status);
      }

      const results = await q.execute();

      const tasks = results.map(r => {
        let assignees = [];
        try {
          assignees = r.assignees_json ? JSON.parse(r.assignees_json) : [];
          // Filter out null results from left join if any
          assignees = assignees.filter((a: any) => a.id !== null);
        } catch (e) {
          console.error("Failed to parse assignees JSON", e);
        }

        return {
          id: String(r.id),
          title: String(r.title),
          description: r.description || null,
          status: String(r.status || "todo"),
          priority: String(r.priority || "normal"),
          sort_order: Number(r.sort_order || 0),
          assignees,
          created_by: String(r.created_by),
          creator_name: r.creator_name || null,
          due_date: r.due_date || null,
          created_at: String(r.created_at),
          updated_at: String(r.updated_at),
          // Backward compatibility
          assigned_to: assignees.length > 0 ? assignees[0].id : null,
          assignee_name: assignees.length > 0 ? assignees[0].nickname : null,
        };
      });

      return { status: 200, body: { tasks } };
    } catch (err) {
      console.error("[Tasks] List error:", err);
      return { status: 500, body: { error: "Failed to fetch tasks" } };
    }
  },

  create: async ({ body }: { body: any }, c: Context<AppEnv>): Promise<any> => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401, body: { error: "Unauthorized" } };

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
          created_by: user.id,
          due_date: body.due_date || null,
          created_at: now,
          updated_at: now,
        })
        .execute();

      if (body.assignees && body.assignees.length > 0) {
        const assignments = body.assignees.map((userId: string) => ({
          task_id: id,
          user_id: userId
        }));
        await db.insertInto("task_assignments").values(assignments).execute();
      }

      await db.insertInto("audit_log").values({
        id: crypto.randomUUID(),
        actor: user.id,
        action: "create_task",
        resource_type: "task",
        resource_id: id,
        details: `Created task: ${body.title} with ${body.assignees?.length || 0} assignees`,
        created_at: now,
      }).execute();

      // Fetch assignee names for the response
      const assigneeProfiles = body.assignees && body.assignees.length > 0
        ? await db.selectFrom("user_profiles")
            .select(["user_id as id", "nickname"])
            .where("user_id", "in", body.assignees)
            .execute()
        : [];

      const task = {
        id,
        title: body.title,
        description: body.description || null,
        status: body.status || "todo",
        priority: body.priority || "normal",
        sort_order: 0,
        assignees: assigneeProfiles,
        created_by: user.id,
        creator_name: user.nickname || user.name || null,
        due_date: body.due_date || null,
        created_at: now,
        updated_at: now,
        assigned_to: body.assignees?.[0] || null,
        assignee_name: assigneeProfiles[0]?.nickname || null,
      };

      if (body.assignees && body.assignees.length > 0) {
        try {
          const users = await db.selectFrom("user").select("email").where("id", "in", body.assignees).execute();
          const emails = users.map(u => u.email).filter(Boolean);
          if (emails.length > 0) {
            const env = await getSocialConfig(c);
            for (const email of emails) {
              await sendZulipMessage(env, email, null, `You have been assigned a new task: **${body.title}**\n\n[Open Task Dashboard](${siteConfig.urls.base}/dashboard?tab=tasks)`, "private").catch(() => {});
            }
          }
        } catch (e) {
          console.error("Zulip notification fail", e);
        }
      }

      // Create a Zulip discussion thread for this task in the kanban stream
      c.executionCtx.waitUntil((async () => {
        try {
          const env = await getSocialConfig(c);
          const assigneeNames = assigneeProfiles.map((a: any) => a.nickname || "Unknown").join(", ");
          const taskUrl = `${siteConfig.urls.base}/dashboard?tab=tasks`;
          const threadContent = [
            `📋 **New Task Created** by ${user.nickname || user.name || "ARES Member"}`,
            ``,
            `**Priority:** ${(body.priority || "normal").toUpperCase()}`,
            body.description ? `**Description:** ${body.description}` : null,
            assigneeProfiles.length > 0 ? `**Assigned to:** ${assigneeNames}` : null,
            body.due_date ? `**Due:** ${body.due_date}` : null,
            ``,
            `[Open Task Board](${taskUrl})`,
          ].filter(Boolean).join("\n");
          await sendZulipMessage(env, "kanban", body.title, threadContent);
        } catch (e) {
          console.error("[Tasks:ZulipThread] Error creating discussion thread", e);
        }
      })());

      return { status: 200, body: { success: true, task } };
    } catch (err) {
      console.error("[Tasks] Create error:", err);
      return { status: 500, body: { error: "Failed to create task" } };
    }
  },

  reorder: async ({ body }: { body: any }, c: Context<AppEnv>): Promise<any> => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401, body: { error: "Unauthorized" } };

      const now = new Date().toISOString();
      
      await Promise.all(body.items.map((item: any) =>
        db.updateTable("tasks")
          .set({ status: item.status, sort_order: item.sort_order, updated_at: now })
          .where("id", "=", item.id)
          .execute()
      ));

      c.executionCtx.waitUntil(db.insertInto("audit_log").values({
        id: crypto.randomUUID(),
        actor: user.id,
        action: "reorder_tasks",
        resource_type: "task",
        resource_id: "multiple",
        details: `Reordered ${body.items.length} tasks`,
        created_at: now,
      }).execute());

      return { status: 200, body: { success: true } };
    } catch (err) {
      console.error("[Tasks] Reorder error:", err);
      return { status: 500, body: { error: "Failed to reorder tasks" } };
    }
  },

  update: async ({ params, body }: { params: any, body: any }, c: Context<AppEnv>): Promise<any> => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401, body: { error: "Unauthorized" } };

      const existing = await db.selectFrom("tasks")
        .select(["id", "title", "created_by"])
        .where("id", "=", params.id)
        .executeTakeFirst();
      
      if (!existing) return { status: 404, body: { error: "Task not found" } };

      const isAdmin = user.role === "admin";
      const isOwner = existing.created_by === user.id;

      if (!isAdmin && !isOwner) {
        return { status: 403, body: { error: "You are not authorized to update this task" } };
      }

      const updates: any = { updated_at: new Date().toISOString() };
      if (body.title !== undefined) updates.title = body.title;
      if (body.description !== undefined) updates.description = body.description;
      if (body.status !== undefined) updates.status = body.status;
      if (body.priority !== undefined) updates.priority = body.priority;
      if (body.due_date !== undefined) updates.due_date = body.due_date;
      if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

      await db.updateTable("tasks")
        .set(updates)
        .where("id", "=", params.id)
        .execute();

      if (body.assignees !== undefined) {
        // Sync assignments: delete and re-insert
        await db.deleteFrom("task_assignments").where("task_id", "=", params.id).execute();
        if (body.assignees && body.assignees.length > 0) {
          const assignments = body.assignees.map((userId: string) => ({
            task_id: params.id,
            user_id: userId
          }));
          await db.insertInto("task_assignments").values(assignments).execute();
          
          // Notify new assignees (simplified logic: notify all currently assigned)
          try {
            const users = await db.selectFrom("user").select("email").where("id", "in", body.assignees).execute();
            const emails = users.map(u => u.email).filter(Boolean);
            if (emails.length > 0) {
              const env = await getSocialConfig(c);
              for (const email of emails) {
                await sendZulipMessage(env, email, null, `Task updated: **${updates.title || existing.title}**\nYou are assigned to this task.\n\n[Open Task Dashboard](${siteConfig.urls.base}/dashboard?tab=tasks)`, "private").catch(() => {});
              }
            }
          } catch (e) {
            console.error("Zulip update notification fail", e);
          }
        }
      }

      await db.insertInto("audit_log").values({
        id: crypto.randomUUID(),
        actor: user.id,
        action: "update_task",
        resource_type: "task",
        resource_id: params.id,
        details: "Updated task and assignments",
        created_at: new Date().toISOString(),
      }).execute();

      return { status: 200, body: { success: true } };
    } catch (err) {
      console.error("[Tasks] Update error:", err);
      return { status: 500, body: { error: "Failed to update task" } };
    }
  },

  delete: async ({ params }: { params: any }, c: Context<AppEnv>): Promise<any> => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401, body: { error: "Unauthorized" } };

      const existing = await db.selectFrom("tasks")
        .select(["created_by"])
        .where("id", "=", params.id)
        .executeTakeFirst();
      
      if (!existing) return { status: 404, body: { error: "Task not found" } };

      const isAdmin = user.role === "admin";
      const isOwner = existing.created_by === user.id;

      if (!isAdmin && !isOwner) {
        return { status: 403, body: { error: "You are not authorized to delete this task" } };
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

      return { status: 200, body: { success: true } };
    } catch (err) {
      console.error("[Tasks] Delete error:", err);
      return { status: 500, body: { error: "Failed to delete task" } };
    }
  },
};

tasksRouter.use("*", ensureAuth);
tasksRouter.use("*", rateLimitMiddleware(30, 60));

const tasksTsRestRouter = s.router(taskContract, taskHandlers as any);

createHonoEndpoints(taskContract, tasksTsRestRouter, tasksRouter);
export default tasksRouter;
