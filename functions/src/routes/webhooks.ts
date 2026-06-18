import express from "express";
import crypto from "crypto";
import admin, { adminDb } from "../lib/firebase-admin";

const router = express.Router();

function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aHash = crypto.createHash("sha256").update(a).digest();
  const bHash = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(aHash, bHash) && a.length === b.length;
}

// POST /api/webhooks/zulip
router.post("/zulip", async (req, res) => {
  try {
    const expectedToken = process.env.ZULIP_WEBHOOK_TOKEN;

    if (!expectedToken) {
      console.error("[Zulip Webhook] Server lacks ZULIP_WEBHOOK_TOKEN config.");
      res.status(500).json({ error: "Webhook token not configured." });
      return;
    }

    const { message, trigger, token } = req.body;

    if (!token || !timingSafeEqual(token, expectedToken)) {
      res.status(401).json({ error: "Unauthorized: Invalid webhook token." });
      return;
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
      console.warn(`[Zulip Webhook] Task "${taskId}" does not exist in Firestore.`);
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

    console.log(`[Zulip Webhook] Synced comment from Zulip to Task "${taskId}"`);
    res.json({ content: "" });
  } catch (error: any) {
    console.error("[Zulip Webhook] Error processing incoming webhook:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
