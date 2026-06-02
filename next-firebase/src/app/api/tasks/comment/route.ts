import { NextRequest, NextResponse } from "next/server";
import { sendZulipMessage } from "@/lib/zulip";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, title, author, content } = body;

    if (!taskId || !author || !content) {
      return NextResponse.json(
        { success: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    const streamName = process.env.ZULIP_KANBAN_STREAM || "kanban";
    const topic = `Task-${taskId}`;
    const messageContent = `💬 **${author}** (via Web):\n\n${content}`;

    const success = await sendZulipMessage(streamName, topic, messageContent);

    return NextResponse.json({
      success,
      message: success ? "Comment forwarded to Zulip." : "Zulip integration is not active or failed.",
    });
  } catch (error: any) {
    console.error("Error in tasks comment proxy endpoint:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
