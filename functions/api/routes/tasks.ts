import { typedHandler } from "../utils/handler";
import { OpenAPIHono } from "@hono/zod-openapi";

import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { AppEnv, getSocialConfig, getSessionUser, originIntegrityMiddleware } from "../middleware";
import { parsePagination } from "../middleware/utils";
import {
  listTasksRoute,
  createTaskRoute,
  updateTaskRoute,
  deleteTaskRoute,
  reorderTasksRoute,
} from "../../../shared/routes/tasks";
import { sendZulipMessage } from "../../utils/zulipSync";
import { siteConfig } from "../../utils/site.config";



export const tasksRouter = new OpenAPIHono<AppEnv>();

// WR-11: Add origin integrity to prevent CSRF attacks on task operations
tasksRouter.use("*", originIntegrityMiddleware());

tasksRouter.openapi(listTasksRoute, typedHandler<typeof listTasksRoute>(async (c) => {
  try {
    const query = c.req.valid("query") || {};
    const db = c.get("db") as any;
    const { limit, offset } = parsePagination(c, 50, 200);

    let baseQuery = db.selectFrom("tasks")
      .leftJoin("user_profiles as ap", "tasks.assigned_to", "ap.user_id")
      .select([
        "tasks.id",
        "tasks.title",
        "tasks.description",
        "tasks.status",
        "tasks.priority",
        "tasks.subteam",
        "tasks.due_date",
        "tasks.sort_order",
        "tasks.parent_id",
        "tasks.time_spent_seconds",
        "tasks.created_by",
        "tasks.created_at",
        "tasks.updated_at",
        "ap.nickname as assignee_name",
        "ap.user_id as assigned_to",
      ]);

    if (query.status) {
      baseQuery = baseQuery.where("tasks.status", "=", query.status);
    }
    if (query.subteam) {
      baseQuery = baseQuery.where("tasks.subteam", "=", query.subteam);
    }
    if (query.assigned_to) {
      baseQuery = baseQuery.where("tasks.assigned_to", "=", query.assigned_to);
    }

    const tasks = await baseQuery
      .orderBy("tasks.sort_order", "asc")
      .orderBy("tasks.created_at", "desc")
      .limit(limit)
      .offset(Number(offset))
      .execute();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedTasks = tasks.map((t: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let assignees: any[] = [];
      if (t.assignees_json) {
        try {
          const parsed = JSON.parse(t.assignees_json);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          assignees = parsed.filter((a: any) => a && a.id !== null);
        } catch (_e) {
          // ignore
        }
      }
      return {
        ...t,
        status: t.status || "todo",
        priority: t.priority || "normal",
        assigned_to: t.assigned_to ?? null,
        assignee_name: t.assignee_name ?? null,
        assignees
      };
    });

    return c.json({
      success: true,
      tasks: formattedTasks,
      pagination: {
        total: tasks.length, // Simplified
        limit,
        offset,
      },
    }, 200);
  } catch (err) {
    console.error("[Tasks] List error:", err);
    return c.json({ error: "Failed to fetch tasks" }, 500);
  }
}));

tasksRouter.openapi(createTaskRoute, typedHandler<typeof createTaskRoute>(async (c) => {
  try {
    const body = c.req.valid("json");
    const db = c.get("db") as any;
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const taskData: any = {
      id,
      title: body.title,
      description: body.description || null,
      status: body.status || "todo",
      priority: body.priority || "normal",
      subteam: body.subteam || null,
      due_date: body.due_date || null,
      sort_order: body.sort_order || 0,
      parent_id: body.parent_id || null,
      time_spent_seconds: 0,
      created_by: user.id,
      created_at: now,
      updated_at: now,
    };

    if (body.assigned_to) {
      taskData.assigned_to = body.assigned_to;
    }

    await db.insertInto("tasks").values(taskData).execute();

    if (body.assignees && body.assignees.length > 0) {
      const assignments = body.assignees.map((userId: string) => ({
        id: crypto.randomUUID(),
        task_id: id,
        user_id: userId,
        assigned_at: now,
      }));
      await db.insertInto("task_assignments").values(assignments).execute();
    }

    // Zulip Notification
    try {
      const env = await getSocialConfig(c);
      const taskUrl = `${siteConfig.urls.base}/dashboard?tab=tasks&id=${id}`;
      const threadContent = [
        `**New Task:** ${body.title}`,
        body.description ? `\n${body.description}` : "",
        `\n**Priority:** ${body.priority || "normal"}`,
        `**Subteam:** ${body.subteam || "General"}`,
        `[Open Task Board](${taskUrl})`,
      ].filter(Boolean).join("\n");
      await sendZulipMessage(env, "kanban", `Task-${id.split("-")[0]}: ${body.title}`, threadContent);
    } catch (e) {
      console.error("[Tasks:ZulipThread] Error creating discussion thread", e);
    }

    await db.insertInto("audit_log").values({
      id: crypto.randomUUID(),
      actor: user.id,
      action: "create_task",
      resource_type: "task",
      resource_id: id,
      details: `Created task: ${body.title}`,
      created_at: now,
    }).execute();

    const createdTask = {
      ...taskData,
      assignees: body.assignees ? body.assignees.map((userId: string) => ({ id: userId, nickname: null })) : [],
      creator_name: user.nickname || null,
      zulip_stream: null,
      zulip_topic: null,
      assigned_to: taskData.assigned_to || null,
      assignee_name: null,
    };

    return c.json({ success: true, task: createdTask }, 200);
  } catch (err) {
    console.error("[Tasks] Create error:", err);
    return c.json({ error: "Failed to create task" }, 500);
  }
}));

