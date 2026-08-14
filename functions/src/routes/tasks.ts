import express from "express";
import rateLimit from "express-rate-limit";
import { ensureTeamMember } from "../middleware/auth";
import { sendZulipMessage } from "../lib/zulip";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import type { AuthenticatedRequest } from "../middleware/auth";
import { z } from "zod";

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(limiter);

const commentSchema = z.object({
  taskId: z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9_-]+$/),
  content: z.string().trim().min(1).max(4000),
});

const notificationSchema = z.object({
  taskId: z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9_-]+$/),
  action: z.enum(["create", "move"]),
  title: z.string().trim().min(1).max(240),
  status: z.string().trim().max(80).optional(),
  description: z.string().trim().max(2000).optional(),
  subteam: z.string().trim().max(80).optional(),
  priority: z.string().trim().max(80).optional(),
  dueDate: z.string().date().optional(),
}).strict();

function safeAuthorLabel(req: AuthenticatedRequest): string {
  const claimedName = typeof req.user?.name === "string" ? req.user.name.trim() : "";
  const normalized = claimedName.replace(/[\r\n*_`<>]/g, "").slice(0, 80);
  return normalized || "ARES Team Member";
}

// POST /api/tasks/comment
router.post("/comment", ensureTeamMember, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Enter a valid task comment.");
  const { taskId, content } = parsed.data;
  const author = safeAuthorLabel(req);

  const streamName = process.env.ZULIP_KANBAN_STREAM || "kanban";
  const topic = `Task-${taskId}`;
  const messageContent = `💬 **${author}** (via Web):\n\n${content}`;

  const success = await sendZulipMessage(streamName, topic, messageContent);
  if (!success) throw new ApiError(502, "Zulip did not accept the task comment.");
  res.json({ success: true, message: "Comment forwarded to Zulip." });
}));

// POST /api/tasks/notify
router.post("/notify", ensureTeamMember, asyncHandler(async (req, res) => {
  const parsed = notificationSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Enter valid task notification details.");
  const { taskId, action, title, status, description, subteam, priority, dueDate } = parsed.data;

  const streamName = process.env.ZULIP_KANBAN_STREAM || "kanban";
  const topic = `Task-${taskId}`;
  let content = "";

  if (action === "create") {
    content = [
      `🚀 **New Task Created:** ${title}`,
      description ? `\n${description}` : "",
      `**Priority:** ${priority || "medium"}`,
      `**Subteam:** ${subteam || "software"}`,
      dueDate ? `**Due:** ${dueDate}` : "",
      `[Open Kanban Board](https://aresfirst.org/dashboard/tasks)`
    ].filter(Boolean).join("\n");
  } else if (action === "move") {
    content = [
      `🔄 **Task Status Updated:** Card is now in **${status || "unknown"}**`,
      dueDate ? `**Due:** ${dueDate}` : "",
    ].filter(Boolean).join("\n");
  } else {
    throw new ApiError(400, "Invalid action.");
  }

  const success = await sendZulipMessage(streamName, topic, content);
  if (!success) throw new ApiError(502, "Zulip did not accept the task notification.");
  res.json({ success: true, message: "Notification sent to Zulip." });
}));

export default router;
