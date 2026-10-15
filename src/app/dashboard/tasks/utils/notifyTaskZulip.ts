import { authenticatedFetch } from "@/lib/api";
import { logger } from "@/utils/logger";
import { describeTaskError, type TaskOperationError } from "../taskErrors";
import type { TaskItem } from "@/types/task";

export type TaskSyncState = "idle" | "syncing" | "success" | "error";

export interface TaskZulipNotifyPayload {
  taskId: string;
  action: "create" | "move";
  title: string;
  description?: string;
  priority?: TaskItem["priority"];
  subteam?: TaskItem["subteam"];
  status?: TaskItem["status"];
  dueDate?: string;
}

export interface NotifyTaskZulipOptions {
  setSyncState?: (state: TaskSyncState) => void;
  onNotificationError?: (error: TaskOperationError) => void;
}

export async function notifyTaskZulip(
  payload: TaskZulipNotifyPayload,
  options: NotifyTaskZulipOptions = {},
): Promise<boolean> {
  const { setSyncState, onNotificationError } = options;
  setSyncState?.("syncing");
  try {
    const res = await authenticatedFetch("/api/tasks/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    setSyncState?.("success");
    setTimeout(() => {
      setSyncState?.("idle");
    }, 3000);
    return true;
  } catch (err) {
    logger.error("Zulip notification failed:", err);
    const notificationError = describeTaskError("notify Zulip", err);
    onNotificationError?.({
      ...notificationError,
      message:
        "The task was saved, but its Zulip notification failed. The board remains the source of truth.",
    });
    setSyncState?.("error");
    setTimeout(() => {
      setSyncState?.("idle");
    }, 3000);
    return false;
  }
}
