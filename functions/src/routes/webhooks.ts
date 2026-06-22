import express from "express";
import crypto from "crypto";
import admin, { adminDb } from "../lib/firebase-admin";
import { logger } from "../lib/logger";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";

const router = express.Router();

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

  const { message, trigger, token } = req.body;

  if (!token || !timingSafeEqual(token, expectedToken)) {
    throw new ApiError(401, "Unauthorized: Invalid webhook token.");
  }

  if (!message || (trigger !== "message" && trigger !== "private_message" && trigger !== "mention")) {
    res.json({ content: "" });
    return;
  }

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

  const cleanContent = (message.content || "").replace(/@\*\*[^*]+\*\*/g, "").trim();
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
