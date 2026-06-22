import express from "express";
import { ensureAuth } from "../middleware/auth";
import { sendZulipMessage } from "../lib/zulip";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";

const router = express.Router();

// POST /api/tasks/comment
router.post("/comment", ensureAuth, asyncHandler(async (req, res) => {
  const { taskId, author, content } = req.body as {
    taskId: string;
    author: string;
    content: string;
  };

  if (!taskId || !author || !content) {
    throw new ApiError(400, "Missing required fields.");
  }

  const streamName = process.env.ZULIP_KANBAN_STREAM || "kanban";
  const topic = `Task-${taskId}`;
  const messageContent = `💬 **${author}** (via Web):\n\n${content}`;

  const success = await sendZulipMessage(streamName, topic, messageContent);

  res.json({
    success,
    message: success ? "Comment forwarded to Zulip." : "Zulip integration is not active or failed.",
  });
}));

// POST /api/tasks/notify
router.post("/notify", ensureAuth, asyncHandler(async (req, res) => {
  const { taskId, action, title, status, description, subteam, priority } = req.body as {
    taskId: string;
    action: "create" | "move";
    title: string;
    status?: string;
    description?: string;
    subteam?: string;
    priority?: string;
  };

  if (!taskId || !action || !title) {
    throw new ApiError(400, "Missing required fields.");
  }

  const streamName = process.env.ZULIP_KANBAN_STREAM || "kanban";
  const topic = `Task-${taskId}`;
  let content = "";

  if (action === "create") {
    content = [
      `🚀 **New Task Created:** ${title}`,
      description ? `\n${description}` : "",
      `**Priority:** ${priority || "medium"}`,
      `**Subteam:** ${subteam || "software"}`,
      `[Open Kanban Board](https://aresfirst.org/dashboard/tasks)`
    ].filter(Boolean).join("\n");
  } else if (action === "move") {
    content = `🔄 **Task Status Updated:** Card is now in **${status || "unknown"}**`;
  } else {
    throw new ApiError(400, "Invalid action.");
  }

  const success = await sendZulipMessage(streamName, topic, content);

  res.json({
    success,
    message: success ? "Notification sent to Zulip." : "Zulip integration is not active or failed.",
  });
}));

export default router;
