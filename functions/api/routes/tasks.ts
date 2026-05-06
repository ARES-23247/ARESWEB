/* eslint-disable @typescript-eslint/no-explicit-any -- ts-rest handler input validated by contract library */
import { ServerInferRequest } from "../../../shared/types/api";
import { Hono } from "hono";
import { Kysely, sql } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { createHonoEndpoints } from "ts-rest-hono";
import { taskContract } from "../../../shared/schemas/contracts/taskContract";
import { AppEnv, ensureAuth, getSessionUser, rateLimitMiddleware, getSocialConfig, originIntegrityMiddleware, s } from "../middleware";
import type { HonoContext } from "@shared/types/api";

import { sendZulipMessage } from "../../utils/zulipSync";
import { siteConfig } from "../../utils/site.config";
export const tasksRouter = new Hono<AppEnv>();


const tasksHandlers: any = {
  list: async (input: ServerInferRequest<typeof taskContract["list"]>, c: HonoContext) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      let q = db.selectFrom("tasks as t")
        .leftJoin("user_profiles as cp", "t.created_by", "cp.user_id")
        .select([
          "t.id", "t.title", "t.description", "t.status", "t.priority", "t.subteam",
          "t.sort_order", "t.created_by", "t.due_date",
          "t.zulip_stream", "t.zulip_topic",
          "t.parent_id", "t.time_spent_seconds",
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

      if (input.query?.status) {
        q = q.where("t.status", "=", input.query.status);
      }

      if (input.query?.parent_id !== undefined) {
        if (input.query.parent_id === "null") {
          q = q.where("t.parent_id", "is", null);
        } else {
          q = q.where("t.parent_id", "=", input.query.parent_id);
        }
      }

      const results = await q.execute();

      const tasks = results.map(r => {
        let assignees: Array<{ id: string; nickname: string | null }> = [];
        try {
          assignees = r.assignees_json ? JSON.parse(r.assignees_json) : [];
          // Filter out null results from left join if any
          assignees = assignees.filter((a: { id?: string | null }) => a.id !== null);
        } catch (e) {
          console.error("Failed to parse assignees JSON", e);
        }

        return {
          id: String(r.id),
          title: String(r.title),
          description: r.description || null,
          status: String(r.status || "todo"),
          priority: String(r.priority || "normal"),
          subteam: r.subteam ? String(r.subteam) : null,
          sort_order: Number(r.sort_order || 0),
          assignees,
          created_by: String(r.created_by),
          creator_name: r.creator_name || null,
          due_date: r.due_date || null,
          zulip_stream: r.zulip_stream ? String(r.zulip_stream) : null,
          zulip_topic: r.zulip_topic ? String(r.zulip_topic) : null,
          parent_id: r.parent_id ? String(r.parent_id) : null,
          time_spent_seconds: r.time_spent_seconds ? Number(r.time_spent_seconds) : 0,
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

  create: async (input: ServerInferRequest<typeof taskContract["create"]>, c: HonoContext) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401, body: { error: "Unauthorized" } };

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      await db.insertInto("tasks")
        .values({
          id,
          title: input.body.title,
          description: input.body.description || null,
          status: input.body.status || "todo",
          priority: input.body.priority || "normal",
          subteam: input.body.subteam || null,
          sort_order: 0,
          created_by: user.id,
          due_date: input.body.due_date || null,
          zulip_stream: "kanban",
          zulip_topic: `Task-${id.split("-")[0]}: ${input.body.title}`,
          parent_id: input.body.parent_id || null,
          time_spent_seconds: input.body.time_spent_seconds || 0,
          created_at: now,
          updated_at: now,
        })
        .execute();

      if (input.body.assignees && input.body.assignees.length > 0) {
        const assignments = input.body.assignees.map((userId: string) => ({
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
        details: `Created task: ${input.body.title} with ${input.body.assignees?.length || 0} assignees`,
        created_at: now,
      }).execute();

      // Fetch assignee names for the response
      const assigneeProfiles = input.body.assignees && input.body.assignees.length > 0
        ? await db.selectFrom("user_profiles")
            .select(["user_id as id", "nickname"])
            .where("user_id", "in", input.body.assignees)
            .execute()
        : [];

      const task = {
        id,
        title: input.body.title,
        description: input.body.description || null,
        status: input.body.status || "todo",
        priority: input.body.priority || "normal",
        subteam: input.body.subteam || null,
        sort_order: 0,
        assignees: assigneeProfiles,
        created_by: user.id,
        creator_name: user.nickname || user.name || null,
        due_date: input.body.due_date || null,
        zulip_stream: "kanban",
        zulip_topic: `Task-${id.split("-")[0]}: ${input.body.title}`,
        parent_id: input.body.parent_id || null,
        time_spent_seconds: input.body.time_spent_seconds || 0,
        created_at: now,
        updated_at: now,
        assigned_to: input.body.assignees?.[0] || null,
        assignee_name: assigneeProfiles[0]?.nickname || null,
      };

      if (input.body.assignees && input.body.assignees.length > 0) {
        try {
          const users = await db.selectFrom("user").select("email").where("id", "in", input.body.assignees).execute();
          const emails = users.map(u => u.email).filter(Boolean);
          if (emails.length > 0) {
            const env = await getSocialConfig(c);
            for (const email of emails) {
              await sendZulipMessage(env, email, null, `You have been assigned a new task: **${input.body.title}**\n\n[Open Task Dashboard](${siteConfig.urls.base}/dashboard?tab=tasks)`, "private").catch((e) => console.error("[Tasks] Zulip assign error:", e));
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
          const assigneeNames = assigneeProfiles.map((a: { nickname?: string | null }) => a.nickname || "Unknown").join(", ");
          const taskUrl = `${siteConfig.urls.base}/dashboard?tab=tasks`;
          const threadContent = [
            `📋 **New Task Created** by ${user.nickname || user.name || "ARES Member"}`,
            ``,
            `**Priority:** ${(input.body.priority || "normal").toUpperCase()}`,
            input.body.description ? `**Description:** ${input.body.description}` : null,
            assigneeProfiles.length > 0 ? `**Assigned to:** ${assigneeNames}` : null,
            input.body.due_date ? `**Due:** ${input.body.due_date}` : null,
            ``,
            `[Open Task Board](${taskUrl})`,
          ].filter(Boolean).join("\n");
          await sendZulipMessage(env, "kanban", `Task-${id.split("-")[0]}: ${input.body.title}`, threadContent);
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

  reorder: async (input: ServerInferRequest<typeof taskContract["reorder"]>, c: HonoContext) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401, body: { error: "Unauthorized" } };

      const now = new Date().toISOString();
      
 
      const items = input.body.items as Array<{ id: string; status: string; sort_order: number }>;
      await Promise.all(items.map((item) =>
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
        details: `Reordered ${input.body.items.length} tasks`,
        created_at: now,
      }).execute());

      return { status: 200, body: { success: true } };
    } catch (err) {
      console.error("[Tasks] Reorder error:", err);
      return { status: 500, body: { error: "Failed to reorder tasks" } };
    }
  },

  update: async (input: ServerInferRequest<typeof taskContract["update"]>, c: HonoContext) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401, body: { error: "Unauthorized" } };

      const existing = await db.selectFrom("tasks")
        .select(["id", "title", "created_by", "subteam"])
        .where("id", "=", input.params.id)
        .executeTakeFirst();

      if (!existing) return { status: 404, body: { error: "Task not found" } };

      const isAdmin = user.role === "admin";
      const isMentor = user.role === "mentor" || user.role === "coach";
      const isOwner = existing.created_by === user.id;
      const canAssign = isAdmin || isMentor || isOwner;

      // Any authenticated user can update task fields
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.body.title !== undefined) updates.title = input.body.title;
      if (input.body.description !== undefined) updates.description = input.body.description;
      if (input.body.status !== undefined) updates.status = input.body.status;
      if (input.body.priority !== undefined) updates.priority = input.body.priority;
      if (input.body.subteam !== undefined) updates.subteam = input.body.subteam;
      if (input.body.due_date !== undefined) updates.due_date = input.body.due_date;
      if (input.body.sort_order !== undefined) updates.sort_order = input.body.sort_order;
      if (input.body.parent_id !== undefined) updates.parent_id = input.body.parent_id;
      if (input.body.time_spent_seconds !== undefined) updates.time_spent_seconds = input.body.time_spent_seconds;

      await db.updateTable("tasks")
        .set(updates)
        .where("id", "=", input.params.id)
        .execute();

      // Only admins, mentors/coaches, and the task creator can change assignments
      if (input.body.assignees !== undefined) {
        if (!canAssign) {
          return { status: 403, body: { error: "Only mentors, coaches, admins, or the task creator can change assignments" } };
        }

        // WR-12: Additional validation - prevent assigning users from different subteams
        if (existing.subteam && input.body.assignees && input.body.assignees.length > 0) {
          const _assigneeProfiles = await db.selectFrom("user_profiles")
            .select(["user_id", "member_type"])
            .where("user_id", "in", input.body.assignees)
            .execute();

          // Check if any assignee belongs to a different subteam
          // Admins can assign anyone, but mentors/coaches can only assign within their subteam
          if (!isAdmin && isMentor) {
            const assigneeSubteams = await db.selectFrom("user_profiles")
              .select("subteams")
              .where("user_id", "in", input.body.assignees)
              .execute();

            const hasMismatchedSubteam = assigneeSubteams.some(p => p.subteams && p.subteams !== existing.subteam);
            if (hasMismatchedSubteam) {
              return { status: 403, body: { error: "Cannot assign users from different subteams to this task" } };
            }
          }
        }

        // Sync assignments: delete and re-insert
        await db.deleteFrom("task_assignments").where("task_id", "=", input.params.id).execute();
        if (input.body.assignees && input.body.assignees.length > 0) {
          const assignments = input.body.assignees.map((userId: string) => ({
            task_id: input.params.id,
            user_id: userId
          }));
          await db.insertInto("task_assignments").values(assignments).execute();

          // Notify new assignees (simplified logic: notify all currently assigned)
          try {
            const users = await db.selectFrom("user").select("email").where("id", "in", input.body.assignees).execute();
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
        resource_id: input.params.id,
        details: "Updated task and assignments",
        created_at: new Date().toISOString(),
      }).execute();

      return { status: 200, body: { success: true } };
    } catch (err) {
      console.error("[Tasks] Update error:", err);
      return { status: 500, body: { error: "Failed to update task" } };
    }
  },

  delete: async (input: ServerInferRequest<typeof taskContract["delete"]>, c: HonoContext) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401, body: { error: "Unauthorized" } };

      const existing = await db.selectFrom("tasks")
        .select(["created_by"])
        .where("id", "=", input.params.id)
        .executeTakeFirst();
      
      if (!existing) return { status: 404, body: { error: "Task not found" } };

      const isAdmin = user.role === "admin";
      const isOwner = existing.created_by === user.id;

      if (!isAdmin && !isOwner) {
        return { status: 403, body: { error: "You are not authorized to delete this task" } };
      }

      await db.deleteFrom("tasks")
        .where("id", "=", input.params.id)
        .execute();

      await db.insertInto("audit_log").values({
        id: crypto.randomUUID(),
        actor: user.id,
        action: "delete_task",
        resource_type: "task",
        resource_id: input.params.id,
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
const tasksTsRestRouter = s.router(taskContract, tasksHandlers as any);


tasksRouter.use("*", ensureAuth);
tasksRouter.use("*", rateLimitMiddleware(30, 60));
// WR-11: Add origin integrity to prevent CSRF attacks on task operations
tasksRouter.use("*", originIntegrityMiddleware());

createHonoEndpoints(
  taskContract,
  tasksTsRestRouter,
  tasksRouter,
  {
    responseValidation: true,
    responseValidationErrorHandler: (err, _c) => {
      console.error('[Contract] Response validation failed:', err.cause);
      return { error: { message: 'Internal server error' }, status: 500 };
    }
  }
);
export default tasksRouter;


