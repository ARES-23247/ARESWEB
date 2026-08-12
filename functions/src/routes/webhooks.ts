import express from "express";
import crypto from "crypto";
import { z } from "zod";
import admin, { adminDb } from "../lib/firebase-admin";
import { logger } from "../lib/logger";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";

const router = express.Router();
const zulipWebhookSchema = z.object({
  token: z.string().min(1).max(512),
  trigger: z.enum(["message", "private_message", "direct_message", "mention"]),
  message: z.object({
    topic: z.string().max(200).optional(),
    subject: z.string().max(200).optional(),
    content: z.string().max(20_000),
    sender_full_name: z.string().max(120).optional(),
  }),
});

function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aHash = crypto.createHash("sha256").update(a).digest();
  const bHash = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(aHash, bHash) && a.length === b.length;
}

// POST /api/webhooks/zulip
router.post("/zulip", asyncHandler(async (req, res) => {
  const expectedToken = process.env.ZULIP_WEBHOOK_TOKEN;

  if (!expectedToken) {
    logger.error("webhooks", "Server lacks ZULIP_WEBHOOK_TOKEN config");
    throw new ApiError(500, "Webhook token not configured.");
  }

  const token = typeof req.body?.token === "string" ? req.body.token : "";

  if (!token || !timingSafeEqual(token, expectedToken)) {
    throw new ApiError(401, "Unauthorized: Invalid webhook token.");
  }

  const payload = zulipWebhookSchema.safeParse(req.body);
  if (!payload.success) {
    throw new ApiError(400, "Invalid Zulip webhook payload.");
  }
  const { message } = payload.data;

  const topic = message.topic || message.subject;
  if (!topic || !topic.startsWith("Task-")) {
    res.json({ content: "" });
    return;
  }

  const taskId = topic.replace("Task-", "").trim();
  const taskRef = adminDb.collection("tasks").doc(taskId);
  const taskSnap = await taskRef.get();

  if (!taskSnap.exists) {
    logger.warn("webhooks", `Task "${taskId}" does not exist in Firestore`);
    res.json({ content: "Task card not found." });
    return;
  }

  const cleanContent = message.content.replace(/@\*\*[^*]+\*\*/g, "").trim();
  if (!cleanContent) {
    res.json({ content: "" });
    return;
  }

  const newComment = {
    id: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    author: message.sender_full_name || "Zulip User",
    content: cleanContent,
    createdAt: new Date().toISOString(),
    source: "zulip",
  };

  const batch = adminDb.batch();
  const commentRef = taskRef.collection("comments").doc(newComment.id);
  batch.set(commentRef, newComment);
  batch.update(taskRef, {
    commentsCount: admin.firestore.FieldValue.increment(1)
  });
  await batch.commit();

  logger.info("webhooks", `Synced comment from Zulip to Task "${taskId}"`);
  res.json({ content: "" });
}));

export default router;
