import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aBuf = new TextEncoder().encode(a);
  const bBuf = new TextEncoder().encode(b);
  const MAX_TOKEN_LENGTH = Math.max(aBuf.length, bBuf.length);
  let result = 0;
  for (let i = 0; i < MAX_TOKEN_LENGTH; i++) {
    const aByte = i < aBuf.length ? aBuf[i] : 0;
    const bByte = i < bBuf.length ? bBuf[i] : 0;
    result |= aByte ^ bByte;
  }
  return result === 0 && aBuf.length === bBuf.length;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const expectedToken = process.env.ZULIP_WEBHOOK_TOKEN;

    if (!expectedToken) {
      console.error("[Zulip Webhook] Server lacks ZULIP_WEBHOOK_TOKEN config.");
      return NextResponse.json({ error: "Webhook token not configured." }, { status: 500 });
    }

    if (!body.token || !timingSafeEqual(body.token, expectedToken)) {
      return NextResponse.json({ error: "Unauthorized: Invalid webhook token." }, { status: 401 });
    }

    const { message, trigger } = body;
    if (!message || (trigger !== "message" && trigger !== "private_message" && trigger !== "mention")) {
      return NextResponse.json({ content: "" }, { status: 200 });
    }

    const topic = message.topic || message.subject;
    if (!topic || !topic.startsWith("Task-")) {
      // Ignore messages that don't belong to a task thread
      return NextResponse.json({ content: "" }, { status: 200 });
    }

    const taskId = topic.replace("Task-", "").trim();
    const taskRef = adminDb.collection("tasks").doc(taskId);
    const taskSnap = await taskRef.get();

    if (!taskSnap.exists) {
      console.warn(`[Zulip Webhook] Task "${taskId}" does not exist in Firestore.`);
      return NextResponse.json({ content: "Task card not found." }, { status: 200 });
    }

    const cleanContent = (message.content || "").replace(/@\*\*[^*]+\*\*/g, "").trim();
    if (!cleanContent) {
      return NextResponse.json({ content: "" }, { status: 200 });
    }

    const newComment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      author: message.sender_full_name || "Zulip User",
      content: cleanContent,
      createdAt: new Date().toISOString(),
      source: "zulip",
    };

    await taskRef.update({
      comments: FieldValue.arrayUnion(newComment),
    });

    console.log(`[Zulip Webhook] Synced comment from Zulip to Task "${taskId}"`);
    return NextResponse.json({ content: "" }, { status: 200 });
  } catch (error: any) {
    console.error("[Zulip Webhook] Error processing incoming webhook:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
