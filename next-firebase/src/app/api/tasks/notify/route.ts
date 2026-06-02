import { NextRequest, NextResponse } from "next/server";
import { sendZulipMessage } from "@/lib/zulip";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, action, title, status, description, subteam, priority } = body;

    if (!taskId || !action || !title) {
      return NextResponse.json(
        { success: false, error: "Missing required fields (taskId, action, title)." },
        { status: 400 }
      );
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
      return NextResponse.json(
        { success: false, error: "Invalid action." },
        { status: 400 }
      );
    }

    const success = await sendZulipMessage(streamName, topic, content);

    return NextResponse.json({
      success,
      message: success ? "Notification sent to Zulip." : "Zulip integration is not active or failed.",
    });
  } catch (error: any) {
    console.error("Error in tasks notification endpoint:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
