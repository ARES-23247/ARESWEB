/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TASKS ROUTER - NATIVE HONO TYPE INFERENCE PATTERN
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ApiError } from "../middleware/errorHandler";
import { OpenAPIHono } from "@hono/zod-openapi";

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
  createTaskAttachmentRoute,
  deleteTaskAttachmentRoute,
  createTaskChecklistRoute,
  updateTaskChecklistRoute,
  deleteTaskChecklistRoute,
  setTaskLabelsRoute,
} from "../../../shared/routes/tasks";
import { sendZulipMessage } from "../../utils/zulipSync";
import { siteConfig } from "../../utils/site.config";
import { safeWaitUntil } from "../utils/safeWaitUntil";

export const tasksRouter = new OpenAPIHono<AppEnv>();

// WR-11: Add origin integrity to prevent CSRF attacks on task operations
tasksRouter.use("*", originIntegrityMiddleware());

// Routes
tasksRouter.openapi(listTasksRoute, async (c) => {
    const query = c.req.valid("query");
    const db = getDb(c);
    const { limit, offset } = parsePagination(c, 50, 200);

    const conditions = [];
    if (query.status) {
      conditions.push(eq(schema.tasks.status, query.status));
    }
    if (query.parentId) {
      conditions.push(eq(schema.tasks.parentId, query.parentId));
    }
    if (query.assignedTo) {
      conditions.push(eq(schema.tasks.assignedTo, query.assignedTo));
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
        startDate: schema.tasks.startDate,
        estimatedMinutes: schema.tasks.estimatedMinutes,
        coverImage: schema.tasks.coverImage,
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
              'id', ta.user_id,
              'nickname', up.nickname
            )
          )
          FROM task_assignments ta
          LEFT JOIN user_profiles up ON ta.user_id = up.user_id
          WHERE ta.task_id = ${schema.tasks.id}
        )`,
      })
      .from(schema.tasks)
      .leftJoin(schema.userProfiles, eq(schema.tasks.assignedTo, schema.userProfiles.userId))
      .leftJoin(creatorProfile, eq(schema.tasks.createdBy, creatorProfile.userId));

    const finalQuery = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

    // Explicit type definition to avoid `any` inference in certain TypeScript versions
    interface TaskQueryResult {
      id: string;
      title: string;
      description: string | null;
      status: string | null;
      priority: string | null;
      subteam: string | null;
      dueDate: string | null;
      startDate: string | null;
      estimatedMinutes: number | null;
      coverImage: string | null;
      sortOrder: number | null;
      parentId: string | null;
      timeSpentSeconds: number | null;
      createdBy: string;
      createdAt: string | null;
      updatedAt: string | null;
      creatorName: string | null;
      assigneeName: string | null;
      assignedTo: string | null;
      assignees_json: string | null;
    }
    let tasks: TaskQueryResult[];
    try {
      tasks = await finalQuery
        .orderBy(asc(schema.tasks.sortOrder), desc(schema.tasks.createdAt))
        .limit(limit)
        .offset(Number(offset))
        .all() as unknown as TaskQueryResult[];
    } catch (e: unknown) {
      console.error("SQL ERROR EXACT:", e instanceof Error ? e.message : String(e));
      throw e;
    }

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

    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ tasks: formattedTasks } as any, 200);
  }
);

tasksRouter.openapi(createTaskRoute, async (c) => {
    const body = c.req.valid("json");
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) {
      throw new ApiError("Unauthorized", 401);
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
      startDate?: string | null;
      estimatedMinutes?: number | null;
      coverImage?: string | null;
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
      startDate: body.startDate || null,
      estimatedMinutes: body.estimatedMinutes || null,
      coverImage: body.coverImage || null,
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

    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ success: true, task: createdTask } as any, 200);
  }
);

tasksRouter.openapi(reorderTasksRoute, async (c) => {
    const body = c.req.valid("json");
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) {
      throw new ApiError("Unauthorized", 401);
    }

    // Batch update sort orders
    await Promise.all(body.items.map((o: { id: string; sortOrder: number }) =>
      db.update(schema.tasks)
        .set({ sortOrder: o.sortOrder, updatedAt: new Date().toISOString() })
        .where(eq(schema.tasks.id, o.id))
        .run()
    ));

    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ success: true } as any, 200);
  }
);

tasksRouter.openapi(updateTaskRoute, async (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) {
      throw new ApiError("Unauthorized", 401);
    }

    const existing = await db.select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        createdBy: schema.tasks.createdBy,
        subteam: schema.tasks.subteam,
      })
      .from(schema.tasks)
      .where(eq(schema.tasks.id, params.id))
      .get();

    if (!existing) {
      throw new ApiError("Task not found", 404);
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
      startDate?: string | null;
      estimatedMinutes?: number | null;
      coverImage?: string | null;
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
    if (body.startDate !== undefined) updates.startDate = body.startDate;
    if (body.estimatedMinutes !== undefined) updates.estimatedMinutes = body.estimatedMinutes;
    if (body.coverImage !== undefined) updates.coverImage = body.coverImage;

    await db.update(schema.tasks)
      .set(updates)
      .where(eq(schema.tasks.id, params.id))
      .run();

    // Only admins, mentors/coaches, and the task creator can change assignments
    if (body.assignees !== undefined) {
      if (!canAssign) {
        throw new ApiError("Only mentors, coaches, admins, or the task creator can change assignments", 403);
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
            throw new ApiError("Cannot assign users from different subteams to this task", 403);
          }
        }
      }

      // Sync assignments: delete and re-insert
      await db.delete(schema.taskAssignments).where(eq(schema.taskAssignments.taskId, params.id)).run();
      if (body.assignees && body.assignees.length > 0) {
        const assignments = body.assignees.map((userId: string) => ({
          taskId: params.id,
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
      resourceId: params.id,
      details: "Updated task",
      createdAt: new Date().toISOString(),
    }).run();

    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ success: true } as any, 200);
  }
);

tasksRouter.openapi(deleteTaskRoute, async (c) => {
    const params = c.req.valid("param");
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) {
      throw new ApiError("Unauthorized", 401);
    }

    const existing = await db.select({ createdBy: schema.tasks.createdBy })
      .from(schema.tasks)
      .where(eq(schema.tasks.id, params.id))
      .get();

    if (!existing) {
      throw new ApiError("Task not found", 404);
    }

    const isAdmin = user.role === "admin";
    const isOwner = existing.createdBy === user.id;

    if (!isAdmin && !isOwner) {
      throw new ApiError("You are not authorized to delete this task", 403);
    }

    await db.delete(schema.tasks)
      .where(eq(schema.tasks.id, params.id))
      .run();

    await db.insert(schema.auditLog).values({
      id: crypto.randomUUID(),
      actor: user.id,
      action: "delete_task",
      resourceType: "task",
      resourceId: params.id,
      details: "Deleted task",
      createdAt: new Date().toISOString(),
    }).run();

    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ success: true } as any, 200);
  }
);

tasksRouter.openapi(createTaskAttachmentRoute, async (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) throw new ApiError("Unauthorized", 401);

    let title = body.url;
    let type = "link";

    try {
      const urlObj = new URL(body.url);
      title = urlObj.hostname;

      if (urlObj.hostname.includes("docs.google.com")) {
        if (urlObj.pathname.includes("/document/")) type = "document";
        else if (urlObj.pathname.includes("/spreadsheets/")) type = "spreadsheet";
        else if (urlObj.pathname.includes("/presentation/")) type = "presentation";
        else type = "google_drive";
      } else if (urlObj.hostname.includes("github.com")) {
        type = "github";
      }

      // Fetch HTML for title
      const res = await fetch(body.url, { headers: { "User-Agent": "ARESWEB-Unfurler/1.0" } });
      if (res.ok) {
        const html = await res.text();
        const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (match && match[1]) {
          title = match[1].trim().replace(/\n/g, "").substring(0, 100);
        }
      }
    } catch (_e) {
      // Ignore fetch errors, fallback to hostname
    }

    const id = crypto.randomUUID();
    await db.insert(schema.taskAttachments).values({
      id,
      taskId: params.id,
      url: body.url,
      title,
      type,
      createdAt: new Date().toISOString(),
    }).run();

    // Notify via Zulip
    const task = await db.select({ title: schema.tasks.title }).from(schema.tasks).where(eq(schema.tasks.id, params.id)).get();
    if (task) {
      const env = await getSocialConfig(c);
      safeWaitUntil(c.executionCtx, sendZulipMessage(env, "kanban", `Task-${params.id.split("-")[0]}: ${task.title}`, `📎 **New Attachment Added:** [${title}](${body.url})`), "Failed to send attachment notification");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ success: true } as any, 200);
});

tasksRouter.openapi(deleteTaskAttachmentRoute, async (c) => {
    const params = c.req.valid("param");
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) throw new ApiError("Unauthorized", 401);

    await db.delete(schema.taskAttachments).where(and(eq(schema.taskAttachments.id, params.attachmentId), eq(schema.taskAttachments.taskId, params.id))).run();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ success: true } as any, 200);
});

tasksRouter.openapi(createTaskChecklistRoute, async (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) throw new ApiError("Unauthorized", 401);

    const id = crypto.randomUUID();
    await db.insert(schema.taskChecklists).values({
      id,
      taskId: params.id,
      content: body.content,
      isCompleted: 0,
      sortOrder: 0,
    }).run();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ success: true } as any, 200);
});

tasksRouter.openapi(updateTaskChecklistRoute, async (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) throw new ApiError("Unauthorized", 401);

    type ChecklistUpdates = {
      isCompleted?: number;
      content?: string;
      sortOrder?: number;
    };
    const updates: ChecklistUpdates = {};
    if (body.isCompleted !== undefined) updates.isCompleted = body.isCompleted;
    if (body.content !== undefined) updates.content = body.content;
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

    await db.update(schema.taskChecklists)
      .set(updates)
      .where(and(eq(schema.taskChecklists.id, params.checklistId), eq(schema.taskChecklists.taskId, params.id)))
      .run();

    // Milestone logic: if transitioned to completed
    if (body.isCompleted === 1) {
       const allChecklists = await db.select({ isCompleted: schema.taskChecklists.isCompleted }).from(schema.taskChecklists).where(eq(schema.taskChecklists.taskId, params.id)).all();
       const allCompleted = allChecklists.length > 0 && allChecklists.every((c: { isCompleted: number | null }) => c.isCompleted === 1);
       if (allCompleted) {
         const task = await db.select({ title: schema.tasks.title }).from(schema.tasks).where(eq(schema.tasks.id, params.id)).get();
         if (task) {
           const env = await getSocialConfig(c);
           safeWaitUntil(c.executionCtx, sendZulipMessage(env, "kanban", `Task-${params.id.split("-")[0]}: ${task.title}`, `✅ **Milestone Reached!** All checklists have been completed for this task.`), "Failed to send milestone notification");
         }
       }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ success: true } as any, 200);
});

tasksRouter.openapi(deleteTaskChecklistRoute, async (c) => {
    const params = c.req.valid("param");
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) throw new ApiError("Unauthorized", 401);

    await db.delete(schema.taskChecklists).where(and(eq(schema.taskChecklists.id, params.checklistId), eq(schema.taskChecklists.taskId, params.id))).run();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ success: true } as any, 200);
});

tasksRouter.openapi(setTaskLabelsRoute, async (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) throw new ApiError("Unauthorized", 401);

    await db.delete(schema.taskLabels).where(eq(schema.taskLabels.taskId, params.id)).run();

    if (body.labelIds.length > 0) {
       const inserts = body.labelIds.map((labelId: string) => ({
         taskId: params.id,
         labelId: labelId,
       }));
       await db.insert(schema.taskLabels).values(inserts).run();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ success: true } as any, 200);
});

export default tasksRouter;
