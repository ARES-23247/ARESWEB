import { typedHandler } from "../utils/handler";
import { OpenAPIHono } from "@hono/zod-openapi";

import { eq, asc, desc, and, inArray } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
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

    const conditions = [];
    if (query.status) {
      conditions.push(eq(schema.tasks.status, query.status));
    }
    if (query.subteam) {
      conditions.push(eq(schema.tasks.subteam, query.subteam));
    }
    if (query.assigned_to) {
      conditions.push(eq(schema.tasks.assignedTo, query.assigned_to));
    }

    const baseQuery = db.select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        description: schema.tasks.description,
        status: schema.tasks.status,
        priority: schema.tasks.priority,
        subteam: schema.tasks.subteam,
        dueDate: schema.tasks.dueDate,
        sortOrder: schema.tasks.sortOrder,
        parentId: schema.tasks.parentId,
        timeSpentSeconds: schema.tasks.timeSpentSeconds,
        createdBy: schema.tasks.createdBy,
        createdAt: schema.tasks.createdAt,
        updatedAt: schema.tasks.updatedAt,
        assignee_name: schema.userProfiles.nickname,
        assigned_to: schema.userProfiles.userId,
      })
      .from(schema.tasks)
      .leftJoin(schema.userProfiles, eq(schema.tasks.assignedTo, schema.userProfiles.userId));

    const finalQuery = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

    const tasks = await finalQuery
      .orderBy(asc(schema.tasks.sortOrder), desc(schema.tasks.createdAt))
      .limit(limit)
      .offset(Number(offset))
      .all();

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
        due_date: t.dueDate,
        sort_order: t.sortOrder,
        parent_id: t.parentId,
        time_spent_seconds: t.timeSpentSeconds,
        created_by: t.createdBy,
        created_at: t.createdAt,
        updated_at: t.updatedAt,
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
      dueDate: body.due_date || null,
      sortOrder: body.sort_order || 0,
      parentId: body.parent_id || null,
      timeSpentSeconds: 0,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    };

    if (body.assigned_to) {
      taskData.assignedTo = body.assigned_to;
    }

    await db.insert(schema.tasks).values(taskData).run();

    if (body.assignees && body.assignees.length > 0) {
      const assignments = body.assignees.map((userId: string) => ({
        taskId: id,
        userId: userId,
      }));
      await db.insert(schema.taskAssignments).values(assignments).run();
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

    await db.insert(schema.auditLog).values({
      id: crypto.randomUUID(),
      actor: user.id,
      action: "create_task",
      resourceType: "task",
      resourceId: id,
      details: `Created task: ${body.title}`,
      createdAt: now,
    }).run();

    const createdTask = {
      ...taskData,
      due_date: taskData.dueDate,
      sort_order: taskData.sortOrder,
      parent_id: taskData.parentId,
      time_spent_seconds: taskData.timeSpentSeconds,
      created_by: taskData.createdBy,
      created_at: taskData.createdAt,
      updated_at: taskData.updatedAt,
      assignees: body.assignees ? body.assignees.map((userId: string) => ({ id: userId, nickname: null })) : [],
      creator_name: user.nickname || null,
      zulip_stream: null,
      zulip_topic: null,
      assigned_to: taskData.assignedTo || null,
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
      db.update(schema.tasks)
        .set({ sortOrder: o.sort_order, updatedAt: new Date().toISOString() })
        .where(eq(schema.tasks.id, o.id))
        .run()
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

    const existing = await db.select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        createdBy: schema.tasks.createdBy,
        subteam: schema.tasks.subteam,
      })
      .from(schema.tasks)
      .where(eq(schema.tasks.id, id))
      .get();

    if (!existing) return c.json({ error: "Task not found" }, 404);

    const isAdmin = user.role === "admin";
    const isMentor = user.role === "mentor" || user.role === "coach";
    const isOwner = existing.createdBy === user.id;
    const canAssign = isAdmin || isMentor || isOwner;

    // Any authenticated user can update task fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.status !== undefined) updates.status = body.status;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.subteam !== undefined) updates.subteam = body.subteam;
    if (body.due_date !== undefined) updates.dueDate = body.due_date;
    if (body.sort_order !== undefined) updates.sortOrder = body.sort_order;
    if (body.parent_id !== undefined) updates.parentId = body.parent_id;
    if (body.time_spent_seconds !== undefined) updates.timeSpentSeconds = body.time_spent_seconds;
    if (body.assigned_to !== undefined) updates.assignedTo = body.assigned_to;

    await db.update(schema.tasks)
      .set(updates)
      .where(eq(schema.tasks.id, id))
      .run();

    // Only admins, mentors/coaches, and the task creator can change assignments
    if (body.assignees !== undefined) {
      if (!canAssign) {
        return c.json({ error: "Only mentors, coaches, admins, or the task creator can change assignments" }, 403);
      }

      // WR-12: Additional validation - prevent assigning users from different subteams
      if (existing.subteam && body.assignees && body.assignees.length > 0) {
        if (!isAdmin && isMentor) {
          const assigneeSubteams = await db.select({
              subteams: schema.userProfiles.subteams,
            })
            .from(schema.userProfiles)
            .where(inArray(schema.userProfiles.userId, body.assignees))
            .all();

          const hasMismatchedSubteam = assigneeSubteams.some((p: any) => p.subteams && p.subteams !== existing.subteam);
          if (hasMismatchedSubteam) {
            return c.json({ error: "Cannot assign users from different subteams to this task" }, 403);
          }
        }
      }

      // Sync assignments: delete and re-insert
      await db.delete(schema.taskAssignments).where(eq(schema.taskAssignments.taskId, id)).run();
      if (body.assignees && body.assignees.length > 0) {
        const assignments = body.assignees.map((userId: string) => ({
          taskId: id,
          userId: userId,
        }));
        await db.insert(schema.taskAssignments).values(assignments).run();

        // Notify new assignees
        try {
          const users = await db.select({ email: schema.user.email }).from(schema.user).where(inArray(schema.user.id, body.assignees)).all();
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

    await db.insert(schema.auditLog).values({
      id: crypto.randomUUID(),
      actor: user.id,
      action: "update_task",
      resourceType: "task",
      resourceId: id,
      details: "Updated task",
      createdAt: new Date().toISOString(),
    }).run();

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

    const existing = await db.select({ createdBy: schema.tasks.createdBy })
      .from(schema.tasks)
      .where(eq(schema.tasks.id, id))
      .get();

    if (!existing) return c.json({ error: "Task not found" }, 404);

    const isAdmin = user.role === "admin";
    const isOwner = existing.createdBy === user.id;

    if (!isAdmin && !isOwner) {
      return c.json({ error: "You are not authorized to delete this task" }, 403);
    }

    await db.delete(schema.tasks)
      .where(eq(schema.tasks.id, id))
      .run();

    await db.insert(schema.auditLog).values({
      id: crypto.randomUUID(),
      actor: user.id,
      action: "delete_task",
      resourceType: "task",
      resourceId: id,
      details: "Deleted task",
      createdAt: new Date().toISOString(),
    }).run();

    return c.json({ success: true }, 200);
  } catch (err) {
    console.error("[Tasks] Delete error:", err);
    return c.json({ error: "Failed to delete task" }, 500);
  }
}));

export default tasksRouter;