tasksRouter.openapi(reorderTasksRoute, typedHandler<typeof reorderTasksRoute>(async (c) => {
  try {
    const body = c.req.valid("json");
    const db = c.get("db") as any;
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    // Batch update sort orders
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await Promise.all(body.items.map((o: any) => 
      db.updateTable("tasks")
        .set({ sort_order: o.sort_order, updated_at: new Date().toISOString() })
        .where("id", "=", o.id)
        .execute()
    ));

    return c.json({ success: true }, 200);
  } catch (err) {
    console.error("[Tasks] Reorder error:", err);
    return c.json({ error: "Failed to reorder tasks" }, 500);
  }
}));

tasksRouter.openapi(updateTaskRoute, typedHandler<typeof updateTaskRoute>(async (c) => {
  try {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db") as any;
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const existing = await db.selectFrom("tasks")
      .select(["id", "title", "created_by", "subteam"])
      .where("id", "=", id)
      .executeTakeFirst();

    if (!existing) return c.json({ error: "Task not found" }, 404);

    const isAdmin = user.role === "admin";
    const isMentor = user.role === "mentor" || user.role === "coach";
    const isOwner = existing.created_by === user.id;
    const canAssign = isAdmin || isMentor || isOwner;

    // Any authenticated user can update task fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.status !== undefined) updates.status = body.status;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.subteam !== undefined) updates.subteam = body.subteam;
    if (body.due_date !== undefined) updates.due_date = body.due_date;
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;
    if (body.parent_id !== undefined) updates.parent_id = body.parent_id;
    if (body.time_spent_seconds !== undefined) updates.time_spent_seconds = body.time_spent_seconds;
    if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to;

    await db.updateTable("tasks")
      .set(updates)
      .where("id", "=", id)
      .execute();

    // Only admins, mentors/coaches, and the task creator can change assignments
    if (body.assignees !== undefined) {
      if (!canAssign) {
        return c.json({ error: "Only mentors, coaches, admins, or the task creator can change assignments" }, 403);
      }

      // WR-12: Additional validation - prevent assigning users from different subteams
      if (existing.subteam && body.assignees && body.assignees.length > 0) {
        if (!isAdmin && isMentor) {
          const assigneeSubteams = await db.selectFrom("user_profiles")
            .select("subteams")
            .where("user_id", "in", body.assignees)
            .execute();

          const hasMismatchedSubteam = assigneeSubteams.some((p: any) => p.subteams && p.subteams !== existing.subteam);
          if (hasMismatchedSubteam) {
            return c.json({ error: "Cannot assign users from different subteams to this task" }, 403);
          }
        }
      }

      // Sync assignments: delete and re-insert
      await db.deleteFrom("task_assignments").where("task_id", "=", id).execute();
      if (body.assignees && body.assignees.length > 0) {
        const assignments = body.assignees.map((userId: string) => ({
          id: crypto.randomUUID(),
          task_id: id,
          user_id: userId,
          assigned_at: new Date().toISOString()
        }));
        await db.insertInto("task_assignments").values(assignments).execute();

        // Notify new assignees
        try {
          const users = await db.selectFrom("user").select("email").where("id", "in", body.assignees).execute();
          const emails = users.map((u: any) => u.email).filter(Boolean);
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
      resource_id: id,
      details: "Updated task",
      created_at: new Date().toISOString(),
    }).execute();

    return c.json({ success: true }, 200);
  } catch (err) {
    console.error("[Tasks] Update error:", err);
    return c.json({ error: "Failed to update task" }, 500);
  }
}));

tasksRouter.openapi(deleteTaskRoute, typedHandler<typeof deleteTaskRoute>(async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = c.get("db") as any;
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const existing = await db.selectFrom("tasks")
      .select(["created_by"])
      .where("id", "=", id)
      .executeTakeFirst();

    if (!existing) return c.json({ error: "Task not found" }, 404);

    const isAdmin = user.role === "admin";
    const isOwner = existing.created_by === user.id;

    if (!isAdmin && !isOwner) {
      return c.json({ error: "You are not authorized to delete this task" }, 403);
    }

    await db.deleteFrom("tasks")
      .where("id", "=", id)
      .execute();

    await db.insertInto("audit_log").values({
      id: crypto.randomUUID(),
      actor: user.id,
      action: "delete_task",
      resource_type: "task",
      resource_id: id,
      details: "Deleted task",
      created_at: new Date().toISOString(),
    }).execute();

    return c.json({ success: true }, 200);
  } catch (err) {
    console.error("[Tasks] Delete error:", err);
    return c.json({ error: "Failed to delete task" }, 500);
  }
}));

export default tasksRouter;
