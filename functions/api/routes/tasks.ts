import { wrapLegacyHandler } from "../utils/handler-v2";
import { ApiError } from "../middleware/errorHandler";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";

import { eq, asc, desc, and, inArray, sql, aliasedTable } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { AppEnv, getSocialConfig, getSessionUser, originIntegrityMiddleware, getDb } from "../middleware";
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
import { safeWaitUntil } from "../utils/safeWaitUntil";

export const tasksRouter = new OpenAPIHono<AppEnv>();

// WR-11: Add origin integrity to prevent CSRF attacks on task operations
tasksRouter.use("*", originIntegrityMiddleware());

// Handler functions
type HandlerInput = { query?: Record<string, unknown>; params?: Record<string, unknown>; body?: Record<string, unknown> };

const taskHandlers = {
  listTasks: async (input: HandlerInput, c: Context<AppEnv>) => {
    const query = input.query || {};
    const db = getDb(c);
    const { limit, offset } = parsePagination(c, 50, 200);

    const conditions = [];
    if (query.status) {
      conditions.push(eq(schema.tasks.status, query.status as string));
    }
    if (query.parentId) {
      conditions.push(eq(schema.tasks.parentId, query.parentId as string));
    }
    if (query.assignedTo) {
      conditions.push(eq(schema.tasks.assignedTo, query.assignedTo as string));
    }

    const creatorProfile = aliasedTable(schema.userProfiles, "creatorProfile");
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
        creatorName: creatorProfile.nickname,
        assigneeName: schema.userProfiles.nickname,
        assignedTo: schema.userProfiles.userId,
        assignees_json: sql<string>`(
          SELECT json_group_array(
            json_object(
              'id', ${schema.taskAssignments.userId},
              'nickname', ${schema.userProfiles.nickname}
            )
          )
          FROM ${schema.taskAssignments} ta
          LEFT JOIN ${schema.userProfiles} up ON ta.${schema.taskAssignments.userId} = up.${schema.userProfiles.userId}
          WHERE ta.${schema.taskAssignments.taskId} = ${schema.tasks.id}
        )`,
      })
      .from(schema.tasks)
      .leftJoin(schema.userProfiles, eq(schema.tasks.assignedTo, schema.userProfiles.userId))
      .leftJoin(creatorProfile, eq(schema.tasks.createdBy, creatorProfile.userId));

    const finalQuery = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

    const tasks = await finalQuery
      .orderBy(asc(schema.tasks.sortOrder), desc(schema.tasks.createdAt))
      .limit(limit)
      .offset(Number(offset))
      .all();

    const formattedTasks = tasks.map((t) => {
      interface Assignee {
        id: string;
        nickname: string | null;
      }
      let assignees: Assignee[] = [];
      if (t.assignees_json) {
        try {
          const parsed = JSON.parse(t.assignees_json) as Assignee[];
          assignees = parsed.filter((a: Assignee) => a && a.id !== null);
        } catch (_e) {
          // ignore
        }
      }
      return {
        ...t,
        sortOrder: t.sortOrder ?? 0,
        createdAt: t.createdAt ?? new Date().toISOString(),
        updatedAt: t.updatedAt ?? new Date().toISOString(),
        status: t.status || "todo",
        priority: t.priority || "normal",
        assignedTo: t.assignedTo ?? null,
        assigneeName: t.assigneeName ?? null,
        assignees,
        creatorName: t.creatorName ?? "ARES Member",
        zulipStream: null,
        zulipTopic: null,
      };
    });

    return { status: 200, body: { tasks: formattedTasks } };
  },

  createTask: async (input: HandlerInput, c: Context<AppEnv>) => {
    const body = input.body as {
      title: string;
      description?: string;
      status?: string;
      priority?: string;
      subteam?: string;
      dueDate?: string;
      sortOrder?: number;
      parentId?: string;
      assignedTo?: string;
      assignees?: string[];
    };
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) {
      return { status: 401, body: { error: "Unauthorized" } };
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    interface TaskData {
      id: string;
      title: string;
      description: string | null;
      status: string;
      priority: string;
      subteam: string | null;
      dueDate: string | null;
      sortOrder: number;
      parentId: string | null;
      timeSpentSeconds: number;
      createdBy: string;
      createdAt: string;
      updatedAt: string;
      assignedTo?: string;
    }

    const taskData: TaskData = {
      id,
      title: body.title,
      description: body.description || null,
      status: body.status || "todo",
      priority: body.priority || "normal",
      subteam: body.subteam || null,
      dueDate: body.dueDate || null,
      sortOrder: body.sortOrder || 0,
      parentId: body.parentId || null,
      timeSpentSeconds: 0,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    };

    if (body.assignedTo) {
      taskData.assignedTo = body.assignedTo;
    }

    await db.insert(schema.tasks).values(taskData as typeof schema.tasks.$inferInsert).run();

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
      assignees: body.assignees ? body.assignees.map((userId: string) => ({ id: userId, nickname: null })) : [],
      creatorName: user.nickname || null,
      zulipStream: null,
      zulipTopic: null,
      assigneeName: null,
    };

    return { status: 200, body: { success: true, task: createdTask } };
  },

  reorderTasks: async (input: HandlerInput, c: Context<AppEnv>) => {
    const body = input.body as { items: Array<{ id: string; sortOrder: number }> };
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) {
      return { status: 401, body: { error: "Unauthorized" } };
    }

    // Batch update sort orders
    await Promise.all(body.items.map((o: { id: string; sortOrder: number }) =>
      db.update(schema.tasks)
        .set({ sortOrder: o.sortOrder, updatedAt: new Date().toISOString() })
        .where(eq(schema.tasks.id, o.id))
        .run()
    ));

    return { status: 200, body: { success: true } };
  },

  updateTask: async (input: HandlerInput, c: Context<AppEnv>) => {
    const { id } = input.params as { id: string };
    const body = input.body as {
      title?: string;
      description?: string;
      status?: string;
      priority?: string;
      subteam?: string;
      dueDate?: string;
      sortOrder?: number;
      parentId?: string;
      timeSpentSeconds?: number;
      assignedTo?: string;
      assignees?: string[];
    };
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) {
      return { status: 401, body: { error: "Unauthorized" } };
    }

    const existing = await db.select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        createdBy: schema.tasks.createdBy,
        subteam: schema.tasks.subteam,
      })
      .from(schema.tasks)
      .where(eq(schema.tasks.id, id))
      .get();

    if (!existing) {
      return { status: 404, body: { error: "Task not found" } };
    }

    const isAdmin = user.role === "admin";
    const isMentor = user.role === "mentor" || user.role === "coach";
    const isOwner = existing.createdBy === user.id;
    const canAssign = isAdmin || isMentor || isOwner;

    // Any authenticated user can update task fields
    type TaskUpdates = {
      updatedAt: string;
      title?: string;
      description?: string | null;
      status?: string;
      priority?: string;
      subteam?: string | null;
      dueDate?: string | null;
      sortOrder?: number;
      parentId?: string | null;
      timeSpentSeconds?: number;
      assignedTo?: string | null;
    };

    const updates: TaskUpdates = { updatedAt: new Date().toISOString() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.status !== undefined) updates.status = body.status;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.subteam !== undefined) updates.subteam = body.subteam;
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate;
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
    if (body.parentId !== undefined) updates.parentId = body.parentId;
    if (body.timeSpentSeconds !== undefined) updates.timeSpentSeconds = body.timeSpentSeconds;
    if (body.assignedTo !== undefined) updates.assignedTo = body.assignedTo;

    await db.update(schema.tasks)
      .set(updates)
      .where(eq(schema.tasks.id, id))
      .run();

    // Only admins, mentors/coaches, and the task creator can change assignments
    if (body.assignees !== undefined) {
      if (!canAssign) {
        return { status: 403, body: { error: "Only mentors, coaches, admins, or the task creator can change assignments" } };
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

          const hasMismatchedSubteam = assigneeSubteams.some((p) => p.subteams && p.subteams !== existing.subteam);
          if (hasMismatchedSubteam) {
            return { status: 403, body: { error: "Cannot assign users from different subteams to this task" } };
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
        const users = await db.select({ email: schema.user.email }).from(schema.user).where(inArray(schema.user.id, body.assignees)).all();
        const emails = users.map((u) => u.email).filter(Boolean);
        if (emails.length > 0) {
          const env = await getSocialConfig(c);
          for (const email of emails) {
            safeWaitUntil(c.executionCtx, sendZulipMessage(env, email, null, `Task updated: **${updates.title || existing.title}**\nYou are assigned to this task.\n\n[Open Task Dashboard](${siteConfig.urls.base}/dashboard?tab=tasks)`, "private"), `Failed to send task update notification to ${email}`);
          }
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

    return { status: 200, body: { success: true } };
  },

  deleteTask: async (input: HandlerInput, c: Context<AppEnv>) => {
    const { id } = input.params as { id: string };
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) {
      return { status: 401, body: { error: "Unauthorized" } };
    }

    const existing = await db.select({ createdBy: schema.tasks.createdBy })
      .from(schema.tasks)
      .where(eq(schema.tasks.id, id))
      .get();

    if (!existing) {
      return { status: 404, body: { error: "Task not found" } };
    }

    const isAdmin = user.role === "admin";
    const isOwner = existing.createdBy === user.id;

    if (!isAdmin && !isOwner) {
      return { status: 403, body: { error: "You are not authorized to delete this task" } };
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

    return { status: 200, body: { success: true } };
  },
};

// Routes
tasksRouter.openapi(listTasksRoute, wrapLegacyHandler(taskHandlers.listTasks, listTasksRoute.responses[200].content["application/json"].schema));

tasksRouter.openapi(createTaskRoute, wrapLegacyHandler(taskHandlers.createTask, createTaskRoute.responses[200].content["application/json"].schema));

tasksRouter.openapi(reorderTasksRoute, wrapLegacyHandler(taskHandlers.reorderTasks, reorderTasksRoute.responses[200].content["application/json"].schema));

tasksRouter.openapi(updateTaskRoute, wrapLegacyHandler(taskHandlers.updateTask, updateTaskRoute.responses[200].content["application/json"].schema));

tasksRouter.openapi(deleteTaskRoute, wrapLegacyHandler(taskHandlers.deleteTask, deleteTaskRoute.responses[200].content["application/json"].schema));

export default tasksRouter;
